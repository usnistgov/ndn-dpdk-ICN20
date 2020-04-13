import { LCoreAllocConfig } from "@usnistgov/ndn-dpdk/dpdk/mod.js";

/** CPU list and allocator. */
export class CpuList {
  public records = new Map<number, number[]>();

  public static readonly COMMAND = "lscpu -p=SOCKET,CORE";

  /** Parse result of COMMAND. */
  public parse(input: string) {
    this.records.clear();
    for (const line of input.split("\n")) {
      const m = /^(\d+),(\d+)$/.exec(line);
      if (m) {
        this.add(Number.parseInt(m[1], 10), Number.parseInt(m[2], 10));
      }
    }
  }

  /** Add a known CPU core. */
  private add(numa: number, lcore: number) {
    let lcores = this.records.get(numa);
    if (!lcores) {
      lcores = [];
      this.records.set(numa, lcores);
    }
    lcores.push(lcore);
  }

  /**
   * Allocate an CPU core if available.
   * @param numa either a NUMA socket, or null for any NUMA socket.
   */
  public tryTake(numa: number|null): number|undefined {
    if (typeof numa === "number") {
      const lcores = this.records.get(numa);
      if (!lcores || lcores.length <= 1) {
        return undefined;
      }
      return lcores.pop();
    }

    let mostLcores = [undefined] as Array<number|undefined>;
    for (const lcores of this.records.values()) {
      if (lcores.length > mostLcores.length) {
        mostLcores = lcores;
      }
    }
    return mostLcores.pop();
  }

  /**
   * Allocate an CPU core, throw if unavailable.
   * @param numa either a NUMA socket, or null for any NUMA socket.
   */
  public take(numa: number|null): number {
    const lcore = this.tryTake(numa);
    if (typeof lcore === "undefined") {
      throw new Error(`no CPU core available on ${numa}`);
    }
    return lcore;
  }
}

/** Table of assigned LCores. */
export class LcoreAssignment {
  public readonly table = new Map<string, number[]>();

  /** Assign lcore to role. */
  public add(role: string, lcore: number) {
    let arr = this.table.get(role);
    if (!Array.isArray(arr)) {
      arr = [];
      this.table.set(role, arr);
    }
    arr.push(lcore);
  }

  /** List lcores are assigned to role. */
  public list(role: string): readonly number[] {
    return this.table.get(role) ?? [];
  }

  public listAssigned(): number[] {
    return Array.from(this.table.values()).flat();
  }

  public listUnassigned(cpuList: CpuList, assigned = this.listAssigned()): number[] {
    const lcores = new Set(Array.from(cpuList.records.values()).flat());
    for (const lcore of assigned) {
      lcores.delete(lcore);
    }
    return Array.from(lcores);
  }

  public toConfigJson(): LCoreAllocConfig {
    const cfg: LCoreAllocConfig = {};
    for (const [role, lcores] of this.table) {
      if (role.startsWith("_")) {
        continue;
      }
      cfg[role] = {
        LCores: lcores,
      };
    }
    return cfg;
  }
}
