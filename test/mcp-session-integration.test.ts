import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadDaemonConfig } from "../src/daemon/config.js";
import { createDaemonServer } from "../src/daemon/server.js";
import { recallMemory } from "../src/core/workspace-memory.js";
import {
  createThread,
  initWorkspace,
  registerAgent
} from "../src/core/workspace.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import {
  sampleFor,
  startSessionClient,
  type SessionClient
} from "./mcp-session-fixtures.js";

const TOKEN = "mcp-session-secret";
const ARCHITECT = "claude-software-architect";
const SESSION_A = "aaaaaaaa-1111-4111-8111-111111111111";
const SESSION_B = "bbbbbbbb-2222-4222-8222-222222222222";
const STARTED_A = 1_793_747_271_627;
const STARTED_B = 1_793_747_271_700;
const OTHER_PARENT = 4242;

type SlotView = {
  slots: Array<{
    profile: string;
    state: string;
    binding: {
      origin: string;
      generation: number;
      conflicts: unknown[];
    } | null;
  }>;
};

test("a real MCP session is adopted on message_post and a second session records a conflict", async (t) => {
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-mcp-session-data-")
  );
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marc-mcp-session-ws-"));
  const config = await loadDaemonConfig({ dataDir, token: TOKEN, port: 0 });
  // The MCP children of this test share its pid as parent. That pid is listed as SESSION_A with a
  // start time, so the first adoption is verified. SESSION_B has its own parent pid.
  const listing = [
    {
      pid: process.pid,
      startedAt: STARTED_A,
      sessionId: SESSION_A,
      status: "idle"
    },
    {
      pid: OTHER_PARENT,
      startedAt: STARTED_B,
      sessionId: SESSION_B,
      status: "idle"
    }
  ];
  const server = await createDaemonServer(config, {
    memoryRecall: recallMemory,
    presence: { runAgents: async () => JSON.stringify(listing) }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const info: WorkspaceInfo = await initWorkspace(root);
  const thread = await createThread(root, "MCP session integration");
  await registerAgent(root, {
    id: ARCHITECT,
    role: "architect",
    model: "claude-opus-5-5",
    description: "Architect profile for MCP session integration."
  });
  await fetch(`${baseUrl}/api/workspaces`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(info)
  });

  const clients: SessionClient[] = [];
  t.after(async () => {
    for (const client of clients) await client.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const slotView = async (): Promise<SlotView> => {
    const response = await fetch(
      `${baseUrl}/api/workspaces/${info.id}/threads/${thread.id}/sessions`,
      { headers: { authorization: `Bearer ${TOKEN}` } }
    );
    return (await response.json()) as SlotView;
  };
  const architectSlot = async () =>
    (await slotView()).slots.find((slot) => slot.profile === ARCHITECT);

  const first = await startSessionClient({
    workspace: root,
    daemonUrl: baseUrl,
    token: TOKEN,
    sessionId: SESSION_A
  });
  clients.push(first);
  await first.call("workspace_bootstrap", {});
  const leases = await sampleFor(20, 50, async () => {
    const status = await fetch(`${baseUrl}/api/status`, {
      headers: { authorization: `Bearer ${TOKEN}` }
    });
    return (await status.json()) as {
      modules: {
        daemon: {
          leases: Array<{ nativeSessionId?: string; identifiedAt?: string }>;
        };
      };
    };
  });
  const identified = leases
    .at(-1)
    ?.modules.daemon.leases.find(
      (lease) => lease.nativeSessionId === SESSION_A
    );
  assert.ok(
    identified?.identifiedAt,
    "bootstrap should mark the lease identified"
  );

  await first.call("message_post", {
    threadId: thread.id,
    agentId: ARCHITECT,
    role: "architect",
    body: "Primeira sessão",
    bootstrapConfirmed: true
  });
  const adopted = await sampleFor(40, 50, architectSlot);
  const adoptedBinding = adopted.at(-1)?.binding;
  assert.equal(adoptedBinding?.origin, "adopted");
  assert.equal(adoptedBinding?.generation, 1);
  assert.equal(adoptedBinding?.conflicts.length, 0);

  // A second MCP client here would share the same parent pid and resolve to SESSION_A, so the
  // second session is observed over HTTP with its own parent, listed as SESSION_B.
  const observed = await fetch(`${baseUrl}/api/sessions/observe`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      workspaceId: info.id,
      threadId: thread.id,
      agentId: ARCHITECT,
      observedAt: new Date().toISOString(),
      identity: {
        nativeSessionId: SESSION_B,
        pid: OTHER_PARENT,
        ppid: OTHER_PARENT,
        hostId: os.hostname()
      }
    })
  });
  assert.equal(observed.status, 200);
  const conflicted = await sampleFor(40, 50, architectSlot);
  assert.equal(conflicted.at(-1)?.binding?.conflicts.length, 1);
  assert.equal(conflicted.at(-1)?.binding?.generation, 1);
  assert.equal(conflicted.at(-1)?.binding?.origin, "adopted");

  const body = JSON.stringify(await slotView());
  assert.ok(
    !body.includes("ownerToken"),
    "the owner token must never appear in a view"
  );
});
