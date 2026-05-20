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
  writeDaemonRuntimeState
} from "../src/daemon/lifecycle.js";
import { createDaemonServer } from "../src/daemon/server.js";
import { DaemonStore } from "../src/daemon/store.js";
import {
  createThread,
  initWorkspace,
  readRules
} from "../src/core/workspace.js";

async function tempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function listen(
  server: Awaited<ReturnType<typeof createDaemonServer>>
): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

test("daemon store deduplicates workspaces by canonical path", async () => {
  const dataDir = await tempDir("marc-daemon-store-");
  const workspaceRoot = await tempDir("marc-workspace-");
  const workspace = await initWorkspace(workspaceRoot);
  const store = await DaemonStore.open(dataDir);

  await store.upsertWorkspace({
    ...workspace,
    id: "old-id"
  });
  await store.upsertWorkspace({
    ...workspace,
    id: "new-id"
  });

  const workspaces = await store.listWorkspaces();
  assert.deepEqual(
    workspaces.map((item) => item.id),
    ["new-id"]
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
  const config = await loadDaemonConfig({
    dataDir,
    token: "secret",
    port: 0,
    mode: "detached"
  });
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
  const config = await loadDaemonConfig({
    dataDir,
    token: "secret",
    port: 0,
    mode: "detached",
    autoIdleMs: 20
  });
  const server = await createDaemonServer(config);
  const baseUrl = await listen(server);

  const closed = new Promise<void>((resolve) => server.on("close", resolve));
  const status = await fetch(`${baseUrl}/api/status`, {
    headers: { authorization: "Bearer secret" }
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
        "content-type": "application/json"
      },
      body: JSON.stringify(workspace)
    });
    assert.equal(register.status, 200);

    const beforeRules = await readRules(workspaceRoot);
    const post = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads/${encodeURIComponent(thread.id)}`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          agentId: "ui-user",
          displayName: "ui-user",
          role: "user",
          message: "Posted from the UI."
        })
      }
    );
    assert.equal(post.status, 200);

    const afterRules = await readRules(workspaceRoot);
    const profile = await fs.readFile(
      path.join(workspaceRoot, ".marc", "agents", "ui-user.md"),
      "utf8"
    );

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
