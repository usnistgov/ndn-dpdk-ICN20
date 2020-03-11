import { InitConfig, MempoolCapacityConfig } from "@usnistgov/ndn-dpdk/appinit/mod";
import { makeMgmtClient, RpcClient } from "@usnistgov/ndn-dpdk/mgmt/mod";
import SSH from "node-ssh";
import * as os from "os";
import * as path from "path";
import { quote as shellQuote } from "shell-quote";

import { atIndex, env, NetifInfo } from "./config";
import { CpuList, LcoreAssignment } from "./cpulist";
import { HostDir, LocalHostDir, RemoteHostDir } from "./host-dir";
import { RuntimeDir } from "./runtime-dir";

/** Control a host running an NDN-DPDK program. */
export class Host {
  protected readonly ssh = new SSH();
  protected readonly cpuList = new CpuList();
  protected readonly ethPorts = new Map<string, NetifInfo>();
  protected readonly lcores = new LcoreAssignment();
  protected readonly mgmt: RpcClient;
  private hostDir!: HostDir;

  /**
   * Constructor.
   * @param runtimeDir runtime directory on local host.
   * @param dpdkFilePrefix `--file-prefix` flag passed to EAL.
   * @param mgmtUri NDN-DPDK management URI reachable from local host.
   * @param netifs netif definitions.
   */
  protected constructor(protected readonly runtimeDir: RuntimeDir,
      protected readonly dpdkFilePrefix: string,
      protected readonly mgmtUri: string,
      protected readonly netifs: readonly NetifInfo[]) {
    this.mgmt = makeMgmtClient(mgmtUri);
  }

  /** Connect to the host. */
  public async connect(sshConfig: SSH.ConfigGiven) {
    await this.ssh.connect(sshConfig);

    const isLocal = sshConfig.host === "localhost" && (await this.ssh.exec("hostname -s")) === os.hostname();
    if (isLocal) {
      this.hostDir = new LocalHostDir();
    } else {
      const remoteHostDir = new RemoteHostDir(this.ssh);
      await remoteHostDir.connect();
      this.hostDir = remoteHostDir;
    }

    this.cpuList.parse(await this.ssh.exec(CpuList.COMMAND));

    const setupFile = await this.uploadScriptFile("setup.sh");
    await this.ssh.exec(`[[ -f /tmp/ndndpdk-benchmark_setup-done ]] || sudo HUGE1G_NPAGES=${env.HUGE1G_NPAGES} SPDK_PATH=${shellQuote([env.SPDK_PATH])} bash ${setupFile}`);
  }

  /** Disconnect from the host. */
  public async disconnect() {
    await this.hostDir.close();
    this.ssh.dispose();
  }

  /**
   * Whitelist an Ethernet port.
   * @param index index letter, such as "A".
   */
  public declareEthPort(index: string) {
    if (this.ethPorts.has(index)) {
      return;
    }
    const netif = atIndex(this.netifs, index);
    this.ethPorts.set(index, netif);
    this.lcores.add("RX", this.cpuList.take(netif.numa));
    this.lcores.add("TX", this.cpuList.take(netif.numa));
  }

  /** Build init-config sections common to all NDN-DPDK programs. */
  protected buildInitConfig(): InitConfig {
    return {
      Mempool: {
        IND: MempoolCapacityConfig.create(2097151),
        ETHRX: MempoolCapacityConfig.create(1048575, 9200),
      },
      LCoreAlloc: this.lcores.toConfigJson(),
      Face: {
        EnableEth: true,
        EthMtu: 9000,
        EthRxqFrames: 4096,
        EthTxqPkts: 256,
        EthTxqFrames: 4096,
        EnableSock: false,
        EnableMock: false,
      },
    };
  }

  /**
   * Start NDN-DPDK process using bash script.
   * @param scriptName script filename.
   * @param uploads environ => config filename to be uploaded.
   * @param downloads environ => log filename to be downloaded.
   */
  protected async startImpl(scriptName: string, uploads: Record<string, string>, downloads: Record<string, string>) {
    let [masterLcore] = this.lcores.list("_MASTER");
    if (typeof masterLcore === "undefined") {
      masterLcore = this.cpuList.take(null);
      this.lcores.add("_MASTER", masterLcore);
    }

    const assigned = this.lcores.listAssigned();
    const unassigned = this.lcores.listUnassigned(this.cpuList, assigned);
    const socketMem = 32768; // memory per socket
    const ealParams = `${`-l ${assigned.join()} --master-lcore ${masterLcore} ` +
                      `--socket-mem ${Array.from(this.cpuList.records.keys()).map(() => socketMem)} ` +
                      `--file-prefix ${this.dpdkFilePrefix} ` +
                      `${Array.from(this.ethPorts.values()).map((netif) => `-w ${netif.pci}`).join(" ")}`} `;
    let env = `EALPARAMS=${shellQuote([ealParams])}`;

    const cpusetFile = await this.uploadScriptFile("cpuset.sh");
    env += ` CPUSETBIN=${cpusetFile} CPUSET_B=${assigned.join()} CPUSET_O=${unassigned.join()}`;

    for (const [envVar, localFile] of Object.entries(uploads)) {
      const remoteFile = await this.uploadRuntimeFile(localFile);
      env += ` ${envVar}=${remoteFile}`;
    }
    for (const [envVar, localFile] of Object.entries(downloads)) {
      const remoteFile = this.downloadRuntimeFileLater(localFile);
      env += ` ${envVar}=${remoteFile}`;
    }

    const scriptFile = await this.uploadScriptFile(scriptName);
    return this.ssh.exec(`${env} bash ${scriptFile}`);
  }

  /** Stop NDN-DPDK process. */
  public async stop() {
    const pattern = `\\--file-prefix ${this.dpdkFilePrefix} `;
    await this.ssh.exec(`while pgrep -f "${pattern}" >/dev/null; do sudo pkill -f "${pattern}"; sleep 1; done`);
    const cpusetFile = await this.uploadScriptFile("cpuset.sh");
    await this.ssh.exec(`sudo bash ${cpusetFile} 0`);
  }

  protected uploadScriptFile(filename: string) {
    return this.hostDir.upload(path.join(__dirname, filename));
  }

  protected uploadRuntimeFile(filename: string, force = false) {
    return this.hostDir.upload(this.runtimeDir.getFilename(filename), force);
  }

  protected downloadRuntimeFileLater(filename: string) {
    return this.hostDir.downloadLater(this.runtimeDir.getFilename(filename));
  }
}
