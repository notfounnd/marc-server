import assert from "node:assert/strict";
import test from "node:test";
import {
  appendOnlyProblems,
  complementRoundOf,
  countPlanOf,
  type ComplementRound,
  type EvidencePassage
} from "../scripts/memory-eval/matrix-plan.js";
import { evidenceMatchesOf } from "../scripts/memory-eval/evidence-match.js";
import {
  fingerprintOf,
  type FingerprintComponents
} from "../scripts/memory-eval/capture-fingerprint.js";

/** Components of a fingerprint for the tests; the model identity is not read here. */
const COMPONENTS = {
  queryFingerprint: "queries",
  models: {},
  packageVersion: "0.3.0",
  sourceHash: "source",
  corpusDigest: "digest"
} as unknown as FingerprintComponents;

test("a capture that records the rerank order gets its own id; one that does not keeps its id", () => {
  const withoutOrder = fingerprintOf(COMPONENTS);
  const withOrder = fingerprintOf({ ...COMPONENTS, rerankOrder: "length" });
  assert.notEqual(withOrder.captureId, withoutOrder.captureId);
  assert.equal(
    fingerprintOf({ ...COMPONENTS, rerankOrder: undefined }).captureId,
    withoutOrder.captureId
  );
});

test("the count sums the pairs of every case and converts them to hours at the adopted throughput", () => {
  const plan = countPlanOf([1000, 2000, 3000]);
  assert.equal(plan.totalPairs, 6000);
  assert.ok(Math.abs(plan.hours - 6000 / 11.74 / 3600) < 1e-12);
  assert.equal(plan.refused, false);
});

test("a count of exactly the limit is accepted, and one pair more is refused", () => {
  // One pair per second makes the hours exact: 43200 pairs are 12 hours.
  assert.equal(countPlanOf([43200], 1, 12).refused, false);
  assert.equal(countPlanOf([43201], 1, 12).refused, true);
});

test("a complement round adds only the records that the case does not hold, in order", () => {
  const round = complementRoundOf({
    round: 2,
    caseId: "case-a",
    held: new Set(["rec-a", "rec-b"]),
    scope: new Set(["rec-a", "rec-b", "rec-d", "rec-c"])
  });
  assert.deepEqual(round, {
    round: 2,
    caseId: "case-a",
    addedRecordIds: ["rec-c", "rec-d"]
  });
});

test("the complement log only grows: a kept round is accepted, a rewritten or dropped round is refused", () => {
  const first: ComplementRound = {
    round: 1,
    caseId: "case-a",
    addedRecordIds: ["rec-c"]
  };
  const second: ComplementRound = {
    round: 2,
    caseId: "case-a",
    addedRecordIds: ["rec-d"]
  };
  const rewritten: ComplementRound = {
    round: 1,
    caseId: "case-a",
    addedRecordIds: ["rec-z"]
  };
  assert.deepEqual(appendOnlyProblems([first], [first, second]), []);
  assert.equal(appendOnlyProblems([first], [rewritten, second]).length, 1);
  assert.equal(appendOnlyProblems([first, second], [first]).length, 1);
});

const PASSAGES: EvidencePassage[] = [
  {
    passageId: "p1",
    sourcePath: "threads/t/CHAT.md",
    text: "Intro about the reactor."
  },
  {
    passageId: "p2",
    sourcePath: "threads/t/CHAT.md",
    text: "retry budget for the bank connector is three attempts"
  }
];

const SOURCE_TEXTS = new Map([
  [
    "threads/t/CHAT.md",
    "Intro about the reactor. retry budget for the bank connector is three attempts"
  ]
]);

test("a quote held whole by one passage is indexed, and its passage id is recorded", () => {
  const [match] = evidenceMatchesOf({
    evidence: [
      {
        sourcePath: "threads/t/CHAT.md",
        quote: "retry budget for the bank connector is three attempts"
      }
    ],
    passages: PASSAGES,
    sourceTexts: SOURCE_TEXTS
  });
  assert.equal(match?.status, "indexed");
  assert.deepEqual(match?.passageIds, ["p2"]);
});

test("a quote that the source holds but that is split between two passages is evidence_unindexable", () => {
  const [match] = evidenceMatchesOf({
    evidence: [
      {
        sourcePath: "threads/t/CHAT.md",
        quote: "about the reactor. retry budget for the bank"
      }
    ],
    passages: PASSAGES,
    sourceTexts: SOURCE_TEXTS
  });
  assert.equal(match?.status, "evidence_unindexable");
  assert.deepEqual(match?.passageIds, []);
});

test("a quote that the source lacks is missing", () => {
  const [match] = evidenceMatchesOf({
    evidence: [
      {
        sourcePath: "threads/t/CHAT.md",
        quote: "linear backoff with jitter for everyone"
      }
    ],
    passages: PASSAGES,
    sourceTexts: SOURCE_TEXTS
  });
  assert.equal(match?.status, "missing");
});
