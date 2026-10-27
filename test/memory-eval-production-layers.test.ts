import assert from "node:assert/strict";
import test from "node:test";
import {
  compareRecordIds,
  compareThreadIds
} from "../scripts/memory-eval/capture.js";
import type { MemoryManifest } from "../src/core/memory/types.js";

/** A manifest with the given groups; only the fields that the comparators read are filled. */
function manifestOf(
  groups: Array<{ threadId: string; recordIds: string[] }>
): MemoryManifest {
  return {
    schemaVersion: 7,
    builtAt: "2026-10-22T00:00:00.000Z",
    generation: "generation",
    embeddingProvider: {},
    retrievalContract: "source-layers-v1",
    records: groups.map((group) => ({
      threadId: group.threadId,
      title: group.threadId,
      summaryPath: "",
      relativeSummaryPath: "",
      reference: "",
      sha256: "",
      mtimeMs: 0,
      recordIds: group.recordIds
    }))
  } as unknown as MemoryManifest;
}

const PRODUCTION = manifestOf([{ threadId: "t1", recordIds: ["r0a", "r0b"] }]);
const PINNED = new Set(["t1"]);
const LAYER_ZERO = new Set(["r0a", "r0b"]);

test("record ids of layers 1 and 2 are not compared with production, which indexes layer 0 only", () => {
  const temporary = manifestOf([
    { threadId: "t1", recordIds: ["r0a", "r0b", "r1a"] },
    { threadId: "@rules", recordIds: ["r1rules"] }
  ]);
  assert.deepEqual(
    compareRecordIds(temporary, PRODUCTION, PINNED, LAYER_ZERO),
    []
  );
});

test("a layer 0 record that production holds and the temporary manifest lacks is reported", () => {
  const temporary = manifestOf([{ threadId: "t1", recordIds: ["r0a"] }]);
  const problems = compareRecordIds(temporary, PRODUCTION, PINNED, LAYER_ZERO);
  assert.equal(problems.length, 1);
  assert.match(
    problems[0] ?? "",
    /record ids missing from the temporary manifest/
  );
});

test("the thread comparison accepts @rules and @document groups, and still reports a missing pinned thread", () => {
  const groups = [
    { threadId: "t1", recordIds: [] },
    { threadId: "@rules", recordIds: [] },
    { threadId: "@document/docs/guide.md", recordIds: [] }
  ];
  assert.deepEqual(
    compareThreadIds(
      manifestOf(groups),
      manifestOf(groups.slice(0, 1)),
      PINNED
    ),
    []
  );
  const problems = compareThreadIds(
    manifestOf([]),
    manifestOf(groups.slice(0, 1)),
    PINNED
  );
  assert.match(
    problems.join(" "),
    /pinned threads missing from the temporary manifest/
  );
});
