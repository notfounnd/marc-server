import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadDaemonConfig } from "../src/daemon/config.js";
import {
  createRuntimeState,
  getDaemonProcessStatus,
  getDaemonStatus,
  removeDaemonRuntimeState,
  startDetachedDaemon,
  writeDaemonRuntimeState,
} from "../src/daemon/lifecycle.js";
import { createDaemonServer } from "../src/daemon/server.js";
import { DaemonStore } from "../src/daemon/store.js";
import { appendMessage, createThread, initWorkspace, readRules, readThread } from "../src/core/workspace.js";

async function tempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function listen(server: Awaited<ReturnType<typeof createDaemonServer>>): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

test("daemon requires token and serves registered workspace threads", async () => {
  const dataDir = await tempDir("marc-daemon-");
  const workspaceRoot = await tempDir("marc-workspace-");
  const workspace = await initWorkspace(workspaceRoot);
  const thread = await createThread(workspaceRoot, "Daemon visible");
  const olderClosedThread = await createThread(workspaceRoot, "Daemon older closed");
  const newerClosedThread = await createThread(workspaceRoot, "Daemon newer closed");
  await fs.writeFile(
    path.join(workspaceRoot, ".marc", "threads", olderClosedThread.id, "SUMMARY.md"),
    "# Executive Summary\n\nClosed: `2026-05-01T13:00:00.000Z`\n",
  );
  await fs.writeFile(
    path.join(workspaceRoot, ".marc", "threads", newerClosedThread.id, "SUMMARY.md"),
    "# Executive Summary\n\nClosed: `2026-05-02T13:00:00.000Z`\n",
  );
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0 });
  const server = await createDaemonServer(config);
  const baseUrl = await listen(server);

  try {
    const unauthorized = await fetch(`${baseUrl}/api/workspaces`);
    assert.equal(unauthorized.status, 401);

    const register = await fetch(`${baseUrl}/api/workspaces`, {
      method: "POST",
      headers: {
        authorization: "Bearer secret",
        "content-type": "application/json",
      },
      body: JSON.stringify(workspace),
    });
    assert.equal(register.status, 200);

    const status = await fetch(`${baseUrl}/api/status`, {
      headers: { authorization: "Bearer secret" },
    });
    assert.equal(status.status, 200);
    const statusBody = (await status.json()) as {
      ok: boolean;
      modules: {
        daemon: { status: string; mode: string; activeUiClients: number; leases: unknown[] };
        workspaceRegistry: { status: string; workspaceCount: number };
        threadIndex: { status: string; workspaces: Record<string, { status: string; rebuilding: boolean }> };
      };
    };
    assert.equal(statusBody.ok, true);
    assert.equal(statusBody.modules.daemon.status, "ready");
    assert.equal(statusBody.modules.daemon.mode, "foreground");
    assert.equal(statusBody.modules.daemon.activeUiClients, 0);
    assert.deepEqual(statusBody.modules.daemon.leases, []);
    assert.equal(statusBody.modules.workspaceRegistry.workspaceCount, 1);
    assert.equal(statusBody.modules.threadIndex.workspaces[workspace.id].status, "ready");
    assert.equal(statusBody.modules.threadIndex.workspaces[workspace.id].rebuilding, false);

    const threads = await fetch(`${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads`, {
      headers: { authorization: "Bearer secret" },
    });
    assert.equal(threads.status, 200);
    const body = (await threads.json()) as Array<{ id: string }>;
    assert.equal(body[0].id, thread.id);

    const closedThreads = await fetch(`${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads?status=closed`, {
      headers: { authorization: "Bearer secret" },
    });
    assert.equal(closedThreads.status, 200);
    const closedBody = (await closedThreads.json()) as Array<{ id: string; status: string; closedAt: string }>;
    assert.deepEqual(closedBody.map((item) => item.id), [newerClosedThread.id, olderClosedThread.id]);
    assert.equal(closedBody[0].status, "closed");
    assert.equal(closedBody[0].closedAt, "2026-05-02T13:00:00.000Z");

    const uiMessage = await appendMessage(workspaceRoot, thread.id, {
      agentId: "ui-user",
      role: "user",
      body: "Needs a detailed artifact.",
    });
    const artifactResponse = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads/${encodeURIComponent(thread.id)}/messages/${encodeURIComponent(uiMessage.id)}/artifacts`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ fileName: "Long Notes", content: "# Long Notes" }),
      },
    );
    assert.equal(artifactResponse.status, 200);
    assert.deepEqual(await artifactResponse.json(), { artifact: "artifacts/long-notes.md" });
    assert.equal(
      (await readThread(workspaceRoot, thread.id)).messages?.find((message) => message.id === uiMessage.id)?.artifacts[0],
      "artifacts/long-notes.md",
    );

    const readArtifactResponse = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads/${encodeURIComponent(thread.id)}/messages/${encodeURIComponent(uiMessage.id)}/artifacts/${encodeURIComponent("long-notes.md")}`,
      {
        headers: { authorization: "Bearer secret" },
      },
    );
    assert.equal(readArtifactResponse.status, 200);
    assert.deepEqual(await readArtifactResponse.json(), {
      artifact: "artifacts/long-notes.md",
      content: "# Long Notes",
    });

    const unregister = await fetch(`${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}`, {
      method: "DELETE",
      headers: { authorization: "Bearer secret" },
    });
    assert.equal(unregister.status, 200);

    const afterUnregister = await fetch(`${baseUrl}/api/workspaces`, {
      headers: { authorization: "Bearer secret" },
    });
    assert.deepEqual(await afterUnregister.json(), []);
  } finally {
    server.close();
  }
});

