import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadDaemonConfig } from "../src/daemon/config.js";
import {
  createDaemonServer,
  type DaemonServerDependencies
} from "../src/daemon/server.js";
import { initWorkspace } from "../src/core/workspace.js";
import {
  rebuildMemoryInWorkspace,
  recallMemoryInWorkspace,
  type MemoryRecallResult
} from "../src/core/memory/index.js";
import { memoryBandOf } from "../src/core/memory/scoring/bands.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  ScoreOverrideStore,
  writeSummary
} from "./memory-test-helpers.js";

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

    const invalidMode = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/memory/recall`,
      {
        body: JSON.stringify({ query: "toggle", queryMode: "deep" }),
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json"
        },
        method: "POST"
      }
    );
    assert.equal(invalidMode.status, 400);
    assert.equal(
      await invalidMode.text(),
      "Memory query mode must be auto or literal"
    );
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
      abstained: boolean;
    };
    assert.equal(body.indexStatus.status, "model_missing");
    assert.deepEqual(body.results, []);
    assert.equal(body.abstained, false);
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

/** A daemon whose recall runs the core with fake providers, over one admitted thread. */
async function withAdmittedThreadDaemon(
  run: (baseUrl: string, workspaceId: string) => Promise<void>
): Promise<void> {
  const dataDir = await tempDir("marc-daemon-");
  const workspaceRoot = await tempDir("marc-workspace-");
  const workspace = await initWorkspace(workspaceRoot);
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const store = new ScoreOverrideStore({ "thread-toggle": 0.9 });
  await writeSummary(
    workspace,
    "thread-toggle",
    summaryDocument("thread-toggle", "Toggle settings")
  );
  await rebuildMemoryInWorkspace(workspace, { provider, reranker, store });
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0 });
  const dependencies: DaemonServerDependencies = {
    memoryRecall: (_rootPath, input) =>
      recallMemoryInWorkspace(workspace, {
        limit: input.limit,
        provider,
        query: input.query,
        queryMode: input.queryMode,
        reranker,
        store
      })
  };
  const server = await createDaemonServer(config, dependencies);
  const baseUrl = await listen(server);

  try {
    await registerWorkspace(baseUrl, workspace);
    await run(baseUrl, workspace.id);
  } finally {
    server.close();
  }
}

function summaryDocument(threadId: string, content: string): string {
  return [
    `# Summary - ${content}`,
    "",
    `Thread: \`${threadId}\``,
    "",
    "## Result",
    "",
    `- ${content}`
  ].join("\n");
}

async function postRecall(
  baseUrl: string,
  workspaceId: string,
  body: Record<string, unknown>
): Promise<MemoryRecallResult> {
  const response = await fetch(
    `${baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/memory/recall`,
    {
      body: JSON.stringify(body),
      headers: {
        authorization: "Bearer secret",
        "content-type": "application/json"
      },
      method: "POST"
    }
  );
  assert.equal(response.status, 200);
  return (await response.json()) as MemoryRecallResult;
}

test("daemon recall returns banded hits that are not abstained", async () => {
  await withAdmittedThreadDaemon(async (baseUrl, workspaceId) => {
    const recall = await postRecall(baseUrl, workspaceId, { query: "toogle" });

    assert.equal(recall.results.length, 1);
    assert.deepEqual(
      recall.results.map((hit) => hit.band),
      recall.results.map((hit) => memoryBandOf(hit.score))
    );
    assert.equal(recall.abstained, false);
  });
});

test("daemon recall rejects a limit that is not a positive integer, as MCP does", async () => {
  await withAdmittedThreadDaemon(async (baseUrl, workspaceId) => {
    const response = await postRaw(baseUrl, workspaceId, {
      limit: 0,
      query: "toogle"
    });

    assert.equal(response.status, 400);
    assert.match(
      await response.text(),
      /Memory search limit must be a positive integer/
    );
  });
});

test("daemon recall rejects depth 3 with the layer explanation", async () => {
  await withAdmittedThreadDaemon(async (baseUrl, workspaceId) => {
    const response = await postRaw(baseUrl, workspaceId, {
      depth: 3,
      query: "toogle"
    });

    assert.equal(response.status, 400);
    assert.match(
      await response.text(),
      /Memory search depth counts corpus layers/
    );
  });
});

function postRaw(
  baseUrl: string,
  workspaceId: string,
  body: Record<string, unknown>
): Promise<Response> {
  return fetch(
    `${baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/memory/recall`,
    {
      body: JSON.stringify(body),
      headers: {
        authorization: "Bearer secret",
        "content-type": "application/json"
      },
      method: "POST"
    }
  );
}
