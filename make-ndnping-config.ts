import Debug = require("debug");
import * as ping from "@usnistgov/ndn-dpdk/app/ping/mod.js";
import * as pingclient from "@usnistgov/ndn-dpdk/app/pingclient/mod.js";
import * as pingserver from "@usnistgov/ndn-dpdk/app/pingserver/mod.js";
import * as iface from "@usnistgov/ndn-dpdk/iface/mod.js";
import getStream from "get-stream";
import * as yaml from "js-yaml";

const debug = Debug("make-ndnping-config");

interface TrafficDirection {
  clientName: string;
  clientIndex: number;
  serverName: string;
  serverIndex: number;
}

function parseTrafficDirection(input: string, nFaces: number): TrafficDirection {
  if (input.length !== 2) {
    throw new Error(`invalid traffic direction: ${input}`);
  }
  const asciiA = "A".charCodeAt(0);
  const td: TrafficDirection = {
    clientName: input[0],
    clientIndex: input.charCodeAt(0) - asciiA,
    serverName: input[1],
    serverIndex: input.charCodeAt(1) - asciiA,
  };
  if (td.clientIndex < 0 || td.clientIndex >= nFaces) {
    throw new Error(`client out of range in: ${input}`);
  }
  if (td.serverIndex < 0 || td.serverIndex >= nFaces) {
    throw new Error(`server out of range in: ${input}`);
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

function makeNdnpingConfig(a: Args): ping.AppConfig {
  const cfg: ping.AppConfig = a.faces.map((loc) => ({ Face: loc } as ping.TaskConfig));
  const needServers = {} as { [serverName: string]: number };

  a.dirs.forEach((dir) => {
    const td = parseTrafficDirection(dir, a.faces.length);
    needServers[td.serverName] = td.serverIndex;

    const client = cfg[td.clientIndex].Client =
      cfg[td.clientIndex].Client || {
        Patterns: [],
        Interval: a.interval,
      } as pingclient.Config;

    for (let i = 0; i < a.nPatterns; ++i) {
      const prefix = `/${td.serverName}/${i}/${td.clientName}${"/-".repeat(Math.max(0, a.interestNameLen - 4))}`;

      client.Patterns.push({
        Weight: a.cacheHit ? a.cacheHit.weight0 : 1,
        Prefix: prefix,
        CanBePrefix: a.dataSuffixLen > 0,
        MustBeFresh: true,
        InterestLifetime: 1000,
        HopLimit: 64,
      } as pingclient.Pattern);

      if (a.cacheHit) {
        client.Patterns.push({
          Weight: a.cacheHit.weight1,
          Prefix: prefix,
          CanBePrefix: a.dataSuffixLen > 0,
          MustBeFresh: false,
          InterestLifetime: 1000,
          HopLimit: 64,
          SeqNumOffset: a.cacheHit.offset,
        } as pingclient.Pattern);
      }
    }
  });

  for (const [serverName, serverIndex] of Object.entries(needServers)) {
    const server = cfg[serverIndex].Server = {
      Patterns: [],
      Nack: true,
    } as pingserver.Config;
    for (let i = 0; i < a.nPatterns; ++i) {
      const prefix = `/${serverName}/${i}`;
      const suffix = "/_".repeat(a.dataSuffixLen);
      server.Patterns.push({
        Prefix: prefix,
        Replies: [
          {
            Weight: 1,
            Suffix: suffix,
            FreshnessPeriod: 4000,
            PayloadLen: a.payloadLen,
          },
        ],
      } as pingserver.Pattern);
    }
  }

  return cfg.filter((task) => task.Client || task.Server);
}

getStream(process.stdin)
.then((str) => yaml.safeLoad(str) as Args)
.then(makeNdnpingConfig)
.then((doc) => {
  const output = yaml.safeDump(doc);
  process.stdout.write(output);
})
.catch(debug);
