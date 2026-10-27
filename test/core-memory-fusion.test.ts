import assert from "node:assert/strict";
import test from "node:test";
import {
  fusionWithoutRerankerScore,
  lexicalRanksByThread,
  lexicalScoreOfRanks
} from "../src/core/memory/hybrid-ranking.js";
import {
  rerankerFusionScore,
  semanticFusionScore
} from "../src/core/memory/semantic-ranking.js";
import type {
  MemoryLexicalSearchHit,
  MemoryRecordKind,
  MemorySearchChannels,
  MemoryVectorRecord
} from "../src/core/memory/types.js";
import { summaryProvenanceFixture } from "./memory-provenance-fixtures.js";

const TOLERANCE = 1e-12;

test("the lexical ranks keep the first hit of each thread and field", () => {
  // Scenario: title A (rank 1), summary A (rank 1), title B (rank 2), a second title for A.
  const channels = channelsWithLexical([
    lexicalHit("A", "title"),
    lexicalHit("A", "summary"),
    lexicalHit("B", "title"),
    lexicalHit("A", "title")
  ]);
  const ranks = lexicalRanksByThread(channels);
  assert.deepEqual(ranks.get("A"), { title: 1, summary: 1 });
  assert.deepEqual(ranks.get("B"), { title: 2 });
});

test("the lexical score weights each field's reciprocal rank", () => {
  // Scenario: title rank 1 weighs 2; summary rank 3 weighs 0.75 / 3 = 0.25. Total 2.25.
  assert.equal(lexicalScoreOfRanks({ title: 1, summary: 3 }), 2.25);
});

test("a thread without lexical ranks has a zero lexical score", () => {
  assert.equal(lexicalScoreOfRanks(undefined), 0);
});

test("the fusion without the reranker adds identity, passage and lexical terms", () => {
  // Scenario: identity rank 1, passage rank 2, title rank 1. 1 + 0.5 + 2 = 3.5.
  assert.equal(fusionWithoutRerankerScore(1, 2, { title: 1 }), 3.5);
});

test("a fusion without identity or passage ranks keeps only the present terms", () => {
  assert.equal(fusionWithoutRerankerScore(undefined, 4, undefined), 0.25);
});

test("the semantic fusion weighs identity and passage ranks by one", () => {
  // Scenario: identity rank 1 and passage rank 2. 1 + 0.5 = 1.5.
  assert.equal(semanticFusionScore(1, 2), 1.5);
});

test("the reranker term weighs the reciprocal rank by two", () => {
  // Scenario: reranker rank 3. 2 / 3.
  assert.ok(Math.abs(rerankerFusionScore(3) - 2 / 3) < TOLERANCE);
});

test("the M0 ranking score is the semantic fusion plus the reranker term", () => {
  // Scenario: identity rank 1, passage rank 2, reranker rank 3. 1 + 0.5 + 2/3.
  const ranking = semanticFusionScore(1, 2) + rerankerFusionScore(3);
  assert.ok(Math.abs(ranking - (1 + 0.5 + 2 / 3)) < TOLERANCE);
});

function channelsWithLexical(
  lexical: MemoryLexicalSearchHit[]
): MemorySearchChannels {
  return { identities: [], passages: [], lexical };
}

function lexicalHit(
  threadId: string,
  field: MemoryLexicalSearchHit["field"]
): MemoryLexicalSearchHit {
  return {
    field,
    record: record(threadId, "identity"),
    score: 1,
    vectorScore: 0.5
  };
}

function record(threadId: string, kind: MemoryRecordKind): MemoryVectorRecord {
  const text = `${threadId} ${kind}`;
  return {
    recordId: `${threadId}:${kind}`,
    threadId,
    title: `${threadId} title`,
    summaryPath: `/tmp/${threadId}/SUMMARY.md`,
    relativeSummaryPath: `threads/${threadId}/SUMMARY.md`,
    reference: `marc://$${threadId}`,
    kind,
    sectionTitle: "Result",
    text,
    embeddingText: text,
    ...summaryProvenanceFixture(threadId, text)
  };
}
