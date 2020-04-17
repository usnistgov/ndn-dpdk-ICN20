import "hard-rejection/register";

import ProgressBar from "progress";

import { Scenario } from "./scenario";

const dir = "BC";
const nFwds = 8;

(async () => {
for (const fibCount of [1e4, 1e5, 1e6]) {
  await Scenario.execute(`fib/${fibCount}`,
    async ({ fw, gen }) => {
      for (const port of dir) {
        fw.declareEthPort(port);
      }
      fw.allocFwds(1, nFwds);

      gen.options.nPatterns = nFwds;
      gen.addTrafficDirection(dir[0], dir[1]);
      gen.addTrafficDirection(dir[1], dir[0]);
    },
    async ({ fw }) => {
      const p = fw.fillFib(fibCount);
      const progress = new ProgressBar("FIB :bar :current/:total :rate/s :elapseds ETA:etas ", { total: fibCount });
      p.onProgress((pct) => progress.update(pct));
      await p;
      progress.terminate();
    },
  );
}
})();
