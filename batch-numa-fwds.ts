#!/usr/bin/env node
import "hard-rejection/register";

import { FixedRuns, Scenario } from "./scenario";

(async () => {
for (const dir of ["BC", "BA"]) {
  for (const nFwds of [1, 2, 4, 8, 12]) {
    await Scenario.execute(`numa-fwds/${dir}-${nFwds}`,
      async ({ fw, gen }) => {
        fw.options.enableHrlog = true;
        for (const port of dir) {
          fw.declareEthPort(port);
        }
        fw.allocFwds(1, nFwds);

        gen.options.nPatterns = nFwds;
        gen.addTrafficDirection(dir[0], dir[1]);
        gen.addTrafficDirection(dir[1], dir[0]);
      },
      undefined,
      new FixedRuns(50),
    );
  }
}
process.exit();
})();
