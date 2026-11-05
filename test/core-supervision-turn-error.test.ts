import assert from "node:assert/strict";
import { test } from "node:test";
import { errorTurnResult } from "../src/core/supervision-turn-outcome.js";

test("a turn the executor could not record ends failed with the error reason and claims no cost", () => {
  assert.deepEqual(errorTurnResult(), {
    ending: { status: "failed", reason: "error" },
    outcome: { denials: 0, failure: "error" }
  });
});
