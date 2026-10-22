import assert from "node:assert/strict";
import test from "node:test";
import { rankHybridMemoryCandidates } from "../src/core/memory/hybrid-ranking.js";
import { semanticRerankingDocument } from "../src/core/memory/semantic-ranking.js";
import {
  FEATURE_NAMES,
  featureVectorOf,
  semanticOnlyVectorOf,
  threadFeatures,
  type RerankScores,
  type ThreadFeatures
} from "../src/core/memory/scoring/features.js";
import type {
  MemoryLexicalField,
  MemoryLexicalSearchHit,
  MemoryRecordKind,
  MemorySearchChannels,
  MemorySearchHit,
  MemoryVectorRecord
} from "../src/core/memory/types.js";
import { FakeRerankingProvider } from "./memory-test-helpers.js";

function recordOf(
  recordId: string,
  threadId: string,
  kind: MemoryRecordKind
): MemoryVectorRecord {
  return {
    recordId,
    threadId,
    title: `Title of ${threadId}`,
    summaryPath: `${threadId}/SUMMARY.md`,
    relativeSummaryPath: `${threadId}/SUMMARY.md`,
    reference: `marc://$${threadId}`,
    kind,
    text: `Text of ${recordId}`,
    embeddingText: `Text of ${recordId}`,
    sourceType: "summary",
    layer: 0,
    sourcePath: `${threadId}/SUMMARY.md`,
    authority: "decision",
    lineStart: 1,
    lineEnd: 2,
    sourceSha256: "source",
    passageOrdinal: 0,
    passageSha256: "passage",
    passageId: recordId
  };
}

const RECORDS = {
  aIdentity: recordOf("A-identity", "A", "identity"),
  bIdentity: recordOf("B-identity", "B", "identity"),
  dIdentity: recordOf("D-identity", "D", "identity"),
  a1: recordOf("A-passage-1", "A", "passage"),
  a2: recordOf("A-passage-2", "A", "passage"),
  a3: recordOf("A-passage-3", "A", "passage"),
  a4: recordOf("A-passage-4", "A", "passage"),
  b1: recordOf("B-passage-1", "B", "passage"),
  c1: recordOf("C-passage-1", "C", "passage")
};

function hit(record: MemoryVectorRecord, score: number): MemorySearchHit {
  return { record, score };
}

function lexicalHit(
  field: MemoryLexicalField,
  record: MemoryVectorRecord,
  vectorScore: number
): MemoryLexicalSearchHit {
  return { field, record, score: 1, vectorScore };
}

/**
 * Declared channels. Dense passage ranks over the merged list are A1 1, B1 2,
 * C1 3, A2 4, A3 5, A4 6. Thread A selects A1, A2 and A3 (up to three), so A4 is
 * left out. C1 exists only in the lexical channel.
 */
const BASE_CHANNELS: MemorySearchChannels = {
  identities: [
    hit(RECORDS.aIdentity, 0.8),
    hit(RECORDS.bIdentity, 0.4),
    hit(RECORDS.dIdentity, 0.6)
  ],
  passages: [
    hit(RECORDS.a1, 0.7),
    hit(RECORDS.b1, 0.6),
    hit(RECORDS.a2, 0.5),
    hit(RECORDS.a3, 0.3),
    hit(RECORDS.a4, 0.2)
  ],
  lexical: [
    lexicalHit("title", RECORDS.aIdentity, 0.8),
    lexicalHit("summary", RECORDS.b1, 0.6),
    lexicalHit("summary", RECORDS.c1, 0.55),
    lexicalHit("titlePrefix", RECORDS.dIdentity, 0.6)
  ]
};

/** Declared reranker scores. A4 scores highest but is not selected, so it must not count. */
const RERANK_SCORES: RerankScores = new Map([
  ["A-identity", 0.3],
  ["B-identity", 0.7],
  ["D-identity", 0.25],
  ["A-passage-1", 0.9],
  ["A-passage-2", 0.1],
  ["A-passage-3", 0.4],
  ["A-passage-4", 0.95],
  ["B-passage-1", 0.5],
  ["C-passage-1", -0.2]
]);

const EXPECTED: ThreadFeatures[] = [
  {
    threadId: "A",
    identityCosine: 0.8,
    bestPassageCosine: 0.7,
    bestRerankerScore: 0.9,
    secondRerankerScore: 0.4,
    identityRerankerScore: 0.3,
    lexicalTitleMatch: 1,
    lexicalContentMatch: 0
  },
  {
    threadId: "B",
    identityCosine: 0.4,
    bestPassageCosine: 0.6,
    bestRerankerScore: 0.5,
    secondRerankerScore: 0,
    identityRerankerScore: 0.7,
    lexicalTitleMatch: 0,
    lexicalContentMatch: 1
  },
  {
    threadId: "C",
    identityCosine: 0,
    bestPassageCosine: 0.55,
    bestRerankerScore: -0.2,
    secondRerankerScore: 0,
    identityRerankerScore: 0,
    lexicalTitleMatch: 0,
    lexicalContentMatch: 1
  },
  {
    threadId: "D",
    identityCosine: 0.6,
    bestPassageCosine: 0,
    bestRerankerScore: 0,
    secondRerankerScore: 0,
    identityRerankerScore: 0.25,
    lexicalTitleMatch: 1,
    lexicalContentMatch: 0
  }
];

