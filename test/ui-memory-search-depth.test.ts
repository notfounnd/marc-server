import assert from "node:assert/strict";
import test from "node:test";
import {
  automaticMemorySearchDepths,
  MEMORY_SEARCH_UI_LIMIT,
  nextMemorySearchDepth
} from "../src/ui/memory-search-depth.js";

test("starts every automatic memory search at Edge depth", () => {
  assert.deepEqual(automaticMemorySearchDepths(0), [0]);
  assert.deepEqual(automaticMemorySearchDepths(1), [0, 1]);
  assert.deepEqual(automaticMemorySearchDepths(2), [0, 1, 2]);
  assert.deepEqual(automaticMemorySearchDepths(3), [0, 1, 2, 3]);
});

test("derives deep retry from the active search only", () => {
  assert.equal(
    nextMemorySearchDepth({ configuredDepth: 0, lastExecutedDepth: 0 }),
    1
  );
  assert.equal(
    nextMemorySearchDepth({ configuredDepth: 1, lastExecutedDepth: 0 }),
    1
  );
  assert.equal(
    nextMemorySearchDepth({ configuredDepth: 1, lastExecutedDepth: 1 }),
    2
  );
  assert.equal(
    nextMemorySearchDepth({ configuredDepth: 3, lastExecutedDepth: 2 }),
    3
  );
  assert.equal(
    nextMemorySearchDepth({ configuredDepth: 3, lastExecutedDepth: 3 }),
    undefined
  );
});

test("keeps the larger UI result limit outside the MCP default", () => {
  assert.equal(MEMORY_SEARCH_UI_LIMIT, 50);
});
