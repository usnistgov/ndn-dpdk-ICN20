import "hard-rejection/register";

import { Scenario } from "./scenario";

(async () => {
await Scenario.execute("simple-csmatch",
  async ({ fw, gen }) => {
    fw.initConfigOptions = {
      ethrxCap: (2 ** 17 + 50000) * 6,
      mtu: 1500,
    };
    fw.options.CsCapMd = 2 ** 17;
    fw.declareEthPort("A");
    fw.declareEthPort("B");
    fw.declareEthPort("C");
    fw.allocFwds(1, 6);

    gen.options.nPatterns = 6;
    gen.options.nDupPatterns = 5;
    gen.addTrafficDirection("B", "A");
    gen.addTrafficDirection("C", "A");
  },
);
})();
