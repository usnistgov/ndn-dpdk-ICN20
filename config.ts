import { makeEnv, parsers } from "@strattadb/environment";
import dotenv from "dotenv";
import type SSH from "node-ssh";
import username from "username";

/** Retrieve array item using letter index A=0,B=1,etc. */
export function atIndex<T>(arr: readonly T[], index: string): T {
  const i = index.charCodeAt(0) - "A".charCodeAt(0);
  if (i < 0 || i >= arr.length) {
    throw new Error("index out of range");
  }
  return arr[i];
}

/** Configured information about a network interface. */
export interface NetifInfo {
  pci: string;
  numa: number;
}

/** Parse netif list in "PCI@numa" format. */
function parseIfList(s: string): NetifInfo[] {
  return s.split(",").map((ifDef) => {
    const m = /^([0-9a-f]{2}[:][0-9a-f]{2}[.][0-9a-f])[@]([0-9])$/.exec(ifDef);
    if (!m) {
      throw new Error(`invalid netif definition: ${ifDef}`);
    }
    return { pci: m[1], numa: parseInt(m[2], 10) };
  });
}

dotenv.config();

export const env = makeEnv({
  MGMT_FW: {
    parser: parsers.string,
    envVarName: "MGMT_FW",
    required: true,
  },
  MGMT_GEN: {
    parser: parsers.string,
    envVarName: "MGMT_GEN",
    required: true,
  },
  HUGE1G_NPAGES: {
    parser: parsers.positiveInteger,
    envVarName: "HUGE1G_NPAGES",
    required: false,
    defaultValue: 64,
  },
  SPDK_PATH: {
    parser: parsers.string,
    envVarName: "SPDK_PATH",
    required: true,
  },
  ENABLE_CPUSET: {
    parser: parsers.boolean,
    envVarName: "ENABLE_CPUSET",
    required: true,
  },
  IF_FW: {
    parser: parseIfList,
    envVarName: "IF_FW",
    required: true,
  },
  IF_GEN: {
    parser: parseIfList,
    envVarName: "IF_GEN",
    required: true,
  },
});

export function getSshConfig(id: string): SSH.ConfigGiven {
  return {
    host: process.env[`SSH_${id}_HOST`] ?? "localhost",
    username: process.env[`SSH_${id}_USER`] ?? username.sync() ?? "root",
    privateKey: process.env[`SSH_${id}_KEY`] ?? `${process.env.HOME}/.ssh/id_rsa`,
  };
}
