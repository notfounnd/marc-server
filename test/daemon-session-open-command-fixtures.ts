import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadDaemonConfig } from "../src/daemon/config.js";
import { createDaemonServer } from "../src/daemon/server.js";
import { recallMemory } from "../src/core/workspace-memory.js";
import { HOST, NOW, iso } from "./daemon-session-fixtures.js";
import {
  MARC_RUNTIME,
  TOKEN,
  type Started
} from "./daemon-session-http-fixtures.js";

export const SESSION_ID = "route-session";

/** A daemon whose agents runner reports the given `claude agents --json` output. */
export async function startDaemonWithAgents(
  agentsJson: string
): Promise<Started> {
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-open-command-routes-")
  );
  const config = await loadDaemonConfig({ dataDir, token: TOKEN, port: 0 });
  const server = await createDaemonServer(config, {
    memoryRecall: recallMemory,
    presence: {
      hostId: HOST,
      now: () => NOW,
      runAgents: async () => agentsJson
    },
    registry: {
      now: () => iso(NOW),
      newOwnerToken: () => "route-owner-token",
      newSessionId: () => SESSION_ID
    },
    marcRuntime: () => MARC_RUNTIME
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    dataDir,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      })
  };
}

/** One process entry in the shape `claude agents --json` prints. */
export function agentsJson(
  ...processes: Array<{ pid: number; startedAt: number; sessionId: string }>
): string {
  return JSON.stringify(
    processes.map((process) => ({ ...process, status: "idle" }))
  );
}
