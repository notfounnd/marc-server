import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initWorkspace } from "../src/core/workspace.js";
import { loadDaemonConfig } from "../src/daemon/config.js";
import { createDaemonServer } from "../src/daemon/server.js";

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

test("daemon exposes workspace memory settings and status health", async () => {
  const dataDir = await tempDir("marc-daemon-");
  const workspaceRoot = await tempDir("marc-workspace-");
  const workspace = await initWorkspace(workspaceRoot);
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0 });
  const server = await createDaemonServer(config);
  const baseUrl = await listen(server);

  try {
    await registerWorkspace(baseUrl, workspace);
    const encodedWorkspace = encodeURIComponent(workspace.id);
    const initialSettings = await fetchJson<{
      memory: {
        autoRebuild: boolean;
        embeddingBatchSize: number;
        searchRetryDepth: number;
      };
    }>(`${baseUrl}/api/workspaces/${encodedWorkspace}/settings`);

    assert.equal(initialSettings.memory.autoRebuild, true);
    assert.equal(initialSettings.memory.embeddingBatchSize, 4);
    assert.equal(initialSettings.memory.searchRetryDepth, 0);

    const updatedSettings = await postJson<{
      memory: {
        autoRebuild: boolean;
        embeddingBatchSize: number;
        searchRetryDepth: number;
      };
    }>(`${baseUrl}/api/workspaces/${encodedWorkspace}/settings`, {
      memory: {
        autoRebuild: false,
        embeddingBatchSize: 8,
        searchRetryDepth: 2
      }
    });

    assert.equal(updatedSettings.memory.autoRebuild, false);
    assert.equal(updatedSettings.memory.embeddingBatchSize, 8);
    assert.equal(updatedSettings.memory.searchRetryDepth, 2);

    const status = await fetchJson<{
      modules: {
        memory: {
          workspaces: Record<
            string,
            {
              autoRebuild: boolean;
              embeddingBatchSize: number;
              lastError: string | null;
              preparing: boolean;
              rebuilding: boolean;
            }
          >;
        };
      };
    }>(`${baseUrl}/api/status`);

    assert.equal(
      status.modules.memory.workspaces[workspace.id].autoRebuild,
      false
    );
    assert.equal(
      status.modules.memory.workspaces[workspace.id].embeddingBatchSize,
      8
    );
    assert.equal(
      status.modules.memory.workspaces[workspace.id].preparing,
      false
    );
    assert.equal(
      status.modules.memory.workspaces[workspace.id].rebuilding,
      false
    );
    assert.equal(
      status.modules.memory.workspaces[workspace.id].lastError,
      null
    );
  } finally {
    server.close();
  }
});

test("daemon rejects manual memory rebuild while the model is missing", async () => {
  const dataDir = await tempDir("marc-daemon-");
  const workspaceRoot = await tempDir("marc-workspace-");
  const workspace = await initWorkspace(workspaceRoot);
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0 });
  const server = await createDaemonServer(config);
  const baseUrl = await listen(server);

  try {
    await registerWorkspace(baseUrl, workspace);
    const response = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/memory/rebuild`,
      {
        headers: { authorization: "Bearer secret" },
        method: "POST"
      }
    );

    assert.equal(response.status, 409);
    assert.equal(await response.text(), "Memory model is not prepared");
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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { authorization: "Bearer secret" }
  });
  assert.equal(response.status, 200);
  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json"
    },
    method: "POST"
  });
  assert.equal(response.status, 200);
  return response.json() as Promise<T>;
}
