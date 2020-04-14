import "hard-rejection/register";

import { Scenario } from "./scenario";

const dir = "BC";
const nFwds = 8;

(async () => {
for (const payloadLen of [100, 500, 1000, 2000, 4000, 8000]) {
  await Scenario.execute(`payloadlen/${payloadLen}`,
    async ({ fw, gen }) => {
      for (const port of dir) {
        fw.declareEthPort(port);
      }
      fw.allocFwds(1, nFwds);

      gen.options.nPatterns = nFwds;
      gen.options.payloadLen = payloadLen;
      gen.addTrafficDirection(dir[0], dir[1]);
      gen.addTrafficDirection(dir[1], dir[0]);
    },
  );
}
})();
