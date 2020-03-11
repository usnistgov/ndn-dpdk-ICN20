import "hard-rejection/register";

import { RuntimeDir } from "./runtime-dir";
import { FixedRuns, Scenario } from "./scenario";

(async () => {
const runtimeDir = new RuntimeDir();
const scenario = new Scenario(runtimeDir);
await scenario.connect();
const { fw, gen } = scenario;

fw.declareEthPort("B");
fw.declareEthPort("C");
fw.allocFwds(1, 12);
gen.addTrafficDirection("B", "C");
gen.addTrafficDirection("C", "B");

await fw.start();
await gen.initForwarder(fw);
await fw.fillFib(10000);
await gen.start();

await scenario.observe(); // dry-run
await scenario.run(new FixedRuns(5));

await scenario.stopAndDisconnect();
await runtimeDir.close();
})();
