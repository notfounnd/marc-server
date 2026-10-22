import assert from "node:assert/strict";
import test from "node:test";
import {
  SYNTHETIC_MAX_WORDS,
  SYNTHETIC_MIN_WORDS,
  SYNTHETIC_QUERY_COUNT,
  eligibleSentences,
  syntheticQueries,
  type SyntheticPassage
} from "../src/core/memory/scoring/synthetic-queries.js";

/**
 * Sixty passages with an eligible first sentence of twelve words, and a second
 * sentence of five words, which is never eligible.
 */
function passagesFixture(count: number): SyntheticPassage[] {
  return Array.from({ length: count }, (_, index) => ({
    recordId: `P-${String(index).padStart(2, "0")}`,
    threadId: `T-${index % 6}`,
    text: `Passage ${index} opens with a sentence of nine words about topic ${index}. Its second sentence stays short.`
  }));
}

function wordCount(text: string): number {
  return text.split(/\s+/).length;
}

test("the synthetic queries are deterministic for a generation and sorted by recordId", () => {
  const passages = passagesFixture(SYNTHETIC_QUERY_COUNT);
  const reversed = [...passages].reverse();
  assert.deepEqual(
    syntheticQueries(passages, "generation-a"),
    syntheticQueries(passages, "generation-a")
  );
  assert.deepEqual(
    syntheticQueries(passages, "generation-a"),
    syntheticQueries(reversed, "generation-a")
  );
});

test("the seed comes from the generation: another generation gives other queries", () => {
  const passages = passagesFixture(SYNTHETIC_QUERY_COUNT + 20);
  assert.notDeepEqual(
    syntheticQueries(passages, "generation-a").map(
      (query) => query.sourceRecordId
    ),
    syntheticQueries(passages, "generation-b").map(
      (query) => query.sourceRecordId
    )
  );
});

test("sixty queries with ids in order, each with 6 to 20 words", () => {
  const queries = syntheticQueries(
    passagesFixture(SYNTHETIC_QUERY_COUNT + 5),
    "generation-a"
  );
  assert.equal(queries.length, SYNTHETIC_QUERY_COUNT);
  assert.deepEqual(
    queries.map((query) => query.id),
    Array.from(
      { length: SYNTHETIC_QUERY_COUNT },
      (_, index) => `synthetic-${String(index + 1).padStart(2, "0")}`
    )
  );
  assert.ok(
    queries.every((query) => wordCount(query.text) >= SYNTHETIC_MIN_WORDS)
  );
  assert.ok(
    queries.every((query) => wordCount(query.text) <= SYNTHETIC_MAX_WORDS)
  );
});

test("each passage is sampled once, and the positive is its thread", () => {
  const passages = passagesFixture(SYNTHETIC_QUERY_COUNT + 20);
  const queries = syntheticQueries(passages, "generation-a");
  const recordIds = queries.map((query) => query.sourceRecordId);
  assert.equal(new Set(recordIds).size, recordIds.length);
  const threads = new Map(
    passages.map((passage) => [passage.recordId, passage.threadId])
  );
  assert.ok(
    queries.every(
      (query) => query.sourceThreadId === threads.get(query.sourceRecordId)
    )
  );
});

test("a passage whose sentences are all shorter than 6 words is never sampled", () => {
  const shortOnly: SyntheticPassage = {
    recordId: "P-short",
    threadId: "T-short",
    text: "Only five words here. Tiny."
  };
  const queries = syntheticQueries(
    [...passagesFixture(SYNTHETIC_QUERY_COUNT), shortOnly],
    "generation-a"
  );
  assert.ok(queries.every((query) => query.sourceRecordId !== "P-short"));
});

test("a sentence longer than 20 words keeps its first 20 words", () => {
  const longPassage: SyntheticPassage = {
    recordId: "P-long",
    threadId: "T-long",
    text: Array.from({ length: 25 }, (_, index) => `word${index}`).join(" ")
  };
  const passages = [...passagesFixture(SYNTHETIC_QUERY_COUNT - 1), longPassage];
  const queries = syntheticQueries(passages, "generation-a", passages.length);
  const longQuery = queries.find((query) => query.sourceRecordId === "P-long");
  assert.equal(
    longQuery?.text,
    Array.from({ length: 20 }, (_, index) => `word${index}`).join(" ")
  );
});

test("eligibleSentences splits at line breaks and sentence ends, and keeps 6 to 20 words", () => {
  const text =
    "Alpha beta gamma delta epsilon zeta.\nShort one.\nOne two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo.";
  assert.deepEqual(eligibleSentences(text), [
    "Alpha beta gamma delta epsilon zeta.",
    "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty"
  ]);
});

test("with fewer eligible passages than requested, every eligible passage is used", () => {
  const queries = syntheticQueries(
    passagesFixture(SYNTHETIC_QUERY_COUNT - 1),
    "generation-a"
  );
  assert.equal(queries.length, SYNTHETIC_QUERY_COUNT - 1);
  assert.equal(
    new Set(queries.map((query) => query.sourceRecordId)).size,
    SYNTHETIC_QUERY_COUNT - 1
  );
});
