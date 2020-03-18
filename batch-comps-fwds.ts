import "hard-rejection/register";

import { Scenario } from "./scenario";

(async () => {
for (const nComps of [4, 10, 16]) {
  for (const nFwds of [1, 2, 4, 8, 12]) {
    await Scenario.execute(`comps-fwds/${nComps}-${nFwds}`,
      async ({ fw, gen }) => {
        fw.declareEthPort("B");
        fw.declareEthPort("C");
        fw.allocFwds(1, nFwds);

        gen.options.nComps = nComps;
        gen.options.nPatterns = nFwds;
        gen.addTrafficDirection("B", "C");
        gen.addTrafficDirection("C", "B");
      },
    );
  }
}
})();
