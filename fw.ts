import { Histogram } from "@usnistgov/ndn-dpdk/cmd/ndndpdk-hrlog2histogram/mod";
import { InitConfig } from "@usnistgov/ndn-dpdk/cmd/ndnfw-dpdk/mod";
import * as stat from "@usnistgov/ndn-dpdk/core/running_stat/mod";
import { Counters as FaceCounters, FaceId } from "@usnistgov/ndn-dpdk/iface/mod";
import PProgress from "p-progress";
import smallestPowerOfTwo from "smallest-power-of-two";

import { env, NetifInfo } from "./config";
import { Host } from "./host";
import { RuntimeDir } from "./runtime-dir";

const tableCntKeys = {
  nPitInsert: true,
  nPitFound: true,
  nCsHits: true,
  nCsMisses: true,
};

const pktCntKeys = {
  RxFrames: true,
  RxOctets: true,
  RxInterests: true,
  RxData: true,
  RxNacks: true,
  TxFrames: true,
  TxOctets: true,
  TxInterests: true,
  TxData: true,
  TxNacks: true,
};

const latencyCntKeys = {
  InterestLatency: true,
  DataLatency: true,
  NackLatency: true,
};

export interface FwCounters {
  fw: Array<Record<keyof typeof tableCntKeys, number>>;
  face: Record<string, Pick<FaceCounters, keyof typeof pktCntKeys|keyof typeof latencyCntKeys>>;
  total: Record<keyof typeof tableCntKeys|keyof typeof pktCntKeys, number> & Record<keyof typeof latencyCntKeys, stat.Snapshot>;
}

function makeEmptyFwCounters(): FwCounters {
  return {
    face: {},
    fw: [],
    total: {
      ...Object.fromEntries((Object.keys(tableCntKeys)).map((key) => [key, 0])),
      ...Object.fromEntries((Object.keys(pktCntKeys)).map((key) => [key, 0])),
      ...Object.fromEntries((Object.keys(latencyCntKeys)).map((key) => [key, stat.empty])),
    } as any,
  };
}

export class FwCountersSnapshot {
  constructor(private readonly a: FwCounters) {
  }

  public until(c: FwCounters): FwCounters {
    const b = makeEmptyFwCounters();
    for (let fwIndex = 0; fwIndex < c.fw.length; ++fwIndex) {
      const fc = c.fw[fwIndex];
      const fa = this.a.fw[fwIndex];
      const fb: any = {};
      for (const key of Object.keys(tableCntKeys) as Iterable<keyof typeof tableCntKeys>) {
        fb[key] = fc[key] - fa[key];
        b.total[key] += fb[key];
      }
      b.fw.push(fb);
    }
    for (const portIndex of Object.keys(c.face)) {
      const fc = c.face[portIndex];
      const fa = this.a.face[portIndex];
      const fb: any = {};
      for (const key of Object.keys(pktCntKeys) as Iterable<keyof typeof pktCntKeys>) {
        fb[key] = fc[key] - fa[key];
        b.total[key] += fb[key];
      }
      for (const key of Object.keys(latencyCntKeys) as Iterable<keyof typeof latencyCntKeys>) {
        fb[key] = stat.sub(fc[key], fa[key]);
        b.total[key] = stat.add(b.total[key], fb[key]);
      }
      b.face[portIndex] = fb;
    }
    return b;
  }
}

export type HrlogHistograms = Histogram[];

/** Control a host running NDN-DPDK forwarder. */
export class Forwarder extends Host {
  public constructor(runtimeDir: RuntimeDir, mgmtUri: string = env.MGMT_FW, netifs: readonly NetifInfo[] = env.IF_FW) {
    super(runtimeDir, "fw", mgmtUri, netifs);
  }

  public options = {
    PitCap: 50000, // this allows one million I/s at 50ms RTT
    CsCapMd: 32768,
    CsCapMi: 32768,
    enableHrlog: false,
    saveHrlog: false,
  };

  public initConfigOptions: NonNullable<Parameters<Host["buildInitConfig"]>[0]> = {};

  private faces = new Map<string, number>(); // portIndex=>face
  private ndtValues = new Map<number, number>(); // Index=>Value

  /**
   * Allocate forwarding threads.
   * @param numa NUMA socket.
   * @param count number of forwarding threads.
   * @throws insufficient lcores.
   */
  public allocFwds(numa: number, count: number) {
    for (let i = 0; i < count; ++i) {
      this.lcores.add("FWD", this.cpuList.take(numa));
    }
  }

  /** Count number of forwarding threads among all NUMA sockets. */
  public countFwds(): number {
    return this.lcores.list("FWD").length;
  }

