import Debug = require("debug");
import getStream from "get-stream";
import * as yaml from "js-yaml";
import * as util from "util";

import * as ndnping from "ndn-dpdk/app/ndnping";
import * as iface from "ndn-dpdk/iface";

const debug = Debug("make-ndnping-config");

interface TrafficDirection {
  clientName: string;
  clientIndex: number;
  serverName: string;
  serverIndex: number;
}

function parseTrafficDirection(input: string, nFaces: number): TrafficDirection {
  if (input.length !== 2) {
    throw new Error("invalid traffic direction: " + input);
  }
  const asciiA = "A".charCodeAt(0);
  const td: TrafficDirection = {
    clientName: input[0],
    clientIndex: input.charCodeAt(0) - asciiA,
    serverName: input[1],
    serverIndex: input.charCodeAt(1) - asciiA,
  };
  if (td.clientIndex < 0 || td.clientIndex >= nFaces) {
    throw new Error("client out of range in: " + input);
  }
  if (td.serverIndex < 0 || td.serverIndex >= nFaces) {
    throw new Error("server out of range in: " + input);
  }
  return td;
}

interface CacheHitArg {
  // weight of primary pattern
  weight0: number;
  // weight of secondary pattern
  weight1: number;
  // sequence number offset
  offset: number;
}

interface Args {
  // face locators
  faces: iface.Locator[];
  // traffic direction, example: ["AB", "BC", "CA"]
  dirs: string[];
  // initial Interest interval (nanos)
  interval: number;
  // number of patterns per traffic direction
  nPatterns: number;
  // Interest name length including sequence number, minimum 4
  interestNameLen: number;
  // allow some cache hits
  cacheHit?: CacheHitArg;
  // Data suffix length, appended to Interest names
  dataSuffixLen: number;
  // Content payload length
  payloadLen: number;
}

function makeNdnpingConfig(a: Args): ndnping.AppConfig {
  const cfg: ndnping.AppConfig = a.faces.map((loc) => ({ Face: loc } as ndnping.TaskConfig));
  const needServers = {} as { [serverName: string]: number };

  a.dirs.forEach((dir) => {
    const td = parseTrafficDirection(dir, a.faces.length);
    needServers[td.serverName] = td.serverIndex;

    const client = cfg[td.clientIndex].Client =
      cfg[td.clientIndex].Client || {
        Patterns: [],
        Interval: a.interval,
      } as ndnping.ClientConfig;

    for (let i = 0; i < a.nPatterns; ++i) {
      const prefix = util.format("/%s/%d/%s%s", td.serverName, i, td.clientName,
                                 "/-".repeat(Math.max(0, a.interestNameLen - 4)));

      client.Patterns.push({
        Weight: a.cacheHit ? a.cacheHit.weight0 : 1,
        Prefix: prefix,
        CanBePrefix: a.dataSuffixLen > 0,
        MustBeFresh: true,
        InterestLifetime: 1E9,
        HopLimit: 64,
      } as ndnping.ClientPattern);

      if (a.cacheHit) {
        client.Patterns.push({
          Weight: a.cacheHit.weight1,
          Prefix: prefix,
          CanBePrefix: a.dataSuffixLen > 0,
          MustBeFresh: false,
          InterestLifetime: 1E9,
          HopLimit: 64,
          SeqNumOffset: a.cacheHit.offset,
        } as ndnping.ClientPattern);
      }
    }
  });

  for (const [serverName, serverIndex] of Object.entries(needServers)) {
    const server = cfg[serverIndex].Server = {
      Patterns: [],
      Nack: true,
    } as ndnping.ServerConfig;
    for (let i = 0; i < a.nPatterns; ++i) {
      const prefix = util.format("/%s/%d", serverName, i);
      const suffix = "/_".repeat(a.dataSuffixLen);
      // https://github.com/palantir/tslint/issues/3586
      // tslint:disable:object-literal-sort-keys
      server.Patterns.push({
        Prefix: prefix,
        Replies: [
          {
            Weight: 1,
            Suffix: suffix,
            FreshnessPeriod: 4E9,
            PayloadLen: a.payloadLen,
          },
        ],
      } as ndnping.ServerPattern);
      // tslint:enable:object-literal-sort-keys
    }
  }

  return cfg.filter((task) => task.Client || task.Server);
}

function keys2LowerCase(input: any): any {
  if (Array.isArray(input)) {
    return input.map(keys2LowerCase);
  }
  if (typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(
        ([k, v]: [string, any]) => [k.toLowerCase(), keys2LowerCase(v)],
      ),
    );
  }
  return input;
}

getStream(process.stdin)
.then((str) => yaml.safeLoad(str) as Args)
.then(makeNdnpingConfig)
.then(keys2LowerCase)
.then((doc) => {
  const output = yaml.safeDump(doc);
  process.stdout.write(output);
})
.catch(debug);