function withoutThread(
  features: ThreadFeatures[],
  threadId: string
): ThreadFeatures[] {
  return features.filter((item) => item.threadId !== threadId);
}

test("features follow the declared channels, selection and lexical fields", () => {
  assert.deepEqual(threadFeatures(BASE_CHANNELS, RERANK_SCORES), EXPECTED);
});

test("the feature vectors keep the fixed feature order", () => {
  assert.equal(FEATURE_NAMES.length, 7);
  const thread = EXPECTED[0];
  assert.deepEqual(featureVectorOf(thread), [0.8, 0.7, 0.9, 0.4, 0.3, 1, 0]);
  assert.deepEqual(
    semanticOnlyVectorOf(thread),
    [0.8, 0.7, 0.9, 0.4, 0.3, 0, 0]
  );
});

test("reversing the channel arrays changes no feature", () => {
  const reversed: MemorySearchChannels = {
    identities: [...BASE_CHANNELS.identities].reverse(),
    passages: [...BASE_CHANNELS.passages].reverse(),
    lexical: [...BASE_CHANNELS.lexical].reverse()
  };
  assert.deepEqual(threadFeatures(reversed, RERANK_SCORES), EXPECTED);
});

test("removing thread B changes no feature of the other threads", () => {
  const withoutB: MemorySearchChannels = {
    identities: BASE_CHANNELS.identities.filter(
      (item) => item.record.threadId !== "B"
    ),
    passages: BASE_CHANNELS.passages.filter(
      (item) => item.record.threadId !== "B"
    ),
    lexical: BASE_CHANNELS.lexical.filter(
      (item) => item.record.threadId !== "B"
    )
  };
  assert.deepEqual(
    threadFeatures(withoutB, RERANK_SCORES),
    withoutThread(EXPECTED, "B")
  );
});

test("adding a strong thread E changes no feature of the other threads", () => {
  const eIdentity = recordOf("E-identity", "E", "identity");
  const ePassage = recordOf("E-passage-1", "E", "passage");
  const withE: MemorySearchChannels = {
    identities: [...BASE_CHANNELS.identities, hit(eIdentity, 0.99)],
    passages: [...BASE_CHANNELS.passages, hit(ePassage, 0.98)],
    lexical: BASE_CHANNELS.lexical
  };
  const scores = new Map(RERANK_SCORES);
  scores.set("E-identity", 0.5);
  scores.set("E-passage-1", 0.5);
  const features = threadFeatures(withE, scores);
  assert.deepEqual(withoutThread(features, "E"), EXPECTED);
});

/** Explicit reranker score of each document of the declared records. */
const DOCUMENT_SCORES = new Map<string, number>([
  [semanticRerankingDocument(RECORDS.aIdentity), 0.3],
  [semanticRerankingDocument(RECORDS.bIdentity), 0.7],
  [semanticRerankingDocument(RECORDS.dIdentity), 0.25],
  [semanticRerankingDocument(RECORDS.a1), 0.9],
  [semanticRerankingDocument(RECORDS.a2), 0.1],
  [semanticRerankingDocument(RECORDS.a3), 0.4],
  [semanticRerankingDocument(RECORDS.a4), 0.95],
  [semanticRerankingDocument(RECORDS.b1), 0.5],
  [semanticRerankingDocument(RECORDS.c1), -0.2]
]);

test("the best reranker score matches the production ranking", async () => {
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map((document) => Number(DOCUMENT_SCORES.get(document)))
  );
  const production = await rankHybridMemoryCandidates(
    "query",
    BASE_CHANNELS,
    reranker
  );
  const relevance = new Map(
    production.map((thread) => [
      thread.evidence.record.threadId,
      thread.relevance
    ])
  );
  const features = new Map(EXPECTED.map((item) => [item.threadId, item]));
  assert.deepEqual([...relevance.keys()].sort(), ["A", "B", "C", "D"]);
  assert.equal(relevance.get("A"), features.get("A")?.bestRerankerScore);
  assert.equal(relevance.get("B"), features.get("B")?.bestRerankerScore);
  assert.equal(relevance.get("C"), features.get("C")?.bestRerankerScore);
  assert.equal(relevance.get("D"), features.get("D")?.identityRerankerScore);
});

test("a selected passage without a rerank score stops the features", () => {
  const scores = new Map(RERANK_SCORES);
  scores.delete("A-passage-1");
  assert.throws(
    () => threadFeatures(BASE_CHANNELS, scores),
    /Missing rerank score for record A-passage-1/
  );
});
