import "hard-rejection/register";

import { Scenario } from "./scenario";

(async () => {
for (const nComps of [4, 10, 16]) {
  for (const nFwds of [1, 2, 4, 8, 12]) {
    for (const dir of ["BC", "BA"]) {
      await Scenario.execute(`comps-fwds/${nComps}-${nFwds}-${dir}`,
        async ({ fw, gen }) => {
          for (const port of dir) {
            fw.declareEthPort(port);
          }
          fw.allocFwds(1, nFwds);

          gen.options.nComps = nComps;
          gen.options.nFetchThreads = 4;
          gen.options.nPatterns = nFwds;
          gen.options.clientRxDelay = 1E6;
          gen.options.serverRxDelay = 0;
          gen.addTrafficDirection(dir[0], dir[1]);
          gen.addTrafficDirection(dir[1], dir[0]);
        },
      );
    }
  }
}
})();
