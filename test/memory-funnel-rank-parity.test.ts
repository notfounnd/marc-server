import assert from "node:assert/strict";
import test from "node:test";
import { rankHybridMemoryCandidates } from "../src/core/memory/hybrid-ranking.js";
import {
  admittedOfAllCandidates,
  admittedOfM0,
  rankFixtureOf
} from "./memory-funnel-rank-fixtures.js";

test("a tie of reranker scores between groups is ordered as M0 orders it, by the entries of the step", async () => {
  // A's and B's best passages tie at 0.5: M0 gives the earlier entry (A, which ranks first by identity) the lower
  // global rank. The funnel must give the same ranks, without a tie-break by dense rank or by groupId.
  const { channels, reranker, input } = rankFixtureOf(
    [
      {
        id: "A",
        identity: 0.9,
        identityRerank: 0.5,
        passages: [
          { id: "A-p", score: 0.8, rerank: 0.5 },
          { id: "A-q", score: 0.4, rerank: 0.2 }
        ]
      },
      {
        id: "B",
        identity: 0.85,
        identityRerank: 0.5,
        passages: [{ id: "B-p", score: 0.7, rerank: 0.5 }]
      },
      {
        id: "C",
        identity: 0.6,
        identityRerank: 0.5,
        passages: [{ id: "C-p", score: 0.6, rerank: 0.7 }]
      },
      {
        id: "D",
        identity: 0.5,
        identityRerank: 0.5,
        passages: [{ id: "D-p", score: 0.3, rerank: 0.1 }]
      }
    ],
    ["A-p", "B-p"]
  );
  const m0 = await rankHybridMemoryCandidates("query", channels, reranker);
  assert.deepEqual(admittedOfAllCandidates(input), admittedOfM0(m0));
});

test("an identity-only group is ranked by its identity, as M0 ranks it", async () => {
  // E has no passage: M0 reranks its identity alone, so its identity score and its rank come from the identity.
  const { channels, reranker, input } = rankFixtureOf(
    [
      { id: "E", identity: 0.8, identityRerank: 0.6, passages: [] },
      {
        id: "F",
        identity: 0.7,
        identityRerank: 0.5,
        passages: [{ id: "F-p", score: 0.6, rerank: 0.4 }]
      },
      {
        id: "G",
        identity: 0.9,
        identityRerank: 0.3,
        passages: [{ id: "G-p", score: 0.5, rerank: 0.9 }]
      }
    ],
    []
  );
  const m0 = await rankHybridMemoryCandidates("query", channels, reranker);
  assert.deepEqual(admittedOfAllCandidates(input), admittedOfM0(m0));
});
