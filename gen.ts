import { AppConfig as GenTasks, TaskConfig as GenTask } from "@usnistgov/ndn-dpdk/app/ping/mod";
import { FetchBenchmarkArgs, FetchBenchmarkReply, FetchTemplate } from "@usnistgov/ndn-dpdk/mgmt/pingmgmt/mod";

import { env, NetifInfo } from "./config";
import { Forwarder } from "./fw";
import { Host } from "./host";
import { RuntimeDir } from "./runtime-dir";

export interface BenchmarkRecord {
  fetchDir: Record<string, BenchmarkDirRecord>;
  goodput: number;
}

export interface BenchmarkDirRecord {
  delay: number;
  templates: FetchTemplate[];
  reply: FetchBenchmarkReply[];
  goodput: number;
}

/** Control a host running NDN-DPDK traffic generator. */
export class TrafficGen extends Host {
  constructor(runtimeDir: RuntimeDir, mgmtUri: string = env.MGMT_GEN, netifs: readonly NetifInfo[] = env.IF_GEN) {
    super(runtimeDir, "gen", mgmtUri, netifs);
  }

  public options = {
    nComps: 4,
    nFetchThreads: 6,
    nPatterns: 6, // name prefixes between a client and a server
    nDupPatterns: 0,
    interestLifetime: 300,
    dataHasSuffix: false,
    payloadLen: 1000,
    fetchBenchmarkArg: {
      Interval: 100,
      Count: 600,
    },
    clientPortStartGap: 0, // start client ports at different times
    clientRxDelay: 10E6,
    serverRxDelay: 10E6,
  };

  private clients = new Map<string, Set<string>>();
  private servers = new Set<string>();
  private clientTaskIndex = new Map<string, number>();

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
        const NProcs = this.clients.get(index)!.size * this.options.nPatterns;
        const NThreads = Math.min(this.options.nFetchThreads, NProcs);
        task.Fetch = {
          NThreads,
          NProcs,
          RxQueue: {
            Delay: this.options.clientRxDelay,
          },
        };
        for (let i = 0; i < NThreads; ++i) {
          this.lcores.add("CLIR", this.cpuList.take(numa));
        }
        this.clientTaskIndex.set(index, tasks.length);
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
    const fetchJobs = await Promise.all(Array.from(this.listFetchJobs()).map(async ({ client, servers, args }) => {
      const delay = args.Index * this.options.clientPortStartGap;
      await new Promise((r) => setTimeout(r, delay));
      const reply = await this.mgmt.request("Fetch", "Benchmark", args);
      return { client, servers, args, delay, reply };
    }));

    const record: BenchmarkRecord = {
      fetchDir: {},
      goodput: 0,
    };
    for (const { client, servers, args, delay, reply } of fetchJobs) {
      const offset = 0;
      for (const server of servers) {
        const end = offset + this.options.nPatterns;
        const dir: BenchmarkDirRecord = {
          delay,
          templates: args.Templates.slice(offset, end),
          reply: reply.slice(offset, end),
          goodput: 0,
        };
        dir.goodput = dir.reply.map(({ Goodput }) => Goodput).reduce((sum, value) => sum + value, 0);
        record.fetchDir[`${client}${server}`] = dir;
        record.goodput += dir.goodput;
      }
    }
    return record;
  }

  private *listFetchJobs(): Iterable<{ client: string; servers: string[]; args: FetchBenchmarkArgs}> {
    const rnd = Math.floor(Math.random() * 99999999).toString().padStart(8, "0");
    for (const [client, serverSet] of this.clients) {
      const args: FetchBenchmarkArgs = {
        Index: this.clientTaskIndex.get(client)!,
        Templates: [],
        ...this.options.fetchBenchmarkArg,
      };

      const servers = Array.from(serverSet);
      for (const server of servers) {
        for (let i = 0; i < this.options.nPatterns; ++i) {
          const clientName = i < this.options.nDupPatterns ? "~" : client;
          const name = `/${server}/${i}/${clientName}_${rnd}${"/127=Y".repeat(this.options.nComps - 4)}`;

          args.Templates.push({
            Prefix: name,
            CanBePrefix: this.options.dataHasSuffix,
            InterestLifetime: this.options.interestLifetime,
          });
        }
      }

      yield { client, servers, args };
    }
  }
}
