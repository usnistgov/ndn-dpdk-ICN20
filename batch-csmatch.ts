import "hard-rejection/register";

import { FixedRuns, Scenario } from "./scenario";

interface Row {
  csCapacity: number;
  dataHasSuffix?: boolean;
}

const TABLE: Row[] = [
  { csCapacity: 2 ** 17 },
  { csCapacity: 2 ** 18 },
  { csCapacity: 2 ** 19 },
  { csCapacity: 2 ** 20 },
  { csCapacity: 2 ** 20, dataHasSuffix: true },
];

const nFwds = 4;

(async () => {
for (const { csCapacity, dataHasSuffix = false } of TABLE) {
  const csCapacityLog2 = Math.log2(csCapacity);
  const csCapacityTitle = csCapacityLog2 === Math.round(csCapacityLog2) ? `2p${csCapacityLog2}` : `${csCapacity}`;
  await Scenario.execute(`csmatch/${csCapacityTitle}_${dataHasSuffix ? "S" : "E"}`,
    async ({ fw, gen }) => {
      fw.options.CsCapMd = csCapacity;
      fw.options.CsCapMi = dataHasSuffix ? csCapacity : 256;
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
      gen.options.clientPortStartGap = 20;
      gen.addTrafficDirection("B", "A");
      gen.addTrafficDirection("C", "A");
    },
    undefined,
    new FixedRuns(3),
  );
}
})();
