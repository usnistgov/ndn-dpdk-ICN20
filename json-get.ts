import Debug = require("debug");
import getStream from "get-stream";
import objectPath = require("object-path");
import * as yaml from "js-yaml";

const debug = Debug("json-get");

getStream(process.stdin)
.then((str) => yaml.safeLoad(str))
.then((doc) => {
  const obj = objectPath.get(doc, process.argv[2]);
  const output = JSON.stringify(obj);
  process.stdout.write(output);
})
.catch(debug);