  /** Build init-config including forwarder-specific sections. */
  protected buildInitConfig(): InitConfig {
    const {
      PitCap,
      CsCapMd,
      CsCapMi,
    } = this.options;
    const PcctCapacity = smallestPowerOfTwo(CsCapMd * 2 + CsCapMi + PitCap) - 1;

    return {
      ...super.buildInitConfig(this.initConfigOptions),
      Ndt: {
        PrefixLen: 2,
        IndexBits: 16,
        SampleFreq: 16,
      },
      Fib: {
        MaxEntries: 4194303,
        NBuckets: 262144,
        StartDepth: 8,
      },
      Fwdp: {
        FwdInterestQueue: {
          DequeueBurstSize: 32,
        },
        FwdDataQueue: {
          DequeueBurstSize: 64,
        },
        FwdNackQueue: {
          DequeueBurstSize: 64,
        },
        LatencySampleFreq: 16,
        Suppress: {
          Min: 200e6,
          Max: 200e6,
        },
        PcctCapacity,
        CsCapMd,
        CsCapMi,
      },
    };
  }

  /** Start the forwarder. */
  public async start() {
    this.runtimeDir.writeFile("fw.init-config.json", this.buildInitConfig());
    return this.startImpl("fw-start.sh", { INITCONFIG: "fw.init-config.json" }, { FWLOG: "fw.log" });
  }

  /**
   * Create an Ethernet face.
   * @param index index letter of the port.
   */
  public async createFace(index: string): Promise<FaceId> {
    let faceId = this.faces.get(index);
    if (typeof faceId === "undefined") {
      const netif = this.ethPorts.get(index);
      if (!netif) {
        throw new Error(`port ${index} not declared`);
      }

      const face = await this.mgmt.request("Face", "Create", { Scheme: "ether", Port: netif.pci });
      faceId = face.Id;
      this.faces.set(index, faceId);
    }
    return faceId;
  }

  /**
   * Write an NDT record.
   * In case the same NDT index (truncated name hash) has been explicitly set to a different value
   * (forwarding thread number), this situation is logged in fw.ndt-conflicts.ndjson file.
   */
  public async setNdtRecord(name: string, value: number) {
    const { Index: index } = await this.mgmt.request("Ndt", "Update", {
      Name: name,
      Value: value,
    });
    const oldValue = this.ndtValues.get(index);
    if (typeof oldValue !== "undefined" && oldValue !== value) {
      this.runtimeDir.writeNdjson("fw.ndt-conflicts.ndjson", { index, name, oldValue, newValue: value });
    }
    this.ndtValues.set(index, value);
  }

  /** Write a FIB entry. */
  public async setFibEntry(name: string, nexthops: readonly number[]) {
    await this.mgmt.request("Fib", "Insert", {
      Name: name,
      Nexthops: nexthops.concat([]),
    });
  }

  /** Populate the FIB with many entries that are not expected to be used. */
  public fillFib: (count: number, template?: string) => PProgress<void> =
  PProgress.fn(async (count: number, arg2: any, arg3: any) => {
    const [template, progress]: [string, PProgress.ProgressNotifier] =
      typeof arg2 === "function" ? ["/65535=Z/%", arg2] : [arg2, arg3];
    for (let i = 0; i < count; ++i) {
      await this.setFibEntry(template.replace(/%/g, `${i}`), [1]);
      progress(i / count);
    }
  });

  private async readCounters(): Promise<FwCounters> {
    const cnt = makeEmptyFwCounters();
    for (let fwIndex = 0, nFwds = this.countFwds(); fwIndex < nFwds; ++fwIndex) {
      const [pitCnt, csCnt] = await Promise.all([
        this.mgmt.request("DpInfo", "Pit", { Index: fwIndex }),
        this.mgmt.request("DpInfo", "Cs", { Index: fwIndex }),
      ]);
      cnt.fw.push({
        nPitFound: pitCnt.NFound,
        nPitInsert: pitCnt.NInsert,
        nCsHits: csCnt.NHits,
        nCsMisses: csCnt.NMisses,
      });
    }
    for (const [portIndex, faceId] of this.faces) {
      const faceInfo = await this.mgmt.request("Face", "Get", { Id: faceId });
      cnt.face[portIndex] = faceInfo.Counters;
    }
    return cnt;
  }

  public async snapshotCounters(): Promise<FwCountersSnapshot> {
    return new FwCountersSnapshot(await this.readCounters());
  }

  public async readCountersSince(since: FwCountersSnapshot): Promise<FwCounters> {
    return since.until(await this.readCounters());
  }

  /**
   * Collect high resolution per-packet logs.
   * @returns filename
   */
  public async startHrlog(): Promise<string|undefined> {
    if (!this.options.enableHrlog) {
      return undefined;
    }

    const localFile = `${Date.now()}.hrlog`;
    const remoteFile = await this.hostDir.create(localFile, { download: this.options.saveHrlog, touch: true });
    await this.mgmt.request("Hrlog", "Start", {
      Filename: remoteFile,
    });
    return localFile;
  }

  public async stopHrlog(localFile: string|undefined): Promise<HrlogHistograms|undefined> {
    if (!localFile) {
      return undefined;
    }
    const remoteFile = await this.hostDir.create(localFile);
    await this.mgmt.request("Hrlog", "Stop", {
      Filename: remoteFile,
    });
    return JSON.parse(await this.ssh.exec(`ndndpdk-hrlog2histogram -f ${remoteFile}`));
  }
}
