import assert from "node:assert/strict";
import test from "node:test";
import {
  admittedDepthPassages,
  admitsAnyGroup,
  rankDepthPoolPassages,
  type DepthPassage
} from "../src/core/memory/deep-pool.js";
import { rankHybridMemoryCandidates } from "../src/core/memory/hybrid-ranking.js";
import { SEMANTIC_ELIGIBILITY_THRESHOLD } from "../src/core/memory/semantic-ranking.js";
import { memoryBandOf } from "../src/core/memory/scoring/bands.js";
import type {
  MemoryLexicalSearchHit,
  MemorySearchChannels,
  MemorySearchHit,
  MemoryVectorRecord
} from "../src/core/memory/types.js";
import { FakeRerankingProvider } from "./memory-test-helpers.js";
import { recordFixture } from "./memory-deep-fixtures.js";

const QUERY = "toogle settings";

const alphaIdentity = recordFixture({
  recordId: "alpha-identity",
  threadId: "alpha-thread",
  kind: "identity",
  text: "alpha identity"
});
const alphaFirst = recordFixture({
  recordId: "alpha-first",
  threadId: "alpha-thread",
  kind: "passage",
  text: "alpha first passage about toggle settings",
  sectionTitle: "Result",
  passageOrdinal: 1
});
const alphaSecond = recordFixture({
  recordId: "alpha-second",
  threadId: "alpha-thread",
  kind: "passage",
  text: "alpha second passage with the same score",
  sectionTitle: "Decision",
  passageOrdinal: 2
});
// Only identity: the group has no passage, so its identity is scored and never returned.
const betaIdentity = recordFixture({
  recordId: "beta-identity",
  threadId: "beta-thread",
  kind: "identity",
  text: "beta identity only"
});
// Lexical only: the passage is missing from the vector channel and reaches the pool by the lexical one.
const gammaPassage = recordFixture({
  recordId: "gamma-passage",
  threadId: "gamma-thread",
  kind: "passage",
  text: "gamma lexical only passage",
  passageOrdinal: 1
});
const deltaIdentity = recordFixture({
  recordId: "delta-identity",
  threadId: "delta-thread",
  kind: "identity",
  text: "delta identity"
});
const deltaPassage = recordFixture({
  recordId: "delta-passage",
  threadId: "delta-thread",
  kind: "passage",
  text: "delta passage about settings",
  passageOrdinal: 1
});

const CHANNELS: MemorySearchChannels = {
  identities: [
    hit(alphaIdentity, 0.9),
    hit(betaIdentity, 0.7),
    hit(deltaIdentity, 0.8)
  ],
  passages: [
    hit(alphaFirst, 0.8),
    hit(alphaSecond, 0.8),
    hit(deltaPassage, 0.8)
  ],
  lexical: [lexical(gammaPassage, 0.6), lexical(alphaFirst, 0.5)]
};

/** Ties (every score equal) and a spread of scores, so the pool order is exercised both ways. */
const SCORING_REGIMES: ReadonlyArray<
  readonly [string, (documents: string[]) => number[]]
> = [
  ["ties", (documents) => documents.map(() => 0.5)],
  ["spread", (documents) => documents.map((text) => (text.length % 7) / 7)]
];

SCORING_REGIMES.forEach(([regime, scoresOf]) => {
  test(`P1 (${regime}): the depth pool ranks like rankHybridMemoryCandidates on the same documents`, async () => {
    const poolReranker = new FakeRerankingProvider((_query, documents) =>
      scoresOf(documents)
    );
    const m0Reranker = new FakeRerankingProvider((_query, documents) =>
      scoresOf(documents)
    );

    const pool = await rankDepthPoolPassages(QUERY, CHANNELS, poolReranker);
    const m0 = await rankHybridMemoryCandidates(QUERY, CHANNELS, m0Reranker);

    assert.deepEqual(pool.ranked, m0);
    assert.deepEqual(
      poolReranker.rerankedDocuments,
      m0Reranker.rerankedDocuments
    );
    assert.deepEqual(
      poolReranker.rerankBatchSizes,
      m0Reranker.rerankBatchSizes
    );
    assert.equal(poolReranker.rerankCalls, 1);
  });

  test(`admitted passages (${regime}) are passages of admitted groups, best first, with their group band`, async () => {
    const reranker = new FakeRerankingProvider((_query, documents) =>
      scoresOf(documents)
    );
    const pool = await rankDepthPoolPassages(QUERY, CHANNELS, reranker);

    const passages = admittedDepthPassages(pool);

    assert.ok(passages.every((passage) => passage.record.kind === "passage"));
    assert.ok(
      passages.every((passage) => passage.record.threadId !== "beta-thread")
    );
    assert.ok(
      isBestFirst(passages),
      "passages must be ordered by score, then rank"
    );
    assert.deepEqual(
      passages.map((passage) => passage.groupBand),
      passages.map((passage) => bandOfGroup(pool.ranked, passage))
    );
  });
});

