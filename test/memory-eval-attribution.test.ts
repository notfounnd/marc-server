import assert from "node:assert/strict";
import test from "node:test";
import { semanticRerankingDocument } from "../src/core/memory/semantic-ranking.js";
import type { MemoryVectorRecord } from "../src/core/memory/types.js";
import {
  attributeCase,
  MAX_RERANK_PASSAGES_PER_THREAD,
  type AttributionRow
} from "../scripts/memory-eval/attribution.js";
import type { CapturedChannels } from "../scripts/memory-eval/capture-types.js";
import { rerankPairKey } from "../scripts/memory-eval/recording-providers.js";
import type { VariantResult } from "../scripts/memory-eval/variants.js";

const QUERY = "consulta";
const ONE = "thread-one";
const TWO = "thread-two";

function baseRecord(
  recordId: string,
  threadId: string,
  kind: "identity" | "passage",
  text: string
): MemoryVectorRecord {
  return {
    recordId,
    threadId,
    title: `Title ${threadId}`,
    summaryPath: "SUMMARY.md",
    relativeSummaryPath: `threads/${threadId}/SUMMARY.md`,
    reference: `marc://$${threadId}`,
    kind,
    text,
    embeddingText: text
  };
}

function identityRecord(
  recordId: string,
  threadId: string,
  text: string
): MemoryVectorRecord {
  return baseRecord(recordId, threadId, "identity", text);
}

function passageRecord(
  recordId: string,
  threadId: string,
  text: string
): MemoryVectorRecord {
  return {
    ...baseRecord(recordId, threadId, "passage", text),
    sectionTitle: "Decisao"
  };
}

const records = [
  identityRecord("one:identity", ONE, "primeiro"),
  passageRecord("one:passage:001", ONE, "passagem um"),
  passageRecord("one:passage:002", ONE, "passagem dois"),
  passageRecord("one:passage:003", ONE, "passagem tres"),
  passageRecord("one:passage:004", ONE, "passagem quatro"),
  identityRecord("two:identity", TWO, "segundo"),
  passageRecord("two:passage:001", TWO, "passagem outra")
];

const recordMap = new Map(records.map((record) => [record.recordId, record]));

/** Matrix scores for every record. `fourth` is the score of the passage that the channels do not select. */
function matrixScores(fourth: number): Record<string, number> {
  const scores: Record<string, number> = {
    "one:identity": 0.1,
    "one:passage:001": 0.1,
    "one:passage:002": 0.2,
    "one:passage:003": 0.3,
    "one:passage:004": fourth,
    "two:identity": 0.5,
    "two:passage:001": 0.4
  };
  return Object.fromEntries(
    records.map((record) => [
      rerankPairKey(QUERY, semanticRerankingDocument(record)),
      scores[record.recordId] ?? 0
    ])
  );
}

function hit(recordId: string): { recordId: string; score: number } {
  return { recordId, score: 0.5 };
}

function admittedResult(threadId: string): VariantResult {
  return { threadId, score: 0.9, admitted: true };
}

function rejectedResult(threadId: string): VariantResult {
  return { threadId, score: 0.1, admitted: false };
}

type Scenario = {
  judgments: Record<string, 0 | 1 | 2 | 3>;
  results: VariantResult[];
  fourth?: number;
  identities?: string[];
  passages?: string[];
  positive?: boolean;
};

function attribute(scenario: Scenario): AttributionRow[] {
  const channels: CapturedChannels = {
    identities: (scenario.identities ?? ["one:identity", "two:identity"]).map(
      hit
    ),
    passages: (
      scenario.passages ?? [
        "one:passage:001",
        "one:passage:002",
        "one:passage:003"
      ]
    ).map(hit),
    lexical: []
  };
  return attributeCase({
    caseId: "C1",
    positive: scenario.positive ?? true,
    query: QUERY,
    channels,
    rerankScores: matrixScores(scenario.fourth ?? 0.1),
    records: recordMap,
    judgments: scenario.judgments,
    results: scenario.results
  });
}

test("success: the target is the first admitted thread", () => {
  const rows = attribute({
    judgments: { [ONE]: 3 },
    results: [admittedResult(ONE), admittedResult(TWO)]
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.category, "success");
  assert.equal(rows[0]?.position, 1);
  assert.equal(rows[0]?.passageSelectionSuspect, false);
});

test("candidate_recall: the target is in no channel", () => {
  const rows = attribute({
    judgments: { [TWO]: 3 },
    results: [admittedResult(ONE)],
    identities: ["one:identity"],
    passages: ["one:passage:001"]
  });
  assert.equal(rows[0]?.category, "candidate_recall");
  assert.equal(rows[0]?.position, null);
});

test("admission: present with eligibility below 0.5, and marked when the passage selection hides it", () => {
  const rows = attribute({
    judgments: { [ONE]: 3 },
    results: [admittedResult(TWO), rejectedResult(ONE)],
    fourth: 0.9
  });
  assert.equal(rows[0]?.category, "admission");
  assert.equal(rows[0]?.eligibility, 0.1);
  assert.equal(rows[0]?.passageSelectionSuspect, true);
});

test("admission without the mark when another thread keeps the best matrix score", () => {
  const rows = attribute({
    judgments: { [ONE]: 3 },
    results: [admittedResult(TWO), rejectedResult(ONE)],
    fourth: 0.4
  });
  assert.equal(rows[0]?.category, "admission");
  assert.equal(rows[0]?.passageSelectionSuspect, false);
});

test("a tie with the best score of another thread does not rank first", () => {
  const rows = attribute({
    judgments: { [ONE]: 3 },
    results: [admittedResult(TWO), rejectedResult(ONE)],
    fourth: 0.5
  });
  assert.equal(rows[0]?.passageSelectionSuspect, false);
});

test("ordering: admitted but not first, with the mark only when selection hides a better passage", () => {
  const plain = attribute({
    judgments: { [ONE]: 3 },
    results: [admittedResult(TWO), admittedResult(ONE)]
  });
  assert.equal(plain[0]?.category, "ordering");
  assert.equal(plain[0]?.passageSelectionSuspect, false);

  const marked = attribute({
    judgments: { [ONE]: 3 },
    results: [admittedResult(TWO), admittedResult(ONE)],
    fourth: 0.9
  });
  assert.equal(marked[0]?.category, "ordering");
  assert.equal(marked[0]?.passageSelectionSuspect, true);
});

test("the selection cap is three passages per thread, as in semantic-ranking.ts:20", () => {
  assert.equal(MAX_RERANK_PASSAGES_PER_THREAD, 3);
});

test("negative cases have no grade 3 target and produce no rows", () => {
  const rows = attribute({
    judgments: { [ONE]: 3 },
    results: [admittedResult(ONE)],
    positive: false
  });
  assert.deepEqual(rows, []);
});
