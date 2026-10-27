import assert from "node:assert/strict";
import test from "node:test";
import {
  matrixScope,
  selectFinalists,
  type FunnelGroup,
  type ScopeGroup
} from "../src/core/memory/funnel-selection.js";
import { T0_K_GRID } from "../scripts/memory-eval/t0-funnel-math.js";

/** K_max of the T0 study: the largest K of the grid that fits the budget. */
const K_MAX = 30;

/**
 * Forty groups whose orders diverge on purpose. Fusion falls with the group index; the best
 * passage rank is a permutation of the index (step 7, modulo 40), so a group that is last by
 * fusion can be first by passage rank. Each group has an identity and three passages.
 */
const GROUPS: ScopeGroup[] = Array.from({ length: 40 }, (_, index) => {
  const groupId = `g${String(index).padStart(2, "0")}`;
  return {
    groupId,
    fusion: 1 / (index + 1),
    bestPassageRank: ((index * 7) % 40) + 1,
    identityRecordId: `${groupId}:identity`,
    passageRecordIds: [0, 1, 2].map((passage) => `${groupId}:p${passage}`)
  };
});

test("the fixture's fusion order and passage-rank order really diverge", () => {
  const byFusion = [...GROUPS].sort(
    (left, right) => right.fusion - left.fusion
  );
  const byPassage = [...GROUPS].sort(
    (left, right) => (left.bestPassageRank ?? 0) - (right.bestPassageRank ?? 0)
  );
  const top = K_MAX;
  const fusionTop = new Set(
    byFusion.slice(0, top).map((group) => group.groupId)
  );
  const passageTop = new Set(
    byPassage.slice(0, top).map((group) => group.groupId)
  );
  const onlyPassage = [...passageTop].filter(
    (groupId) => !fusionTop.has(groupId)
  );
  assert.ok(onlyPassage.length >= 5);
});

test("for every K of the grid, every finalist's passages fall inside the closed scope", () => {
  // Scope from the groups alone: the channel records are left out, so only the cut is tested.
  const scope = matrixScope({
    channelRecordIds: [],
    groups: GROUPS,
    kMax: K_MAX,
    knownGroupIds: new Set(),
    evidenceGroupIds: new Set()
  });
  for (const k of T0_K_GRID.filter((value) => value <= K_MAX)) {
    const finalists = selectFinalists(toFunnelGroups(GROUPS), k);
    for (const groupId of finalists) {
      const group = GROUPS.find((item) => item.groupId === groupId);
      for (const recordId of group?.passageRecordIds ?? []) {
        assert.ok(scope.has(recordId), `${recordId} of ${groupId} at K ${k}`);
      }
    }
  }
});

test("a finalist that enters only when K rises is inside the scope too", () => {
  // Scenario: going from K 8 to K 30 adds groups; the newly admitted ones must be in the scope.
  const scope = matrixScope({
    channelRecordIds: [],
    groups: GROUPS,
    kMax: K_MAX,
    knownGroupIds: new Set(),
    evidenceGroupIds: new Set()
  });
  const small = new Set(selectFinalists(toFunnelGroups(GROUPS), 8));
  const large = selectFinalists(toFunnelGroups(GROUPS), K_MAX);
  const entering = large.filter((groupId) => !small.has(groupId));
  assert.ok(entering.length > 0);
  for (const groupId of entering) {
    const group = GROUPS.find((item) => item.groupId === groupId);
    for (const recordId of group?.passageRecordIds ?? []) {
      assert.ok(scope.has(recordId), `${recordId} entering at K ${K_MAX}`);
    }
  }
});

test("the identity of every candidate group is in the scope, even outside the cut", () => {
  const scope = matrixScope({
    channelRecordIds: [],
    groups: GROUPS,
    kMax: 1,
    knownGroupIds: new Set(),
    evidenceGroupIds: new Set()
  });
  for (const group of GROUPS) {
    assert.ok(scope.has(group.identityRecordId ?? ""), group.groupId);
  }
});

function toFunnelGroups(groups: readonly ScopeGroup[]): FunnelGroup[] {
  return groups.map((group) => ({
    groupId: group.groupId,
    fusion: group.fusion,
    bestPassageRank: group.bestPassageRank
  }));
}
