import assert from "node:assert/strict";
import test from "node:test";
import {
  MissingRerankScore,
  runFunnel,
  type FunnelConfig
} from "../src/core/memory/funnel-run.js";
import { groupsOf } from "../src/core/memory/funnel-groups.js";
import {
  matrixScope,
  selectFinalists
} from "../src/core/memory/funnel-selection.js";
import {
  caseInput,
  channelsAt,
  IDENTITY_T1,
  SUMMARY_T1,
  ARTIFACT_T1,
  CHAT_T1,
  CHAT_T2
} from "./memory-funnel-fixtures.js";

const EXPLICIT_DEPTH_0: FunnelConfig = {
  depths: [0],
  stopOn: "none",
  budgeted: true,
  passages: "budget",
  finalists: "funnel"
};

const ADAPTIVE: FunnelConfig = { ...EXPLICIT_DEPTH_0, depths: [0, 1, 2] };

test("an explicit single depth reports a single step and the layers of that depth", () => {
  const result = runFunnel(caseInput(), EXPLICIT_DEPTH_0);
  assert.equal(result.stopReason, "single-step");
  assert.deepEqual(result.layersSearched, [0]);
  assert.equal(result.steps.length, 1);
});

test("adaptive steps score disjoint pairs and never exceed the budget", () => {
  // Scenario: the pairs scored by the three steps are all different, one scoring per pair.
  const result = runFunnel(caseInput({ budget: 12, k: 2 }), ADAPTIVE);
  const scored = result.steps.flatMap((step) => step.scored);
  assert.equal(new Set(scored).size, scored.length);
  assert.ok(result.pairsUnique <= 12);
  for (const step of result.steps) assert.ok(step.spent <= step.allowance);
});

test("a later step reuses the pairs that an earlier step scored, at no cost", () => {
  const result = runFunnel(caseInput({ budget: 12, k: 2 }), ADAPTIVE);
  const first = result.steps[0];
  const second = result.steps[1];
  assert.ok(first !== undefined && second !== undefined);
  const earlier = new Set(first.scored);
  assert.ok(second.cached.length > 0);
  assert.deepEqual(
    second.cached.filter((id) => !earlier.has(id)),
    []
  );
});

test("the first step of an adaptive search is never truncated when 3K fits in half the budget", () => {
  const result = runFunnel(caseInput({ budget: 12, k: 2 }), ADAPTIVE);
  assert.equal(result.steps[0]?.truncated, false);
});

test("a high-band top result stops the search after the first step", () => {
  // Scenario: every eligibility reaches a high cut of 0, so the first step stops the search.
  const result = runFunnel(caseInput({ cuts: { high: 0, medium: 0 } }), {
    ...ADAPTIVE,
    stopOn: "high"
  });
  assert.equal(result.stopReason, "high-band");
  assert.equal(result.steps.length, 1);
  assert.deepEqual(result.layersSearched, [0]);
});

test("a medium-band top result continues the adaptive search to the deepest layer", () => {
  // Scenario: the high cut is out of reach, so a medium result does not stop the search.
  const result = runFunnel(caseInput({ cuts: { high: 2, medium: 0 } }), {
    ...ADAPTIVE,
    stopOn: "high"
  });
  assert.equal(result.stopReason, "deepest-layer");
  assert.equal(result.steps.length, 3);
  assert.deepEqual(result.layersSearched, [0, 1, 2]);
});

test("a medium-band top result stops the high-or-medium rule", () => {
  // Scenario: the high cut is out of reach and the medium cut is 0, so the top band is medium.
  const result = runFunnel(caseInput({ cuts: { high: 2, medium: 0 } }), {
    ...ADAPTIVE,
    stopOn: "high-or-medium"
  });
  assert.equal(result.stopReason, "medium-band");
  assert.equal(result.steps.length, 1);
});

test("a missing reranker score is refused as MissingRerankScore, not as a zero", () => {
  // Scenario: the summary of t1 is a finalist passage, and its captured score is absent.
  const scores = new Map(caseInput().scores);
  scores.delete("t1-summary");
  assert.throws(
    () => runFunnel(caseInput({ scores }), EXPLICIT_DEPTH_0),
    (error: unknown) => error instanceof MissingRerankScore
  );
});

test("the same case gives the same result on two runs", () => {
  const input = caseInput({ budget: 12, k: 2 });
  assert.deepEqual(runFunnel(input, ADAPTIVE), runFunnel(input, ADAPTIVE));
});

test("an unbudgeted variant scores every pair it requests", () => {
  // Scenario: ALL_CANDIDATES reads every group with its consolidated M0 passages, and has no budget.
  const result = runFunnel(caseInput({ budget: 0, k: 0 }), {
    depths: [2],
    stopOn: "none",
    budgeted: false,
    passages: "consolidated",
    finalists: "all"
  });
  assert.equal(result.pairsUnique, result.pairsRequested);
  assert.ok(result.pairsUnique > 0);
});

test("a case with no balance runs no step, reports the budget, and searches no layer", () => {
  // Scenario: B 0 and K 0 leave no balance, so the first step has no allowance.
  const result = runFunnel(caseInput({ budget: 0, k: 0 }), ADAPTIVE);
  assert.equal(result.stopReason, "budget");
  assert.deepEqual(result.steps, []);
  assert.deepEqual(result.layersSearched, []);
  assert.deepEqual(result.admitted, []);
});

test("every finalist of every K up to kMax falls inside the closed matrix scope", () => {
  // Scope from the groups of depth two only, without the channel records, to test the groups.
  const groups = groupsOf(channelsAt(2), caseInput().vectors).map((group) => ({
    groupId: group.groupId,
    fusion: group.fusion,
    bestPassageRank: group.bestPassageRank,
    identityRecordId: group.identity?.record.recordId,
    passageRecordIds: group.passages.map((passage) => passage.record.recordId)
  }));
  const scope = matrixScope({
    channelRecordIds: [],
    groups,
    kMax: 2,
    knownGroupIds: new Set(),
    evidenceGroupIds: new Set()
  });
  for (let k = 1; k <= 2; k += 1) {
    const finalists = selectFinalists(groups, k);
    for (const groupId of finalists) {
      const group = groups.find((item) => item.groupId === groupId);
      for (const recordId of group?.passageRecordIds ?? []) {
        assert.ok(scope.has(recordId), `${recordId} of ${groupId} at K ${k}`);
      }
    }
  }
});

test("the fixture keeps identity, summary, artifact and chat records in their layers", () => {
  assert.equal(IDENTITY_T1.layer, 0);
  assert.equal(SUMMARY_T1.layer, 0);
  assert.equal(ARTIFACT_T1.layer, 1);
  assert.equal(CHAT_T1.layer, 2);
  assert.equal(CHAT_T2.layer, 2);
});
