import assert from "node:assert/strict";
import test from "node:test";
import {
  automaticMemorySearchScores,
  MEMORY_SEARCH_UI_LIMIT,
  nextMemorySearchDepth
} from "../src/ui/memory-search-depth.js";

test("starts every automatic memory search at the default score", () => {
  assert.deepEqual(automaticMemorySearchScores(0), [0.15]);
  assert.deepEqual(automaticMemorySearchScores(1), [0.15, 0.1]);
  assert.deepEqual(automaticMemorySearchScores(2), [0.15, 0.1, 0.05]);
  assert.deepEqual(automaticMemorySearchScores(3), [0.15, 0.1, 0.05, 0]);
});

test("derives deep retry from the active search only", () => {
  assert.equal(
    nextMemorySearchDepth({ configuredDepth: 0, manualDeepRetries: 0 }),
    1
  );
  assert.equal(
    nextMemorySearchDepth({ configuredDepth: 1, manualDeepRetries: 0 }),
    2
  );
  assert.equal(
    nextMemorySearchDepth({ configuredDepth: 1, manualDeepRetries: 1 }),
    3
  );
  assert.equal(
    nextMemorySearchDepth({ configuredDepth: 3, manualDeepRetries: 0 }),
    undefined
  );
});

test("keeps the larger UI result limit outside the MCP default", () => {
  assert.equal(MEMORY_SEARCH_UI_LIMIT, 50);
});
