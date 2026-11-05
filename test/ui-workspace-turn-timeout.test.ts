import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_TURN_TIMEOUT_MINUTES,
  isTurnTimeoutMinutes,
  MAX_TURN_TIMEOUT_MINUTES,
  MIN_TURN_TIMEOUT_MINUTES
} from "../src/core/activation-turn-timeout-limits.js";

/** The range and the default the settings field shows. The field and the daemon share these bounds. */
test("the turn time limit default is 60 minutes within a 15 to 480 range", () => {
  assert.equal(DEFAULT_TURN_TIMEOUT_MINUTES, 60);
  assert.equal(MIN_TURN_TIMEOUT_MINUTES, 15);
  assert.equal(MAX_TURN_TIMEOUT_MINUTES, 480);
  assert.equal(isTurnTimeoutMinutes(DEFAULT_TURN_TIMEOUT_MINUTES), true);
});

const ROWS: Array<[unknown, boolean]> = [
  [14, false],
  [15, true],
  [60, true],
  [480, true],
  [481, false],
  [15.5, false],
  [Number.NaN, false],
  [Number(""), false],
  ["60", false],
  [undefined, false]
];

for (const [value, valid] of ROWS) {
  test(`the field accepts ${String(value)}: ${valid}`, () => {
    assert.equal(isTurnTimeoutMinutes(value), valid);
  });
}
