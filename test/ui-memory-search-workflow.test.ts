import assert from "node:assert/strict";
import test from "node:test";
import {
  isCurrentMemorySearchRequest,
  MEMORY_SEARCH_STORAGE_KEY,
  readStoredMemorySearchState,
  recallMemorySearchDepths,
  writeStoredMemorySearchState
} from "../src/ui/memory-search.js";
import {
  automaticMemorySearchDepths,
  nextMemorySearchDepth
} from "../src/ui/memory-search-depth.js";
import type { MemoryRecallResult } from "../src/ui/types.js";

type MemorySearchDepth = 0 | 1 | 2 | 3;

type RecallRequest = {
  depth: MemorySearchDepth;
  query: string;
  queryMode: "auto" | "literal";
};

const recallResult: MemoryRecallResult = {
  interpretation: {
    correctionApplied: false,
    effectiveQuery: "token rotation",
    mode: "auto",
    originalQuery: "token rotation"
  },
  indexStatus: {
    autoRebuild: true,
    embeddingBatchSize: 4,
    indexedSummaryCount: 1,
    interpreterPrepared: true,
    lastError: null,
    message: "Memory index is current.",
    modelPrepared: true,
    preparing: false,
    ready: true,
    rebuildReady: true,
    rebuilding: false,
    rerankerPrepared: true,
    retrieverPrepared: true,
    searchReady: true,
    searchRetryDepth: 0,
    stale: false,
    status: "ready",
    summaryCount: 1
  },
  nextActions: [],
  query: "token rotation",
  results: [
    {
      closedAt: "2026-05-24T23:15:59.807Z",
      matchedText: "Token rotation was already discussed in the daemon model.",
      reason: "Matched summary in token rotation.",
      reference:
        "marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
      score: 0.82,
      summaryPath:
        "threads/oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3/SUMMARY.md",
      threadId:
        "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
      title: "Oportunidade - Modelo de seguranca e gestao de token da memory"
    }
  ]
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("records depth zero on early success and offers manual depth one", async () => {
  for (const configuredDepth of [1, 3] as const) {
    const calls: Array<{ path: string; body: RecallRequest }> = [];
    const apiPost = async <T>(path: string, body: unknown): Promise<T> => {
      calls.push({ path, body: body as RecallRequest });
      return recallResult as T;
    };
    const completed = await recallMemorySearchDepths({
      apiPost,
      depths: automaticMemorySearchDepths(configuredDepth),
      query: "token rotation",
      workspaceId: "workspace-1"
    });
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value)
    };

    assert.deepEqual(
      calls.map((call) => call.body.depth),
      [0]
    );
    assert.equal(calls[0].path, "/api/workspaces/workspace-1/memory/recall");
    assert.equal(completed.lastExecutedDepth, 0);
    writeStoredMemorySearchState(storage, {
      configuredDepth,
      lastExecutedDepth: completed.lastExecutedDepth,
      query: "token rotation",
      result: completed.result,
      workspaceId: "workspace-1"
    });
    const restored = readStoredMemorySearchState(storage, "workspace-1");

    assert.equal(values.has(MEMORY_SEARCH_STORAGE_KEY), true);
    assert.equal(restored?.lastExecutedDepth, 0);
    assert.equal(restored && nextMemorySearchDepth(restored), 1);
  }
});

test("runs empty automatic depths sequentially and keeps the effective query literal", async () => {
  const responses = Array.from({ length: 4 }, () =>
    deferred<MemoryRecallResult>()
  );
  const started = Array.from({ length: 4 }, () => deferred<void>());
  const calls: Array<{ path: string; body: RecallRequest }> = [];
  let nextCall = 0;
  const apiPost = async <T>(path: string, body: unknown): Promise<T> => {
    const index = nextCall;
    nextCall += 1;
    calls.push({ path, body: body as RecallRequest });
    started[index].resolve();
    return responses[index].promise as Promise<T>;
  };
  const interpretation = {
    correctionApplied: true,
    effectiveQuery: "toggle",
    mode: "auto" as const,
    originalQuery: "toogle",
    suggestedQuery: "toggle"
  };
  const emptyResult = { ...recallResult, interpretation, results: [] };
  const pending = recallMemorySearchDepths({
    apiPost,
    depths: automaticMemorySearchDepths(3),
    query: "toogle",
    workspaceId: "workspace 1"
  });

  for (let depth = 0; depth <= 3; depth += 1) {
    await started[depth].promise;
    assert.equal(calls.length, depth + 1);
    assert.equal(calls[depth].body.depth, depth);
    assert.equal(
      calls[depth].path,
      "/api/workspaces/workspace%201/memory/recall"
    );
    assert.equal(calls[depth].body.query, depth === 0 ? "toogle" : "toggle");
    assert.equal(calls[depth].body.queryMode, depth === 0 ? "auto" : "literal");
    responses[depth].resolve(emptyResult);
  }

  const completed = await pending;
  assert.deepEqual(
    calls.map((call) => call.body.depth),
    [0, 1, 2, 3]
  );
  assert.equal(completed.lastExecutedDepth, 3);
  assert.equal(completed.result.results.length, 0);
  assert.equal(
    nextMemorySearchDepth({
      configuredDepth: 3,
      lastExecutedDepth: completed.lastExecutedDepth
    }),
    undefined
  );
});

test("starts an alternate query literally at depth zero", async () => {
  const calls: RecallRequest[] = [];
  const apiPost = async <T>(_path: string, body: unknown): Promise<T> => {
    calls.push(body as RecallRequest);
    return recallResult as T;
  };

  const completed = await recallMemorySearchDepths({
    apiPost,
    depths: automaticMemorySearchDepths(3),
    initialMode: "literal",
    query: "toogle",
    workspaceId: "workspace-1"
  });

  assert.equal(calls[0].depth, 0);
  assert.equal(calls[0].query, "toogle");
  assert.equal(calls[0].queryMode, "literal");
  assert.equal(completed.lastExecutedDepth, 0);
});

test("does not apply an async response from the previously selected workspace", async () => {
  const response = deferred<MemoryRecallResult>();
  const started = deferred<void>();
  const apiPost = async <T>(): Promise<T> => {
    started.resolve();
    return response.promise as Promise<T>;
  };
  const pending = recallMemorySearchDepths({
    apiPost,
    depths: [0],
    query: "workspace one",
    workspaceId: "workspace-1"
  });
  await started.promise;

  const currentWorkspaceId = "workspace-2";
  const currentRequestId = 1;
  const visibleResult = recallResult;
  response.resolve({ ...recallResult, query: "workspace one" });
  const stale = await pending;
  const appliedResult = isCurrentMemorySearchRequest(
    1,
    currentRequestId,
    "workspace-1",
    currentWorkspaceId
  )
    ? stale.result
    : visibleResult;

  assert.strictEqual(appliedResult, visibleResult);
  assert.equal(visibleResult.query, "token rotation");
  assert.equal(
    isCurrentMemorySearchRequest(
      1,
      currentRequestId,
      "workspace-1",
      currentWorkspaceId
    ),
    false
  );
  assert.equal(
    isCurrentMemorySearchRequest(1, 2, "workspace-1", "workspace-1"),
    false
  );
});
