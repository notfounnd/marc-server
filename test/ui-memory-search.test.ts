import assert from "node:assert/strict";
import test from "node:test";
import {
  alternateMemorySearchQuery,
  findMemorySearchThread,
  isMemorySearchAvailable,
  isMemorySearchClosedHit,
  MEMORY_SEARCH_STORAGE_KEY,
  memorySearchRecallInput,
  memorySearchTooltip,
  readStoredMemorySearchState,
  splitMemorySearchBands,
  writeStoredMemorySearchState
} from "../src/ui/memory-search.js";
import { nextMemorySearchDepth } from "../src/ui/memory-search-depth.js";
import type {
  MemoryBand,
  MemoryRecallResult,
  Thread
} from "../src/ui/types.js";

class FakeStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const recallResult: MemoryRecallResult = {
  interpretation: {
    correctionApplied: false,
    effectiveQuery: "token rotation",
    mode: "auto",
    originalQuery: "token rotation"
  },
  indexStatus: {
    indexedSummaryCount: 1,
    autoRebuild: true,
    embeddingBatchSize: 4,
    searchRetryDepth: 0,
    lastError: null,
    message: "Memory index is current.",
    modelPrepared: true,
    retrieverPrepared: true,
    rerankerPrepared: true,
    interpreterPrepared: true,
    rebuildReady: true,
    searchReady: true,
    preparing: false,
    ready: true,
    rebuilding: false,
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
      title: "Oportunidade - Modelo de seguranca e gestao de token do daemon"
    }
  ]
};

test("reuses the effective query literally after the first recall", () => {
  assert.deepEqual(memorySearchRecallInput("toogle", 0), {
    depth: 0,
    limit: 50,
    query: "toogle",
    queryMode: "auto"
  });
  assert.deepEqual(
    memorySearchRecallInput("toogle", 1, {
      correctionApplied: true,
      effectiveQuery: "toggle",
      mode: "auto",
      originalQuery: "toogle",
      suggestedQuery: "toggle"
    }),
    {
      depth: 1,
      limit: 50,
      query: "toggle",
      queryMode: "literal"
    }
  );
});

test("selects the opposite query for correction and suggestion actions", () => {
  assert.equal(
    alternateMemorySearchQuery({
      correctionApplied: true,
      effectiveQuery: "toggle",
      mode: "auto",
      originalQuery: "toogle",
      suggestedQuery: "toggle"
    }),
    "toogle"
  );
  assert.equal(
    alternateMemorySearchQuery({
      correctionApplied: false,
      effectiveQuery: "toogle",
      mode: "auto",
      originalQuery: "toogle",
      suggestedQuery: "toggle"
    }),
    "toggle"
  );
});

test("enables memory search only when both models and the index are ready", () => {
  assert.equal(isMemorySearchAvailable({ searchReady: true }), true);
  assert.equal(isMemorySearchAvailable({ searchReady: false }), false);
  assert.equal(isMemorySearchAvailable(undefined), false);
});

test("stores one compact memory search result per workspace", () => {
  const storage = new FakeStorage();
  writeStoredMemorySearchState(storage, {
    configuredDepth: 3,
    lastExecutedDepth: 0,
    query: "token rotation",
    result: {
      ...recallResult,
      results: Array.from({ length: 51 }, (_, index) => ({
        ...recallResult.results[0],
        matchedText: "x".repeat(600),
        score: 0.9 - index / 10,
        threadId: `thread-${index}`
      }))
    },
    workspaceId: "workspace-1"
  });

  const saved = readStoredMemorySearchState(storage, "workspace-1");
  assert.equal(saved?.configuredDepth, 3);
  assert.equal(saved?.lastExecutedDepth, 0);
  assert.equal(
    nextMemorySearchDepth({
      configuredDepth: 3,
      lastExecutedDepth: saved!.lastExecutedDepth
    }),
    1
  );
  assert.equal(saved?.query, "token rotation");
  assert.equal(
    JSON.parse(storage.getItem(MEMORY_SEARCH_STORAGE_KEY) ?? "{}")
      .schemaVersion,
    6
  );
  assert.equal(saved?.result.results.length, 50);
  assert.equal(saved?.result.results[0].matchedText.length, 360);
  assert.deepEqual(
    saved?.result.results.map((hit) => hit.threadId),
    Array.from({ length: 50 }, (_, index) => `thread-${index}`)
  );
});

