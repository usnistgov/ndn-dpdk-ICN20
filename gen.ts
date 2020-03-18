import { AppConfig as GenTasks, TaskConfig as GenTask } from "@usnistgov/ndn-dpdk/app/ping/mod";
import { FetchBenchmarkArgs, FetchBenchmarkReply, FetchIndexArg } from "@usnistgov/ndn-dpdk/mgmt/pingmgmt/mod";
import { Name } from "@usnistgov/ndn-dpdk/ndn/mod";

import { env, NetifInfo } from "./config";
import { Forwarder } from "./fw";
import { Host } from "./host";
import { RuntimeDir } from "./runtime-dir";

export interface BenchmarkRecord {
  fetchJobs: Array<{ args: FetchBenchmarkArgs; reply: FetchBenchmarkReply }>;
  goodput: number;
}

/** Control a host running NDN-DPDK traffic generator. */
export class TrafficGen extends Host {
  constructor(runtimeDir: RuntimeDir, mgmtUri: string = env.MGMT_GEN, netifs: readonly NetifInfo[] = env.IF_GEN) {
    super(runtimeDir, "gen", mgmtUri, netifs);
  }

  public options = {
    nComps: 4,
    nFetchers: 2,
    nPatterns: 6, // name prefixes between a client and a server
    nDupPatterns: 0,
    interestLifetime: 300,
    dataHasSuffix: false,
    payloadLen: 1000,
    fetchBenchmarkArg: {
      Warmup: 5000,
      Interval: 100,
      Count: 600,
    },
    clientRxDelay: 10E6,
    serverRxDelay: 10E6,
  };

  private clients = new Map<string, Set<string>>();
  private servers = new Set<string>();
  private clientIds = new Map<string, FetchIndexArg[]>();

  /**
   * Add a traffic direction.
   * @param client client index letter, such as "A".
   * @param server server index letter, such as "B".
   */
  public addTrafficDirection(client: string, server: string) {
    this.declareEthPort(server);
    this.servers.add(server);
    this.declareEthPort(client);

    if (!this.clients.has(client)) {
      this.clients.set(client, new Set<string>());
    }
    this.clients.get(client)!.add(server);
  }

  /** Build ndnping-dpdk tasks file. */
  protected buildTasks(): GenTasks {
    const tasks = [] as GenTasks;
    for (const [index, { numa, pci }] of this.ethPorts) {
      const task: GenTask = {
        Face: {
          Scheme: "ether",
          Port: pci,
        },
      };

      if (this.clients.has(index)) {
        const nFetchers = Math.min(this.options.nFetchers, this.options.nPatterns);
        task.Fetch = nFetchers;
        task.FetchCfg = {
          RxQueue: {
            Delay: this.options.clientRxDelay,
          },
        };
        const fetchIds = [] as FetchIndexArg[];
        for (let i = 0; i < nFetchers; ++i) {
          this.lcores.add("CLIR", this.cpuList.take(numa));
          fetchIds.push({ Index: tasks.length, FetchId: i });
        }
        this.clientIds.set(index, fetchIds);
      }

      if (this.servers.has(index)) {
        task.Server = {
          RxQueue: {
            Delay: this.options.serverRxDelay,
          },
          Nack: true,
          Patterns: [
            {
              Prefix: `/${index}`,
              Replies: [
                {
                  Suffix: this.options.dataHasSuffix ? "/127=Z" : "",
                  FreshnessPeriod: 4000,
                  PayloadLen: this.options.payloadLen,
                },
              ],
            },
          ],
        };
        this.lcores.add("SVR", this.cpuList.take(numa));
      }

      if (!!task.Fetch || !!task.Server) {
        tasks.push(task);
      }
    }
    return tasks;
  }

  /** Initialize face, FIB, and NDT on a forwarder connected to this traffic generator. */
  public async initForwarder(fw: Forwarder) {
    let fwd = 0;
    const nFwds = fw.countFwds();
    for (const server of this.servers) {
      const face = await fw.createFace(server);
      for (let i = 0; i < this.options.nPatterns; ++i) {
        await fw.setFibEntry(`/${server}/${i}`, [face]);
        await fw.setNdtRecord(`/${server}/${i}`, fwd);
        fwd = (fwd + 1) % nFwds;
      }
    }
    for (const client of this.clients.keys()) {
      if (!this.servers.has(client)) {
        await fw.createFace(client);
      }
    }
  }

  /** Start the generator. */
  public async start() {
    this.runtimeDir.writeFile("gen.tasks.json", this.buildTasks());
    this.runtimeDir.writeFile("gen.init-config.json", this.buildInitConfig());
    return this.startImpl("gen-start.sh", { INITCONFIG: "gen.init-config.json", GENTASKS: "gen.tasks.json" }, { GENLOG: "gen.log" });
  }

  /** Execute benchmark once. */
  public async benchmarkOnce(): Promise<BenchmarkRecord> {
    const fetchJobs = await Promise.all(Array.from(this.listFetchJobs()).map(async (args) => {
      const reply = await this.mgmt.request<FetchBenchmarkArgs, FetchBenchmarkReply>("Fetch.Benchmark", args);
      return { args, reply };
    }));
    const goodput = fetchJobs.map(({ reply }) => reply.Goodput).reduce((sum, value) => sum + value, 0);
    return { fetchJobs, goodput };
  }

  private *listFetchJobs(): Iterable<FetchBenchmarkArgs> {
    const rnd = Math.floor(Math.random() * 99999999).toString().padStart(8, "0");
    for (const [client, servers] of this.clients) {
      const fetchJobs = this.clientIds.get(client)!.map((fetchId): FetchBenchmarkArgs => ({
        ...fetchId,
        Templates: [],
        ...this.options.fetchBenchmarkArg,
      }));

      let i = 0;
      for (const name of this.listFetchNames(client, servers, rnd)) {
        fetchJobs[i].Templates.push({
          Prefix: name,
          CanBePrefix: this.options.dataHasSuffix,
          InterestLifetime: this.options.interestLifetime,
        });
        i = (i + 1) % fetchJobs.length;
      }
      yield* fetchJobs;
    }
  }

  private *listFetchNames(client: string, servers: Set<string>, rnd: string): Iterable<Name> {
    const firstClient = Array.from(this.clients.keys()).unshift();
    for (const server of servers) {
      for (let i = 0; i < this.options.nPatterns; ++i) {
        const clientName = i < this.options.nDupPatterns ? firstClient : client;
        yield `/${server}/${i}/${clientName}_${rnd}${"/127=Y".repeat(this.options.nComps - 4)}`;
      }
    }
  }
}
