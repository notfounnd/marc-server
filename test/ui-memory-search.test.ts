import assert from "node:assert/strict";
import test from "node:test";
import {
  findMemorySearchThread,
  isMemorySearchAvailable,
  isMemorySearchClosedHit,
  memorySearchTooltip,
  readStoredMemorySearchState,
  writeStoredMemorySearchState
} from "../src/ui/memory-search.js";
import type { MemoryRecallResult, Thread } from "../src/ui/types.js";

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
  indexStatus: {
    indexedSummaryCount: 1,
    autoRebuild: true,
    embeddingBatchSize: 4,
    searchRetryDepth: 0,
    lastError: null,
    message: "Memory index is current.",
    modelPrepared: true,
    preparing: false,
    ready: true,
    rebuilding: false,
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
      reason: "Exact terms: token.",
      reference:
        "marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
      score: 0.82,
      summaryPath:
        "threads/oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3/SUMMARY.md",
      threadId:
        "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
      title: "Oportunidade - Modelo de seguranca e gestao de token do daemon"
    }
  ]
};

test("enables memory search only for ready or stale memory", () => {
  assert.equal(isMemorySearchAvailable({ status: "ready" }), true);
  assert.equal(isMemorySearchAvailable({ status: "stale" }), true);
  assert.equal(isMemorySearchAvailable({ status: "missing" }), false);
  assert.equal(isMemorySearchAvailable({ status: "model_missing" }), false);
  assert.equal(isMemorySearchAvailable({ status: "incompatible" }), false);
  assert.equal(isMemorySearchAvailable({ status: "rebuilding" }), false);
  assert.equal(isMemorySearchAvailable({ status: "degraded" }), false);
  assert.equal(isMemorySearchAvailable(undefined), false);
});

test("stores one compact memory search result per workspace", () => {
  const storage = new FakeStorage();
  writeStoredMemorySearchState(storage, {
    configuredDepth: 1,
    manualDeepRetries: 1,
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
  assert.equal(saved?.configuredDepth, 1);
  assert.equal(saved?.manualDeepRetries, 1);
  assert.equal(saved?.query, "token rotation");
  assert.equal(saved?.result.results.length, 50);
  assert.equal(saved?.result.results[0].matchedText.length, 360);
  assert.deepEqual(
    saved?.result.results.map((hit) => hit.threadId),
    Array.from({ length: 50 }, (_, index) => `thread-${index}`)
  );
});

test("ignores stored memory search from another workspace", () => {
  const storage = new FakeStorage();
  writeStoredMemorySearchState(storage, {
    configuredDepth: 0,
    manualDeepRetries: 0,
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

test("treats memory search hits as closed thread results", () => {
  assert.equal(isMemorySearchClosedHit(recallResult.results[0]), true);
});
