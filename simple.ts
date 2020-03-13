import "hard-rejection/register";

import { Scenario } from "./scenario";

(async () => {
await Scenario.execute("simple",
  async ({ fw, gen }) => {
    fw.declareEthPort("B");
    fw.declareEthPort("C");
    fw.allocFwds(1, 12);
    gen.addTrafficDirection("B", "C");
    gen.addTrafficDirection("C", "B");
  },
  async ({ fw }) => {
    await fw.fillFib(10000);
  },
);
})();
