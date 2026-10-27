import assert from "node:assert/strict";
import test from "node:test";
import { admittedOfCandidates } from "../src/core/memory/funnel-admission.js";
import {
  lexicalRanksByThread,
  rankHybridMemoryCandidates,
  semanticHitsForChannels
} from "../src/core/memory/hybrid-ranking.js";
import {
  applyRerankScores,
  consolidateThreads,
  denseRanksByKind,
  rerankingEntriesOf,
  SEMANTIC_ELIGIBILITY_THRESHOLD,
  semanticRerankingDocument
} from "../src/core/memory/semantic-ranking.js";
import {
  admittedOfAllCandidates,
  admittedOfM0,
  rankFixtureOf,
  type RankGroup
} from "./memory-funnel-rank-fixtures.js";

/** Several passages per group, with distinct reranker scores, so that the M0 rank has no ties. */
const MULTI_PASSAGE_GROUPS: RankGroup[] = [
  {
    id: "g0",
    identity: 0.65,
    identityRerank: 0.5,
    passages: [
      { id: "g0-a", score: 0.6, rerank: 0.5 },
      { id: "g0-b", score: 0.5, rerank: 0.12 }
    ]
  },
  {
    id: "g1",
    identity: 0.75,
    identityRerank: 0.5,
    passages: [
      { id: "g1-a", score: 0.6, rerank: 0.65 },
      { id: "g1-b", score: 0.4, rerank: 0.3 }
    ]
  },
  {
    id: "g2",
    identity: 0.55,
    identityRerank: 0.5,
    passages: [
      { id: "g2-a", score: 0.8, rerank: 0.35 },
      { id: "g2-b", score: 0.7, rerank: 0.9 }
    ]
  },
  {
    id: "g3",
    identity: 0.95,
    identityRerank: 0.5,
    passages: [{ id: "g3-a", score: 0.8, rerank: 0.95 }]
  },
  // g4 is ineligible and has the best rankingScore: its ceiling must not reach the eligible groups.
  {
    id: "g4",
    identity: 0.95,
    identityRerank: 0.5,
    passages: [{ id: "g4-a", score: 0.9, rerank: 0.05 }]
  }
];
const MULTI_PASSAGE_TITLES = ["g0-a", "g1-a", "g2-a", "g4-a"];

test("ALL_CANDIDATES with several passages per group gives the M0 admitted sequence and eligibilities", async () => {
  const { channels, reranker, input } = rankFixtureOf(
    MULTI_PASSAGE_GROUPS,
    MULTI_PASSAGE_TITLES
  );
  const m0 = await rankHybridMemoryCandidates("query", channels, reranker);
  assert.ok(
    m0.some((thread) => thread.eligibility < SEMANTIC_ELIGIBILITY_THRESHOLD)
  );
  assert.deepEqual(admittedOfAllCandidates(input), admittedOfM0(m0));
});

test("the admission of the consolidated candidates, with the M0 rerank, gives the M0 admitted sequence", async () => {
  const { channels, reranker } = rankFixtureOf(
    MULTI_PASSAGE_GROUPS,
    MULTI_PASSAGE_TITLES
  );
  // The M0 candidates: the consolidated passages of every group, reranked with the M0 rank of each entry.
  const candidates = consolidateThreads(
    denseRanksByKind(semanticHitsForChannels(channels))
  );
  const entries = rerankingEntriesOf(candidates);
  const scores = await reranker.rerank(
    "query",
    entries.map((entry) => semanticRerankingDocument(entry.evidence.record)),
    0
  );
  const funnel = admittedOfCandidates(
    applyRerankScores(candidates, entries, scores),
    lexicalRanksByThread(channels)
  );
  const m0 = await rankHybridMemoryCandidates("query", channels, reranker);
  assert.deepEqual(
    funnel.map((item) => [item.groupId, item.eligibility]),
    admittedOfM0(m0)
  );
});
