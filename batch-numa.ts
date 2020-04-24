#!/usr/bin/env node
import "hard-rejection/register";

import { Scenario } from "./scenario";

(async () => {
for (const dir of ["BC", "CB", "BCCB", "BA", "AB", "BAAB"]) {
  for (const nFwds of [1, 4, 8]) {
    for (const payloadLen of [0, 1000, 8000]) {
      await Scenario.execute(`numa/${dir}_${nFwds}_${payloadLen}`,
        async ({ fw, gen }) => {
          fw.options.enableHrlog = true;
          for (const port of dir) {
            fw.declareEthPort(port);
          }
          fw.allocFwds(1, nFwds);

          gen.options.nPatterns = nFwds;
          gen.options.payloadLen = payloadLen;
          gen.addTrafficDirection(dir[0], dir[1]);
          if (dir.length > 2) {
            gen.addTrafficDirection(dir[2], dir[3]);
          }
        },
      );
    }
  }
}
process.exit();
})();
