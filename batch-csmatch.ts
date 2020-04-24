#!/usr/bin/env node
import "hard-rejection/register";

import { FixedRuns, Scenario } from "./scenario";

const nFwds = 4;

(async () => {
for (let csCapacityLog2 = 17; csCapacityLog2 <= 20; ++csCapacityLog2) {
  for (const dataHasSuffix of [false, true]) {
    const csCapacity = 2 ** csCapacityLog2;
    await Scenario.execute(`csmatch/2p${csCapacityLog2}_${dataHasSuffix ? "S" : "E"}`,
      async ({ fw, gen }) => {
        fw.options.CsCapMd = csCapacity;
        fw.options.CsCapMi = csCapacity;
        fw.initConfigOptions = {
          ethrxCap: (fw.options.CsCapMd + fw.options.PitCap) * nFwds + 65536,
          mtu: 1500,
        };
        fw.options.enableHrlog = true;
        fw.declareEthPort("A");
        fw.declareEthPort("B");
        fw.declareEthPort("C");
        fw.allocFwds(1, nFwds);

        gen.options.nFetchThreads = nFwds;
        gen.options.nPatterns = nFwds;
        gen.options.nDupPatterns = nFwds;
        gen.options.dataHasSuffix = dataHasSuffix;
        gen.options.clientPortStartGap = 100;
        gen.addTrafficDirection("B", "A");
        gen.addTrafficDirection("C", "A");
      },
      undefined,
      new FixedRuns(150),
    );
  }
}
process.exit();
})();
