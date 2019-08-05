import Debug = require("debug");
import getStream from "get-stream";
import objectPath = require("object-path");

const debug = Debug("json-get");

getStream(process.stdin)
.then(JSON.parse)
.then((doc) => {
  const obj = objectPath.get(doc, process.argv[2]);
  const output = JSON.stringify(obj);
  process.stdout.write(output);
})
.catch(debug);
