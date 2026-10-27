import assert from "node:assert/strict";
import test from "node:test";
import {
  alternateMemorySearchQuery,
  isMemorySearchAvailable,
  MEMORY_SEARCH_STORAGE_KEY,
  memorySearchRecallInput,
  readStoredMemorySearchState,
  writeStoredMemorySearchState
} from "../src/ui/memory-search.js";
import { FakeStorage, recallResult } from "./ui-memory-search-fixtures.js";

test("sends one search without a depth, reusing the effective query literally", () => {
  assert.deepEqual(memorySearchRecallInput("toogle"), {
    limit: 50,
    query: "toogle",
    queryMode: "auto"
  });
  assert.deepEqual(
    memorySearchRecallInput("toogle", {
      correctionApplied: true,
      effectiveQuery: "toggle",
      mode: "auto",
      originalQuery: "toogle",
      suggestedQuery: "toggle"
    }),
    {
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

test("stores one compact memory search result per workspace under schema 7", () => {
  const storage = new FakeStorage();
  writeStoredMemorySearchState(storage, {
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
  assert.equal(saved?.query, "token rotation");
  assert.equal(
    JSON.parse(storage.getItem(MEMORY_SEARCH_STORAGE_KEY) ?? "{}")
      .schemaVersion,
    7
  );
  assert.equal(saved?.result.results.length, 50);
  assert.equal(saved?.result.results[0].matchedText.length, 360);
  assert.deepEqual(
    saved?.result.results.map((hit) => hit.threadId),
    Array.from({ length: 50 }, (_, index) => `thread-${index}`)
  );
});

test("stores no search depth in the snapshot", () => {
  const storage = new FakeStorage();
  writeStoredMemorySearchState(storage, {
    query: "token rotation",
    result: recallResult,
    workspaceId: "workspace-1"
  });

  const stored = JSON.parse(storage.getItem(MEMORY_SEARCH_STORAGE_KEY) ?? "{}");
  assert.equal("configuredDepth" in stored, false);
  assert.equal("lastExecutedDepth" in stored, false);
});

test("discards a schema 6 snapshot silently and removes it", () => {
  const storage = new FakeStorage();
  storage.setItem(
    MEMORY_SEARCH_STORAGE_KEY,
    JSON.stringify({
      configuredDepth: 2,
      lastExecutedDepth: 0,
      query: "token rotation",
      result: recallResult,
      savedAt: "2026-10-21T00:00:00.000Z",
      schemaVersion: 6,
      workspaceId: "workspace-1"
    })
  );

  assert.equal(readStoredMemorySearchState(storage, "workspace-1"), undefined);
  assert.equal(storage.getItem(MEMORY_SEARCH_STORAGE_KEY), null);
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
    query: "token rotation",
    result: recallResult,
    workspaceId: "workspace-1"
  });

  assert.equal(readStoredMemorySearchState(storage, "workspace-2"), undefined);
});

test("stored snapshots need a band on every hit and an abstained flag", () => {
  const storage = new FakeStorage();
  const stored = (result: unknown) =>
    storage.setItem(
      MEMORY_SEARCH_STORAGE_KEY,
      JSON.stringify({
        query: "token rotation",
        result,
        savedAt: "2026-10-21T00:00:00.000Z",
        schemaVersion: 7,
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
