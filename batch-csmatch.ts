import "hard-rejection/register";

import { Scenario } from "./scenario";

interface Row {
  title: string;
  CsCapMd: number;
  CsCapMi?: number;
  nFwds?: number;
}

const TABLE: Row[] = [
  { title: "2b17", CsCapMd: 2 ** 17 },
  { title: "2b18", CsCapMd: 2 ** 18 },
  { title: "2b19", CsCapMd: 2 ** 19 },
  { title: "2b20", CsCapMd: 2 ** 20 },
];

(async () => {
for (const { title, CsCapMd, CsCapMi = 32768, nFwds = 4 } of TABLE) {
  await Scenario.execute(`csmatch/${title}`,
    async ({ fw, gen }) => {
      fw.options.CsCapMd = CsCapMd;
      fw.options.CsCapMi = CsCapMi;
      fw.initConfigOptions = {
        ethrxCap: (CsCapMd * 2 + CsCapMi + fw.options.PitCap) * nFwds,
        mtu: 1500,
      };
      fw.options.enableHrlog = true;
      fw.declareEthPort("A");
      fw.declareEthPort("B");
      fw.declareEthPort("C");
      fw.allocFwds(1, nFwds);

      gen.options.nFetchers = nFwds;
      gen.options.nPatterns = nFwds;
      gen.options.nDupPatterns = nFwds;
      gen.options.clientPortStartGap = 20;
      gen.options.clientRxDelay = 20E6;
      gen.options.serverRxDelay = 0;
      gen.addTrafficDirection("B", "A");
      gen.addTrafficDirection("C", "A");
    },
  );
}
})();
