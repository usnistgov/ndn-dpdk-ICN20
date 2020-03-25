import * as path from "path";

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
  hrlogFilename?: string;
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

  public async start() {
    await this.fw.start();
    await this.gen.initForwarder(this.fw);
    await this.gen.start();
  }

  /** Perform one observation and return the result. */
  public async observe(isDryRun = false): Promise<ObservationRecord> {
    const fwSnapshot = await this.fw.snapshotCounters();
    const hrlogFilename = isDryRun ? undefined : await this.fw.startHrlog();
    const timeBegin = Date.now();
    const genRecord = await this.gen.benchmarkOnce();
    const timeEnd = Date.now();
    const fwCnt = await this.fw.readCountersSince(fwSnapshot);
    if (!isDryRun) {
      await this.fw.stopHrlog(hrlogFilename);
    }

    return {
      ...fwCnt,
      ...genRecord,
      hrlogFilename,
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

  public async stop() {
    await Promise.all([
      this.fw.stop(),
      this.gen.stop(),
    ]);
  }

  public async disconnect() {
    await Promise.all([
      this.fw.disconnect(),
      this.gen.disconnect(),
    ]);
  }
}

export namespace Scenario {
  export type InitFunction = (scenario: Scenario) => Promise<void>;

  /**
   * Execute a scenario if it hasn't been completed.
   * @param name scenario name, must be valid directory name.
   * @param init0 initialization before starting forwarder and generator.
   * @param init1 initialization after starting forwarder and generator.
   * @param cond terminate condition.
   */
  export async function execute(
      name: string,
      init0: InitFunction = () => Promise.resolve(),
      init1: InitFunction = () => Promise.resolve(),
      cond: TerminateCondition = new FixedRuns(10),
  ) {
    const runtimeDir = new RuntimeDir(path.join(__dirname, "output", name));
    if (runtimeDir.hasFile("scenario-done.json")) {
      return;
    }
    runtimeDir.deleteAll();

    const scenario = new Scenario(runtimeDir);
    await scenario.connect();
    await init0(scenario);
    await scenario.start();
    await init1(scenario);
    await scenario.observe(true);
    await scenario.run(cond);
    await scenario.stop();
    await scenario.disconnect();

    runtimeDir.writeFile("scenario-done.json", Date.now());
    await runtimeDir.close();
  }
}
