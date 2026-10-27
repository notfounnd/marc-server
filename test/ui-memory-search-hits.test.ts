import assert from "node:assert/strict";
import test from "node:test";
import {
  findMemorySearchThread,
  isMemorySearchClosedHit,
  isMemorySearchHitSelected,
  MEMORY_SEARCH_STORAGE_KEY,
  memorySearchTooltip,
  readStoredMemorySearchState,
  splitMemorySearchBands,
  writeStoredMemorySearchState
} from "../src/ui/memory-search.js";
import type { MemoryBand, Thread } from "../src/ui/types.js";
import {
  FakeStorage,
  recallResult,
  ruleHit
} from "./ui-memory-search-fixtures.js";

test("maps memory recall hits back to workspace threads", () => {
  const threads: Thread[] = [
    {
      createdAt: "2026-05-07T03:19:24.641Z",
      id: recallResult.results[0].threadId ?? "",
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

test("a hit without a thread id maps to no thread and is never selected", () => {
  const threads: Thread[] = [
    {
      createdAt: "2026-05-07T03:19:24.641Z",
      id: "thread-1",
      path: "thread-path",
      status: "open",
      title: "Thread"
    }
  ];

  assert.equal(findMemorySearchThread(ruleHit, threads), undefined);
  assert.equal(isMemorySearchHitSelected(ruleHit, undefined), false);
  assert.equal(isMemorySearchHitSelected(ruleHit, "thread-1"), false);
  assert.equal(
    isMemorySearchHitSelected(
      recallResult.results[0],
      recallResult.results[0].threadId
    ),
    true
  );
});

test("keeps a stored hit without a thread id, with its reference", () => {
  const storage = new FakeStorage();
  writeStoredMemorySearchState(storage, {
    query: "playwright",
    result: { ...recallResult, results: [ruleHit] },
    workspaceId: "workspace-1"
  });

  const saved = readStoredMemorySearchState(storage, "workspace-1");
  assert.equal(saved?.result.results.length, 1);
  assert.equal(saved?.result.results[0].threadId, undefined);
  assert.equal(saved?.result.results[0].reference, "marc://$rules");
  assert.equal(
    JSON.parse(storage.getItem(MEMORY_SEARCH_STORAGE_KEY) ?? "{}")
      .schemaVersion,
    7
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

test("treats memory search hits as closed thread results", () => {
  assert.equal(isMemorySearchClosedHit(recallResult.results[0]), true);
});
