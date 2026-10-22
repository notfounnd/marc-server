import assert from "node:assert/strict";
import test from "node:test";
import {
  APPLY_LIMIT,
  SUGGEST_LIMIT,
  decideChoice
} from "../scripts/memory-eval/choice-decision.js";

test("the H8 limits are the fixed values, before any measurement", () => {
  assert.equal(APPLY_LIMIT, 0.9);
  assert.equal(SUGGEST_LIMIT, 0.6);
});

test("the apply and suggest limits are inclusive", () => {
  assert.equal(decideChoice(0.9, 0.1), "apply");
  assert.equal(decideChoice(0.6, 0.4), "suggest");
});

test("just below a limit the decision steps down", () => {
  assert.equal(decideChoice(0.8999999, 0.1000001), "suggest");
  assert.equal(decideChoice(0.5999999, 0.4000001), "none");
});

test("keep wins when it is more likely, and an exact tie takes no action", () => {
  assert.equal(decideChoice(0.7, 0.8), "none");
  assert.equal(decideChoice(0.5, 0.5), "none");
  assert.equal(decideChoice(0.9, 0.9), "none");
});
