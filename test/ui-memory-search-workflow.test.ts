import assert from "node:assert/strict";
import test from "node:test";
import {
  isCurrentMemorySearchRequest,
  recallMemorySearch
} from "../src/ui/memory-search.js";
import type {
  MemoryQueryInterpretation,
  MemoryRecallResult
} from "../src/ui/types.js";

type RecordedRequest = {
  body: { limit: number; query: string; queryMode: "auto" | "literal" };
  path: string;
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
    stale: false,
    status: "ready",
    summaryCount: 1
  },
  abstained: false,
  nextActions: [],
  query: "token rotation",
  results: [
    {
      closedAt: "2026-05-24T23:15:59.807Z",
      matchedText: "Token rotation was already discussed in the daemon model.",
      reason: "Matched summary in token rotation.",
      reference:
        "marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
      band: "low",
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

function recordingApiPost(requests: RecordedRequest[]) {
  return async <T>(path: string, body: unknown): Promise<T> => {
    requests.push({ body: body as RecordedRequest["body"], path });
    return recallResult as T;
  };
}

test("sends one search at the default depth, with no depth field, and returns its result", async () => {
  const requests: RecordedRequest[] = [];

  const result = await recallMemorySearch({
    apiPost: recordingApiPost(requests),
    query: "token rotation",
    workspaceId: "workspace-1"
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, "/api/workspaces/workspace-1/memory/recall");
  assert.deepEqual(requests[0].body, {
    limit: 50,
    query: "token rotation",
    queryMode: "auto"
  });
  assert.equal("depth" in requests[0].body, false);
  assert.equal(result.query, "token rotation");
  assert.equal(result.results.length, 1);
});

test("an alternate query keeps the interpretation it came from and searches literally", async () => {
  const requests: RecordedRequest[] = [];
  const interpretation: MemoryQueryInterpretation = {
    correctionApplied: true,
    effectiveQuery: "token rotation",
    mode: "auto",
    originalQuery: "tokem rotation",
    suggestedQuery: "token rotation"
  };

  const result = await recallMemorySearch({
    apiPost: recordingApiPost(requests),
    initialMode: "literal",
    interpretation,
    query: "tokem rotation",
    workspaceId: "workspace-1"
  });

  assert.deepEqual(requests[0].body, {
    limit: 50,
    query: "token rotation",
    queryMode: "literal"
  });
  assert.equal(result.interpretation, interpretation);
  assert.equal(result.query, "tokem rotation");
});

test("does not apply an async response from the previously selected workspace", async () => {
  const response = deferred<MemoryRecallResult>();
  const started = deferred<void>();
  const apiPost = async <T>(): Promise<T> => {
    started.resolve();
    return response.promise as Promise<T>;
  };
  const pending = recallMemorySearch({
    apiPost,
    query: "workspace one",
    workspaceId: "workspace-1"
  });
  await started.promise;

  const visibleResult = recallResult;
  response.resolve({ ...recallResult, query: "workspace one" });
  const stale = await pending;

  assert.equal(
    isCurrentMemorySearchRequest(1, 1, "workspace-1", "workspace-2"),
    false
  );
  assert.equal(stale.query, "workspace one");
  assert.equal(visibleResult.query, "token rotation");
});
