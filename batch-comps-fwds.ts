#!/usr/bin/env node
import "hard-rejection/register";

import { Scenario } from "./scenario";

const dir = "BC";

(async () => {
for (const nComps of [4, 10, 16]) {
  for (const nFwds of [1, 2, 4, 8, 12]) {
    await Scenario.execute(`comps-fwds/${nComps}-${nFwds}`,
      async ({ fw, gen }) => {
        for (const port of dir) {
          fw.declareEthPort(port);
        }
        fw.allocFwds(1, nFwds);

        gen.options.nComps = nComps;
        gen.options.nPatterns = nFwds;
        gen.addTrafficDirection(dir[0], dir[1]);
        gen.addTrafficDirection(dir[1], dir[0]);
      },
    );
  }
}
process.exit();
})();
