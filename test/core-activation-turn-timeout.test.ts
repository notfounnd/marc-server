import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_TURN_TIMEOUT_MINUTES,
  MINUTE_MS,
  STOP_GRACE_MS,
  STOP_NOW_MESSAGE,
  deadlineNotice,
  effectiveTurnTimeoutOf,
  isTurnTimeoutMinutes,
  rawTurnTimeoutOf,
  turnTimeoutContentHash,
  turnTimeoutStateOf,
  warningMessage,
  type DeadlineNotice,
  type TurnTimeoutAuthorization
} from "../src/core/activation-turn-timeout.js";
import type { RawActivity } from "../src/core/activation-cycles.js";

const AT = "2026-11-10T12:00:00.000Z";

const minuteRows: { name: string; value: unknown; valid: boolean }[] = [
  { name: "the default of 60 is valid", value: 60, valid: true },
  { name: "the minimum of 15 is valid", value: 15, valid: true },
  { name: "the maximum of 480 is valid", value: 480, valid: true },
  { name: "14 is below the minimum", value: 14, valid: false },
  { name: "481 is above the maximum", value: 481, valid: false },
  {
    name: "a fraction is not a whole number of minutes",
    value: 60.5,
    valid: false
  },
  { name: "a string is not a number", value: "60", valid: false },
  { name: "a missing value is invalid", value: undefined, valid: false }
];

for (const row of minuteRows) {
  test(`turn timeout value: ${row.name}`, () => {
    assert.equal(isTurnTimeoutMinutes(row.value), row.valid);
  });
}

const effectiveRows: {
  name: string;
  activation: unknown;
  expected: unknown;
}[] = [
  {
    name: "a missing section means the default",
    activation: undefined,
    expected: 60
  },
  {
    name: "a section without the key means the default",
    activation: { cyclesPerStage: 3 },
    expected: 60
  },
  {
    name: "the key is taken as written",
    activation: { turnTimeoutMinutes: 90 },
    expected: 90
  },
  {
    name: "a section that is not an object is taken as written, so the pin changes",
    activation: "not-an-object",
    expected: "not-an-object"
  }
];

for (const row of effectiveRows) {
  test(`effective turn timeout: ${row.name}`, () => {
    assert.deepStrictEqual(
      effectiveTurnTimeoutOf(row.activation),
      row.expected
    );
  });
}

const authorized90: TurnTimeoutAuthorization = {
  turnTimeoutMinutes: 90,
  hash: turnTimeoutContentHash(90),
  at: AT
};

const stateRows: {
  name: string;
  raw: RawActivity;
  authorization: TurnTimeoutAuthorization | undefined;
  status: "authorized" | "tampered";
  turnTimeoutMinutes: number;
}[] = [
  {
    name: "nothing recorded and no key in the file is authorized at the default",
    raw: { status: "readable", activation: undefined },
    authorization: undefined,
    status: "authorized",
    turnTimeoutMinutes: DEFAULT_TURN_TIMEOUT_MINUTES
  },
  {
    name: "a hand edit with nothing recorded is tampered, at the default",
    raw: { status: "readable", activation: { turnTimeoutMinutes: 90 } },
    authorization: undefined,
    status: "tampered",
    turnTimeoutMinutes: DEFAULT_TURN_TIMEOUT_MINUTES
  },
  {
    name: "an unreadable file is tampered",
    raw: { status: "unreadable" },
    authorization: undefined,
    status: "tampered",
    turnTimeoutMinutes: DEFAULT_TURN_TIMEOUT_MINUTES
  },
  {
    name: "the recorded value matching the file is authorized",
    raw: { status: "readable", activation: { turnTimeoutMinutes: 90 } },
    authorization: authorized90,
    status: "authorized",
    turnTimeoutMinutes: 90
  },
  {
    name: "a file value that differs from the recorded one is tampered, and the recorded value holds",
    raw: { status: "readable", activation: { turnTimeoutMinutes: 120 } },
    authorization: authorized90,
    status: "tampered",
    turnTimeoutMinutes: 90
  }
];

for (const row of stateRows) {
  test(`turn timeout state: ${row.name}`, () => {
    assert.deepStrictEqual(turnTimeoutStateOf(row.raw, row.authorization), {
      status: row.status,
      turnTimeoutMinutes: row.turnTimeoutMinutes
    });
  });
}

const rawRows: {
  name: string;
  config: unknown;
  status: RawActivity["status"];
}[] = [
  {
    name: "a parsed config object is readable",
    config: { activation: {} },
    status: "readable"
  },
  {
    name: "a config that is not an object is unreadable",
    config: null,
    status: "unreadable"
  },
  { name: "an array is unreadable", config: [], status: "unreadable" }
];

for (const row of rawRows) {
  test(`raw activation: ${row.name}`, () => {
    assert.equal(rawTurnTimeoutOf(row.config).status, row.status);
  });
}

const DEADLINE = 1_000_000_000_000;

const noticeRows: {
  name: string;
  now: number;
  expected: DeadlineNotice;
}[] = [
  {
    name: "eleven minutes before the deadline there is no notice",
    now: DEADLINE - 11 * MINUTE_MS,
    expected: { kind: "none" }
  },
  {
    name: "ten minutes before the deadline the warning starts",
    now: DEADLINE - 10 * MINUTE_MS,
    expected: {
      kind: "warning",
      minutesLeft: 10,
      message: warningMessage(10)
    }
  },
  {
    name: "a fraction of a minute left is rounded up",
    now: DEADLINE - 9.5 * MINUTE_MS,
    expected: {
      kind: "warning",
      minutesLeft: 10,
      message: warningMessage(10)
    }
  },
  {
    name: "one millisecond before the deadline still warns with one minute",
    now: DEADLINE - 1,
    expected: {
      kind: "warning",
      minutesLeft: 1,
      message: warningMessage(1)
    }
  },
  {
    name: "at the deadline the turn must stop now",
    now: DEADLINE,
    expected: { kind: "stop", message: STOP_NOW_MESSAGE }
  },
  {
    name: "inside the grace period the turn is still asked to stop",
    now: DEADLINE + STOP_GRACE_MS - 1,
    expected: { kind: "stop", message: STOP_NOW_MESSAGE }
  },
  {
    name: "when the grace period has run out the process tree is killed",
    now: DEADLINE + STOP_GRACE_MS,
    expected: { kind: "kill" }
  }
];

for (const row of noticeRows) {
  test(`deadline notice: ${row.name}`, () => {
    assert.deepStrictEqual(
      deadlineNotice(row.now, DEADLINE, STOP_GRACE_MS),
      row.expected
    );
  });
}

test("the default pin is the hash of the default value", () => {
  assert.equal(
    turnTimeoutContentHash(DEFAULT_TURN_TIMEOUT_MINUTES),
    turnTimeoutContentHash(60)
  );
  assert.notEqual(turnTimeoutContentHash(60), turnTimeoutContentHash(61));
});
