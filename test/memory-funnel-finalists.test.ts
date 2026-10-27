import assert from "node:assert/strict";
import test from "node:test";
import { runFunnel, type FunnelConfig } from "../src/core/memory/funnel-run.js";
import { caseInput } from "./memory-funnel-fixtures.js";

/** The adaptive config without the stop rule: every step runs, so every step lists its finalists. */
const ADAPTIVE_NO_STOP: FunnelConfig = {
  depths: [0, 1, 2],
  stopOn: "none",
  budgeted: true,
  passages: "budget",
  finalists: "funnel"
};

test("each step lists the finalists it kept, with the pair ids it selected and used", () => {
  const input = caseInput({ budget: 12, k: 2 });
  const result = runFunnel(input, ADAPTIVE_NO_STOP);
  assert.ok(result.steps.length > 0);
  for (const step of result.steps) {
    const used = new Set([...step.scored, ...step.cached]);
    const kept = new Set(step.finalists.map((finalist) => finalist.groupId));
    assert.ok(
      step.finalists.length <= input.k,
      `step ${step.depth} keeps at most K finalists`
    );
    assert.equal(
      kept.size,
      step.finalists.length,
      `step ${step.depth} lists each finalist once`
    );
    for (const finalist of step.finalists) {
      assert.ok(
        finalist.recordIds.length > 0,
        `${finalist.groupId} selected at least one pair`
      );
      assert.ok(
        finalist.recordIds.every((recordId) => used.has(recordId)),
        `${finalist.groupId} selected only pairs that were scored or reused`
      );
    }
    assert.ok(
      step.admitted.every((item) => kept.has(item.groupId)),
      `step ${step.depth} admits only kept finalists`
    );
  }
});