test("discards legacy search snapshots without an observed depth", () => {
  const storage = new FakeStorage();
  storage.setItem(
    MEMORY_SEARCH_STORAGE_KEY,
    JSON.stringify({
      configuredDepth: 3,
      manualDeepRetries: 0,
      query: "token rotation",
      result: recallResult,
      savedAt: "2026-10-08T00:00:00.000Z",
      schemaVersion: 4,
      workspaceId: "workspace-1"
    })
  );

  assert.equal(readStoredMemorySearchState(storage, "workspace-1"), undefined);
  assert.equal(storage.getItem(MEMORY_SEARCH_STORAGE_KEY), null);
});

test("ignores stored memory search from another workspace", () => {
  const storage = new FakeStorage();
  writeStoredMemorySearchState(storage, {
    configuredDepth: 0,
    lastExecutedDepth: 0,
    query: "token rotation",
    result: recallResult,
    workspaceId: "workspace-1"
  });

  assert.equal(readStoredMemorySearchState(storage, "workspace-2"), undefined);
});

test("maps memory recall hits back to workspace threads", () => {
  const threads: Thread[] = [
    {
      createdAt: "2026-05-07T03:19:24.641Z",
      id: recallResult.results[0].threadId,
      path: "thread-path",
      status: "closed",
      title: recallResult.results[0].title
    }
  ];

  assert.equal(
    findMemorySearchThread(recallResult.results[0], threads)?.id,
    recallResult.results[0].threadId
  );
});

test("uses matched search text as tooltip with title fallback", () => {
  assert.equal(
    memorySearchTooltip(recallResult.results[0], "Thread title"),
    recallResult.results[0].matchedText
  );
  assert.equal(
    memorySearchTooltip(
      {
        ...recallResult.results[0],
        matchedText: "   "
      },
      "Thread title"
    ),
    "Thread title"
  );
});

test("splits results by band and keeps the order inside each list", () => {
  const hit = (threadId: string, band: MemoryBand) => ({
    ...recallResult.results[0],
    band,
    threadId
  });
  const split = splitMemorySearchBands([
    hit("a", "high"),
    hit("b", "low"),
    hit("c", "medium"),
    hit("d", "low")
  ]);

  assert.deepEqual(
    split.primary.map((item) => item.threadId),
    ["a", "c"]
  );
  assert.deepEqual(
    split.lessLikely.map((item) => item.threadId),
    ["b", "d"]
  );
});

test("stored snapshots need a band on every hit and an abstained flag", () => {
  const storage = new FakeStorage();
  const stored = (result: unknown) =>
    storage.setItem(
      MEMORY_SEARCH_STORAGE_KEY,
      JSON.stringify({
        configuredDepth: 3,
        lastExecutedDepth: 0,
        query: "token rotation",
        result,
        savedAt: "2026-10-21T00:00:00.000Z",
        schemaVersion: 6,
        workspaceId: "workspace-1"
      })
    );
  const { band: _band, ...hitWithoutBand } = recallResult.results[0];

  stored(recallResult);
  assert.notEqual(
    readStoredMemorySearchState(storage, "workspace-1"),
    undefined
  );
  stored({ ...recallResult, results: [hitWithoutBand] });
  assert.equal(readStoredMemorySearchState(storage, "workspace-1"), undefined);
  stored({ ...recallResult, abstained: undefined });
  assert.equal(readStoredMemorySearchState(storage, "workspace-1"), undefined);
});

test("treats memory search hits as closed thread results", () => {
  assert.equal(isMemorySearchClosedHit(recallResult.results[0]), true);
});
