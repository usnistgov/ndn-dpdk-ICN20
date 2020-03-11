import { getSshConfig } from "./config";
import { Forwarder, FwCounters } from "./fw";
import { BenchmarkRecord as GenBenchmarkRecord, TrafficGen } from "./gen";
import { RuntimeDir } from "./runtime-dir";

/** Determine whether a scenario can terminate. */
export interface TerminateCondition {
  shouldContinue(): boolean;

  addObservation(ob: ObservationRecord): void;

  getState(): object;
}

/** Terminate scenarion after a fixed number of observations. */
export class FixedRuns implements TerminateCondition {
  constructor(public readonly nRuns: number) {
  }

  public nObservations = 0;

  public shouldContinue() {
    return this.nObservations < this.nRuns;
  }

  public addObservation() {
    ++this.nObservations;
  }

  public getState() {
    return {};
  }
}

/** Record of an observation. */
export interface ObservationRecord extends FwCounters, GenBenchmarkRecord {
  timeBegin: number;
  timeEnd: number;
  duration: number;
}

/** Experiment scenario. */
export class Scenario {
  public readonly fw: Forwarder;
  public readonly gen: TrafficGen;

  constructor(private readonly runtimeDir: RuntimeDir) {
    this.fw = new Forwarder(runtimeDir);
    this.gen = new TrafficGen(runtimeDir);
  }

  public async connect() {
    await Promise.all([
      this.fw.connect(getSshConfig("FW")),
      this.gen.connect(getSshConfig("GEN")),
    ]);
  }

  public async stopAndDisconnect() {
    await Promise.all([
      this.fw.stop(),
      this.gen.stop(),
    ]);
    await Promise.all([
      this.fw.disconnect(),
      this.gen.disconnect(),
    ]);
  }

  /** Perform one observation and return the result. */
  public async observe(): Promise<ObservationRecord> {
    const fwSnapshot = await this.fw.snapshotCounters();
    const timeBegin = Date.now();
    const genRecord = await this.gen.benchmarkOnce();
    const timeEnd = Date.now();
    const fwCnt = await this.fw.readCountersSince(fwSnapshot);
    return {
      ...fwCnt,
      ...genRecord,
      timeBegin,
      timeEnd,
      duration: timeEnd - timeBegin,
    };
  }

  /** Perform observations until a condition is satisfied. */
  public async run(cond: TerminateCondition) {
    while (cond.shouldContinue()) {
      const ob = await this.observe();
      cond.addObservation(ob);
      const tcState = cond.getState();
      this.runtimeDir.writeNdjson("observations.ndjson", { ...ob, tcState });
    }
  }
}
