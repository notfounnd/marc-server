import assert from "node:assert/strict";
import test from "node:test";
import {
  rankHybridMemoryCandidates,
  semanticHitsForChannels
} from "../src/core/memory/hybrid-ranking.js";
import { rankSemanticMemoryCandidates } from "../src/core/memory/semantic-ranking.js";
import {
  admittedOfAllCandidates,
  admittedOfM0,
  rankFixtureOf
} from "./memory-funnel-rank-fixtures.js";

test("an ineligible group ranked above a group by rankingScore does not cap it: the funnel admits what M0 admits", async () => {
  // g0 has the best rankingScore, but its semantic eligibility is below the threshold. Its title hit moves it
  // below g1 and g2 in the hybrid order, so the M0 order differs from the rankingScore order.
  const { channels, reranker, input } = rankFixtureOf(
    [
      {
        id: "g0",
        identity: 0.95,
        identityRerank: 0.5,
        passages: [{ id: "g0-passage", score: 0.9, rerank: 0.05 }]
      },
      {
        id: "g1",
        identity: 0.75,
        identityRerank: 0.5,
        passages: [{ id: "g1-passage", score: 0.6, rerank: 0.2 }]
      },
      {
        id: "g2",
        identity: 0.65,
        identityRerank: 0.5,
        passages: [{ id: "g2-passage", score: 0.7, rerank: 0.65 }]
      }
    ],
    ["g0-passage"]
  );
  const m0 = await rankHybridMemoryCandidates("query", channels, reranker);
  const byRankingScore = await rankSemanticMemoryCandidates(
    "query",
    semanticHitsForChannels(channels),
    reranker
  );
  assert.notDeepEqual(
    m0.map((thread) => thread.evidence.record.threadId),
    byRankingScore.map((thread) => thread.evidence.record.threadId)
  );
  assert.deepEqual(admittedOfAllCandidates(input), admittedOfM0(m0));
});

test("ALL_CANDIDATES gives the M0 admitted sequence and the M0 eligibilities", async () => {
  const { channels, reranker, input } = rankFixtureOf(
    [
      {
        id: "g0",
        identity: 0.65,
        identityRerank: 0.5,
        passages: [{ id: "g0-passage", score: 0.6, rerank: 0.5 }]
      },
      {
        id: "g1",
        identity: 0.75,
        identityRerank: 0.5,
        passages: [{ id: "g1-passage", score: 0.6, rerank: 0.65 }]
      },
      {
        id: "g2",
        identity: 0.55,
        identityRerank: 0.5,
        passages: [{ id: "g2-passage", score: 0.8, rerank: 0.35 }]
      },
      {
        id: "g3",
        identity: 0.95,
        identityRerank: 0.5,
        passages: [{ id: "g3-passage", score: 0.8, rerank: 0.95 }]
      }
    ],
    ["g0-passage", "g1-passage", "g2-passage"]
  );
  const m0 = await rankHybridMemoryCandidates("query", channels, reranker);
  assert.deepEqual(admittedOfAllCandidates(input), admittedOfM0(m0));
});