test("daemon leases are renewed, exposed in status, and removed", async () => {
  const dataDir = await tempDir("marc-daemon-");
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0 });
  const server = await createDaemonServer(config);
  const baseUrl = await listen(server);

  try {
    const lease = await fetch(`${baseUrl}/api/leases/client-1`, {
      method: "PUT",
      headers: {
        authorization: "Bearer secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agentId: "codex-dev",
        workspaceId: "workspace-1",
        clientType: "mcp",
        ttlMs: 60_000,
      }),
    });
    assert.equal(lease.status, 200);

    const status = await fetch(`${baseUrl}/api/status`, {
      headers: { authorization: "Bearer secret" },
    });
    const body = (await status.json()) as {
      modules: {
        daemon: {
          leases: Array<{ clientId: string; agentId?: string; workspaceId?: string; clientType: string }>;
        };
      };
    };
    assert.deepEqual(body.modules.daemon.leases.map((item) => item.clientId), ["client-1"]);
    assert.equal(body.modules.daemon.leases[0].agentId, "codex-dev");
    assert.equal(body.modules.daemon.leases[0].workspaceId, "workspace-1");
    assert.equal(body.modules.daemon.leases[0].clientType, "mcp");

    const removeLease = await fetch(`${baseUrl}/api/leases/client-1`, {
      method: "DELETE",
      headers: { authorization: "Bearer secret" },
    });
    assert.equal(removeLease.status, 200);

    const statusAfterDelete = await fetch(`${baseUrl}/api/status`, {
      headers: { authorization: "Bearer secret" },
    });
    const bodyAfterDelete = (await statusAfterDelete.json()) as { modules: { daemon: { leases: unknown[] } } };
    assert.deepEqual(bodyAfterDelete.modules.daemon.leases, []);
  } finally {
    server.close();
  }
});

test("daemon store deduplicates workspaces by canonical path", async () => {
  const dataDir = await tempDir("marc-daemon-store-");
  const workspaceRoot = await tempDir("marc-workspace-");
  const workspace = await initWorkspace(workspaceRoot);
  const store = await DaemonStore.open(dataDir);

  await store.upsertWorkspace({
    ...workspace,
    id: "old-id",
  });
  await store.upsertWorkspace({
    ...workspace,
    id: "new-id",
  });

  const workspaces = await store.listWorkspaces();
  assert.deepEqual(
    workspaces.map((item) => item.id),
    ["new-id"],
  );
});

