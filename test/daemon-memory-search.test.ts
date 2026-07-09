import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadDaemonConfig } from "../src/daemon/config.js";
import { createDaemonServer } from "../src/daemon/server.js";
import { initWorkspace } from "../src/core/workspace.js";

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

test("daemon validates memory recall queries", async () => {
  const dataDir = await tempDir("marc-daemon-");
  const workspaceRoot = await tempDir("marc-workspace-");
  const workspace = await initWorkspace(workspaceRoot);
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0 });
  const server = await createDaemonServer(config);
  const baseUrl = await listen(server);

  try {
    await registerWorkspace(baseUrl, workspace);
    const recall = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/memory/recall`,
      {
        body: JSON.stringify({ query: "   " }),
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json"
        },
        method: "POST"
      }
    );
    assert.equal(recall.status, 400);
    assert.equal(await recall.text(), "Search query is required");
  } finally {
    server.close();
  }
});

test("daemon exposes memory recall without an agent connection", async () => {
  const dataDir = await tempDir("marc-daemon-");
  const workspaceRoot = await tempDir("marc-workspace-");
  const workspace = await initWorkspace(workspaceRoot);
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0 });
  const server = await createDaemonServer(config);
  const baseUrl = await listen(server);

  try {
    await registerWorkspace(baseUrl, workspace);
    const recall = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/memory/recall`,
      {
        body: JSON.stringify({ query: "token rotation" }),
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json"
        },
        method: "POST"
      }
    );
    assert.equal(recall.status, 200);
    const body = (await recall.json()) as {
      indexStatus: { status: string };
      nextActions: string[];
      results: unknown[];
    };
    assert.equal(body.indexStatus.status, "model_missing");
    assert.deepEqual(body.results, []);
    assert.deepEqual(body.nextActions, [
      "Run memory_prepare before using memory_recall."
    ]);
  } finally {
    server.close();
  }
});

async function registerWorkspace(
  baseUrl: string,
  workspace: Awaited<ReturnType<typeof initWorkspace>>
): Promise<void> {
  const register = await fetch(`${baseUrl}/api/workspaces`, {
    body: JSON.stringify(workspace),
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json"
    },
    method: "POST"
  });
  assert.equal(register.status, 200);
}
