import assert from "node:assert/strict";
import test from "node:test";
import { LanceDbMemoryVectorStore } from "../src/core/memory/store.js";
import type { MemoryVectorRecord } from "../src/core/memory/types.js";
import { tempWorkspace } from "./memory-test-helpers.js";

test("LanceDB lexical indexes keep title, summary, and prefix evidence distinct", async () => {
  const info = await tempWorkspace();
  const store = new LanceDbMemoryVectorStore();
  const records = lexicalRecords();
  const vectors = records.map((record) =>
    record.threadId === "ui" ? [1, 0, 0] : [0, 1, 0]
  );

  await store.rebuild(info, records, vectors, "hybrid-test");
  await store.validateGeneration(info, "hybrid-test");

  const [title, summary, passage, prefix, infix] = await Promise.all([
    store.searchLexical(info, "brutalism", [1, 0, 0], {
      field: "title",
      generation: "hybrid-test",
      limit: 10
    }),
    store.searchLexical(info, "brutalism", [1, 0, 0], {
      field: "summary",
      generation: "hybrid-test",
      limit: 10
    }),
    store.searchLexical(info, "toggle", [1, 0, 0], {
      field: "summary",
      generation: "hybrid-test",
      limit: 10
    }),
    store.searchLexical(info, "brutal", [1, 0, 0], {
      field: "titlePrefix",
      generation: "hybrid-test",
      limit: 10
    }),
    store.searchLexical(info, "rutal", [1, 0, 0], {
      field: "titlePrefix",
      generation: "hybrid-test",
      limit: 10
    })
  ]);

  assert.deepEqual(
    title.map((hit) => hit.record.threadId),
    ["ui"]
  );
  assert.deepEqual(
    summary.map((hit) => hit.record.threadId),
    ["calibration"]
  );
  assert.equal(passage[0]?.record.kind, "passage");
  assert.equal(passage[0]?.record.threadId, "ui");
  assert.deepEqual(
    prefix.map((hit) => hit.record.threadId),
    ["ui"]
  );
  assert.deepEqual(infix, []);
  assert.equal(title[0]?.vectorScore, 1);
});

function lexicalRecords(): MemoryVectorRecord[] {
  return [
    record("ui", "identity", "Neo brutalism interface", "Visual system"),
    record("ui", "passage", "Neo brutalism interface", "Button borders"),
    record(
      "ui",
      "passage",
      "Neo brutalism interface",
      "The toggle controls the visual mode"
    ),
    record(
      "calibration",
      "identity",
      "Search calibration",
      "The brutalism query exposed ranking behavior"
    )
  ];
}

function record(
  threadId: string,
  kind: "identity" | "passage",
  title: string,
  text: string
): MemoryVectorRecord {
  return {
    recordId: `${threadId}:${kind}`,
    threadId,
    title,
    summaryPath: `/tmp/${threadId}/SUMMARY.md`,
    relativeSummaryPath: `threads/${threadId}/SUMMARY.md`,
    reference: `marc://$${threadId}`,
    kind,
    sectionTitle: kind === "passage" ? "Result" : undefined,
    text,
    embeddingText: text
  };
}
