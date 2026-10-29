import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDeepBudget,
  gateOf,
  isValidDeepBudget,
  MAX_DEEP_BUDGET,
  protocolOf,
  type ProtocolCase
} from "../scripts/memory-eval/deep-protocol.js";

const FOURTEEN: ProtocolCase[] = [
  ...Array.from({ length: 4 }, () => ({ scoped: false, scopePassages: null })),
  ...Array.from({ length: 9 }, () => ({ scoped: true, scopePassages: 40 })),
  { scoped: true, scopePassages: 502 }
];

test("the protocol is complete with fourteen cases of which four are unscoped and ten are scoped", () => {
  const protocol = protocolOf(FOURTEEN, 232);
  assert.equal(protocol.protocolIncomplete, false);
  assert.deepEqual(protocol.reasons, []);
  assert.equal(protocol.scopedAboveBudget, 1);
});

test("a protocol with thirteen cases or no scope above the budget is incomplete, and the gate is not applied", () => {
  const thirteen: ProtocolCase[] = [
    ...Array.from({ length: 4 }, () => ({
      scoped: false,
      scopePassages: null
    })),
    ...Array.from({ length: 9 }, () => ({ scoped: true, scopePassages: 40 }))
  ];
  const incomplete = protocolOf(thirteen, 232);
  assert.equal(incomplete.protocolIncomplete, true);
  assert.equal(
    incomplete.reasons.some((reason) => reason.includes("deep cases are 13")),
    true
  );
  assert.equal(
    incomplete.reasons.some((reason) => reason.includes("no scoped case")),
    true
  );
  const gate = gateOf(incomplete, [
    { successAdopted: true, incomplete: false, scopeConformAdopted: true }
  ]);
  assert.deepEqual(gate, {
    applied: false,
    passed: null,
    successAdopted: 1,
    requiredSuccess: 12,
    incompleteCases: 0,
    scopeConformAdopted: true
  });
});

test("the gate passes only with twelve successes, no incomplete case and full scope conformance", () => {
  const protocol = protocolOf(FOURTEEN, 232);
  const twelve = Array.from({ length: 14 }, (_, index) => ({
    successAdopted: index < 12,
    incomplete: false,
    scopeConformAdopted: true
  }));
  assert.equal(gateOf(protocol, twelve).passed, true);
  const eleven = twelve.map((item, index) => ({
    ...item,
    successAdopted: index < 11
  }));
  assert.equal(gateOf(protocol, eleven).passed, false);
  const withIncomplete = twelve.map((item, index) => ({
    ...item,
    incomplete: index === 13
  }));
  assert.equal(gateOf(protocol, withIncomplete).passed, false);
  const outOfScope = twelve.map((item, index) => ({
    ...item,
    scopeConformAdopted: index !== 0
  }));
  assert.equal(gateOf(protocol, outOfScope).passed, false);
});

test("the budget domain of a recuo is an integer from 1 to 231: 0, 232 and non-integers are refused", () => {
  assert.equal(MAX_DEEP_BUDGET, 231);
  assert.equal(isValidDeepBudget(1), true);
  assert.equal(isValidDeepBudget(231), true);
  assert.equal(isValidDeepBudget(0), false);
  assert.equal(isValidDeepBudget(232), false);
  assert.equal(isValidDeepBudget(1.5), false);
  assert.equal(isValidDeepBudget(Number.NaN), false);
  assert.equal(isValidDeepBudget(Number.POSITIVE_INFINITY), false);
});

test("assertDeepBudget accepts no budget and refuses each value outside the domain", () => {
  assert.equal(assertDeepBudget(undefined), undefined);
  assert.throws(() => assertDeepBudget(0), /from 1 to 231/);
  assert.throws(() => assertDeepBudget(232), /from 1 to 231/);
  assert.throws(() => assertDeepBudget(2.5), /from 1 to 231/);
});
