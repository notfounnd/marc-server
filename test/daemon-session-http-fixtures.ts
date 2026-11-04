import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { loadDaemonConfig } from "../src/daemon/config.js";
import { createDaemonServer } from "../src/daemon/server.js";
import { recallMemory } from "../src/core/workspace-memory.js";
import {
  createThread,
  initWorkspace,
  registerAgent
} from "../src/core/workspace.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import type { MarcRuntime } from "../src/mcp/listening-command.js";
import { HOST, NOW, iso } from "./daemon-session-fixtures.js";

export const TOKEN = "route-secret";
export const ARCHITECT = "claude-software-architect";

/** The runtime the copied commands start from. It is fixed, so no test depends on how it was started. */
export const MARC_RUNTIME: MarcRuntime = {
  execPath: "/usr/bin/node",
  execArgv: [],
  script: "/srv/marc/dist/cli.js"
};

export type Started = {
  baseUrl: string;
  dataDir: string;
  close: () => Promise<void>;
};

/** A daemon with a fixed clock and an agents runner that reports no live process. */
export async function startDaemon(): Promise<Started> {
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-session-routes-")
  );
  const config = await loadDaemonConfig({ dataDir, token: TOKEN, port: 0 });
  const server = await createDaemonServer(config, {
    memoryRecall: recallMemory,
    presence: {
      hostId: HOST,
      now: () => NOW,
      runAgents: async () => "[]"
    },
    registry: {
      now: () => iso(NOW),
      newOwnerToken: () => "route-owner-token",
      newSessionId: () => "route-session"
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

export type Reply = { status: number; text: string };

export function send(
  baseUrl: string,
  method: string,
  pathname: string,
  body: unknown = null
): Promise<Reply> {
  return exchange(baseUrl, method, pathname, JSON.stringify(body));
}

/** A GET request, which carries no body. */
export function get(baseUrl: string, pathname: string): Promise<Reply> {
  return exchange(baseUrl, "GET", pathname, undefined);
}

function exchange(
  baseUrl: string,
  method: string,
  pathname: string,
  payload: string | undefined
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      `${baseUrl}${pathname}`,
      {
        method,
        headers: {
          authorization: `Bearer ${TOKEN}`,
          "content-type": "application/json"
        }
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8")
          })
        );
      }
    );
    request.on("error", reject);
    request.end(payload);
  });
}

export async function workspaceWithThread(): Promise<{
  root: string;
  info: WorkspaceInfo;
  threadId: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marc-session-ws-"));
  const info = await initWorkspace(root);
  const thread = await createThread(root, "Sessions view");
  await registerAgent(root, {
    id: "claude-dev",
    role: "developer",
    model: "claude-haiku-5-5",
    description: "Developer profile for session route tests."
  });
  await registerAgent(root, {
    id: ARCHITECT,
    role: "architect",
    model: "claude-opus-5-5",
    description: "Architect profile for session route tests."
  });
  await registerAgent(root, {
    id: "ui-user",
    role: "user",
    model: "human",
    description: "Human profile for session route tests."
  });
  return { root, info, threadId: thread.id };
}

export async function registered(
  daemon: Started,
  info: WorkspaceInfo
): Promise<void> {
  const reply = await send(daemon.baseUrl, "POST", "/api/workspaces", info);
  assert.equal(reply.status, 200);
}
