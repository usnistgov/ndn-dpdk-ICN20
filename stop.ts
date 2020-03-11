import { getSshConfig } from "./config";
import { Forwarder } from "./fw";
import { TrafficGen } from "./gen";
import { RuntimeDir } from "./runtime-dir";

(async () => {
const runtimeDir = new RuntimeDir();

const fw = new Forwarder(runtimeDir);
await fw.connect(getSshConfig("FW"));
await fw.stop();
await fw.disconnect();

const gen = new TrafficGen(runtimeDir);
await gen.connect(getSshConfig("GEN"));
await gen.stop();
await gen.disconnect();

await runtimeDir.close();
})();
