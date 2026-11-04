import fs from "node:fs/promises";
import { statSync } from "node:fs";
import path from "node:path";
import { DEFAULT_DAEMON_URL } from "./daemon/config.js";
import { readDaemonRuntimeState } from "./daemon/lifecycle.js";
import { guard, OpenError } from "./cli-open-output.js";
import type { DaemonAccess, DaemonClient } from "./cli-open-session.js";

/**
 * Where the daemon is and which token opens it. The foreground daemon writes no daemon.json, so a
 * URL flag, the defaults, and the token file of the data directory must work without it. The token
 * is returned only to the caller that builds the client; it never reaches an output or an error.
 */

export type DaemonRuntime = { url: string; tokenPath: string };

/** The files discovery reads. Production reads the disk; tests supply their own. */
export type DaemonFiles = {
  readRuntime: (dataDir: string) => Promise<DaemonRuntime | undefined>;
  readText: (filePath: string) => Promise<string | undefined>;
  /** Whether a directory exists. The default data directory checks the workspace's .marc-daemon. */
  dirExists: (dirPath: string) => boolean;
};

export type DiscoveryInput = {
  explicitUrl: string | undefined;
  dataDir: string;
  fallbackToken: string | undefined;
};

export type Discovered = { baseUrl: string; token: string | undefined };

/**
 * URL: the flag or MARC_DAEMON_URL, then the URL in daemon.json, then the default address.
 * Token: the token file that daemon.json names, then <data-dir>/token, then MARC_TOKEN.
 */
export async function discoverDaemon(
  input: DiscoveryInput,
  files: DaemonFiles
): Promise<Discovered> {
  const runtime = await files.readRuntime(input.dataDir);
  const baseUrl = input.explicitUrl ?? runtime?.url ?? DEFAULT_DAEMON_URL;
  const token = await firstToken(
    [runtime?.tokenPath, path.join(input.dataDir, "token")],
    input.fallbackToken,
    files
  );
  return { baseUrl, token };
}

/** The first candidate file that holds a non-empty token, else the fallback when it is set. */
async function firstToken(
  candidates: Array<string | undefined>,
  fallback: string | undefined,
  files: DaemonFiles
): Promise<string | undefined> {
  for (const candidate of candidates) {
    if (candidate === undefined) continue;
    const token = (await files.readText(candidate))?.trim();
    if (token) return token;
  }
  return fallback?.trim() || undefined;
}

export type ConnectInput = {
  explicitUrl: string | undefined;
  dataDir: string;
  env: NodeJS.ProcessEnv;
};

/**
 * Finds the daemon and proves that it accepts the token, before any slot is read. No token, a
 * daemon that does not answer, and a token it refuses each stop marc open with a reason.
 */
export async function connectDaemon(
  input: ConnectInput,
  files: DaemonFiles,
  createClient: (access: DaemonAccess) => DaemonClient
): Promise<DaemonClient> {
  const found = await guard(
    () =>
      discoverDaemon(
        {
          explicitUrl: input.explicitUrl,
          dataDir: input.dataDir,
          fallbackToken: input.env.MARC_TOKEN
        },
        files
      ),
    "daemon_unavailable",
    "daemon_state_unreadable"
  );
  if (found.token === undefined) {
    throw new OpenError("daemon_unavailable", "token_missing");
  }
  const client = createClient({ baseUrl: found.baseUrl, token: found.token });
  await probeDaemon(client);
  return client;
}

/** GET /api/status with the token. 401 means the daemon refuses it; anything else is a failure. */
async function probeDaemon(client: DaemonClient): Promise<void> {
  const reply = await guard(
    () => client.status(),
    "daemon_unavailable",
    "daemon_unreachable"
  );
  if (reply.status === 401) {
    throw new OpenError("daemon_unavailable", "token_rejected");
  }
  if (reply.status !== 200) {
    throw new OpenError("daemon_unavailable", "daemon_error");
  }
}

/** Whether a directory exists. The default data directory checks the workspace's .marc-daemon with it. */
export function isDirectory(dirPath: string): boolean {
  try {
    return statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

export const productionDaemonFiles: DaemonFiles = {
  readRuntime: async (dataDir) => {
    const state = await readDaemonRuntimeState(dataDir);
    return state ? { url: state.url, tokenPath: state.tokenPath } : undefined;
  },
  readText: (filePath) => fs.readFile(filePath, "utf8").catch(() => undefined),
  dirExists: isDirectory
};