test("the pool scores every record, identities included, but reports identity-only groups as not passages", async () => {
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map(() => 0.5)
  );
  const pool = await rankDepthPoolPassages(QUERY, CHANNELS, reranker);

  assert.equal(pool.passageScores.get("beta-identity"), 0.5);
  assert.ok(
    pool.entries.some((entry) => entry.evidence.record.kind === "identity")
  );
  assert.ok(
    admittedDepthPassages(pool).every(
      (passage) => passage.record.recordId !== "beta-identity"
    )
  );
  assert.equal(
    admitsAnyGroup(pool),
    pool.ranked.some((thread) => thread.eligibility >= 0.5)
  );
});

// The admitted group has an identity and the better passage rank, so it ranks first and keeps its own
// eligibility. The gated group has no identity and a passage of higher reranker score, so it ranks second,
// and the eligibility ceiling of the ranking keeps it below the threshold.
test("a group below the admission threshold stays out, even with a passage of higher reranker score", async () => {
  const admittedIdentity = recordFixture({
    recordId: "gated-admitted-identity",
    threadId: "gated-admitted-thread",
    kind: "identity",
    text: "admitted identity"
  });
  const admittedPassage = recordFixture({
    recordId: "alpha-only-passage",
    threadId: "gated-admitted-thread",
    kind: "passage",
    text: "alpha passage",
    passageOrdinal: 1
  });
  const gatedPassage = recordFixture({
    recordId: "gated-passage",
    threadId: "gated-thread",
    kind: "passage",
    text: "beta passage",
    passageOrdinal: 1
  });
  const channels: MemorySearchChannels = {
    identities: [hit(admittedIdentity, 0.9)],
    passages: [hit(admittedPassage, 0.8), hit(gatedPassage, 0.05)],
    lexical: []
  };
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map(scoreOfGatedText)
  );

  const pool = await rankDepthPoolPassages(QUERY, channels, reranker);

  const gated = pool.ranked.find(
    (thread) => thread.evidence.record.threadId === "gated-thread"
  );
  const admitted = pool.ranked.find(
    (thread) => thread.evidence.record.threadId === "gated-admitted-thread"
  );
  // (a) the gated group has a passage in the pool, and its eligibility is below the threshold
  assert.ok(
    pool.entries.some(
      (entry) => entry.evidence.record.recordId === "gated-passage"
    ),
    "the gated passage must be in the pool"
  );
  assert.ok(
    gated !== undefined && gated.eligibility < SEMANTIC_ELIGIBILITY_THRESHOLD
  );
  assert.ok(
    admitted !== undefined &&
      admitted.eligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD
  );
  // (b) the gated passage has a higher reranker score than a passage of the admitted group
  const gatedScore = pool.passageScores.get("gated-passage");
  const admittedScore = pool.passageScores.get("alpha-only-passage");
  assert.ok(
    gatedScore !== undefined &&
      admittedScore !== undefined &&
      gatedScore > admittedScore
  );
  // Nothing of the gated group leaves the admitted output, and the admitted passage does.
  const passages = admittedDepthPassages(pool);
  assert.equal(
    passages.some((passage) => passage.record.threadId === "gated-thread"),
    false
  );
  assert.ok(
    passages.some((passage) => passage.record.recordId === "alpha-only-passage")
  );
});

const GATED_SCORES: ReadonlyArray<readonly [string, number]> = [
  ["beta passage", 0.5],
  ["alpha passage", 0.3]
];

function scoreOfGatedText(document: string): number {
  const match = GATED_SCORES.find(([text]) => document.includes(text));
  return match?.[1] ?? 0;
}

function hit(record: MemoryVectorRecord, score: number): MemorySearchHit {
  return { record, score };
}

function lexical(
  record: MemoryVectorRecord,
  vectorScore: number
): MemoryLexicalSearchHit {
  return { field: "summary", record, score: 1, vectorScore };
}

/** Score descending, then denseRank ascending, then recordId ascending: the order of the output. */
function isBestFirst(passages: DepthPassage[]): boolean {
  return passages.slice(1).every((passage, index) => {
    const previous = passages[index];
    return previous !== undefined && compareDepth(previous, passage) <= 0;
  });
}

function compareDepth(left: DepthPassage, right: DepthPassage): number {
  return (
    right.score - left.score ||
    left.denseRank - right.denseRank ||
    left.record.recordId.localeCompare(right.record.recordId)
  );
}

function bandOfGroup(
  ranked: Awaited<ReturnType<typeof rankDepthPoolPassages>>["ranked"],
  passage: DepthPassage
): ReturnType<typeof memoryBandOf> {
  const group = ranked.find(
    (thread) => thread.evidence.record.threadId === passage.record.threadId
  );
  return memoryBandOf(group?.eligibility ?? 0);
}