test("daemon runtime status cleans stale pid state", async () => {
  const dataDir = await tempDir("marc-daemon-runtime-");
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0 });
  const state = await createRuntimeState(config);
  await writeDaemonRuntimeState({ ...state, pid: 999_999_999 });

  const status = await getDaemonProcessStatus(config);
  assert.equal(status.status, "stale");

  const afterCleanup = await getDaemonProcessStatus(config);
  assert.equal(afterCleanup.status, "stopped");
  await removeDaemonRuntimeState(dataDir);
});

test("daemon status falls back to API when foreground daemon has no runtime state", async () => {
  const dataDir = await tempDir("marc-daemon-foreground-status-");
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0 });
  const server = await createDaemonServer(config);
  const baseUrl = await listen(server);
  const port = Number(new URL(baseUrl).port);

  try {
    const status = await getDaemonStatus({ ...config, port });
    assert.equal(status.status, "running");
    assert("source" in status);
    assert.equal(status.source, "api");
    assert.equal(status.httpStatus, 200);
    assert.equal(status.daemon.pid, process.pid);
    assert.equal(status.daemon.mode, "foreground");
    assert.equal(status.daemon.dataDir, dataDir);
  } finally {
    server.close();
  }
});

test("daemon start is idempotent when the same fingerprint is already running", async () => {
  const dataDir = await tempDir("marc-daemon-idempotent-");
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0, mode: "detached" });
  const state = await createRuntimeState(config);
  await writeDaemonRuntimeState(state);

  try {
    const result = await startDetachedDaemon(config);
    assert.equal(result.action, "already-running");
    assert.equal(result.status.state.pid, process.pid);
    assert.equal(result.status.fingerprintMatches, true);
  } finally {
    await removeDaemonRuntimeState(dataDir);
  }
});

test("detached daemon auto-idles when there are no leases, UI clients, or activity", async () => {
  const dataDir = await tempDir("marc-daemon-idle-");
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0, mode: "detached", autoIdleMs: 20 });
  const server = await createDaemonServer(config);
  const baseUrl = await listen(server);

  const closed = new Promise<void>((resolve) => server.on("close", resolve));
  const status = await fetch(`${baseUrl}/api/status`, {
    headers: { authorization: "Bearer secret" },
  });
  assert.equal(status.status, 200);

  await closed;
});

test("posting a UI message does not modify RULES.md", async () => {
  const dataDir = await tempDir("marc-daemon-");
  const workspaceRoot = await tempDir("marc-workspace-");
  const workspace = await initWorkspace(workspaceRoot);
  const thread = await createThread(workspaceRoot, "UI message");
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0 });
  const server = await createDaemonServer(config);
  const baseUrl = await listen(server);

  try {
    const register = await fetch(`${baseUrl}/api/workspaces`, {
      method: "POST",
      headers: {
        authorization: "Bearer secret",
        "content-type": "application/json",
      },
      body: JSON.stringify(workspace),
    });
    assert.equal(register.status, 200);

    const beforeRules = await readRules(workspaceRoot);
    const post = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads/${encodeURIComponent(thread.id)}`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agentId: "ui-user",
          displayName: "ui-user",
          role: "user",
          message: "Posted from the UI.",
        }),
      },
    );
    assert.equal(post.status, 200);

    const afterRules = await readRules(workspaceRoot);
    const profile = await fs.readFile(path.join(workspaceRoot, ".marc", "agents", "ui-user.md"), "utf8");

    assert.equal(afterRules, beforeRules);
    assert.match(profile, /^# ui-user$/m);
    assert.match(profile, /ID: `ui-user`/);
    assert.match(profile, /^Role: user$/m);
    assert.match(profile, /^Model: human$/m);
    assert.match(profile, /^Description: Posted from the mARC web UI\.$/m);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
