import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  holdTextOf,
  waitTextOf,
  WAITING_LABEL_KEYS,
  type WaitText
} from "../src/ui/thread-activation-waiting-model.js";

/** The detail each identity check names, in the en-US catalog. */
const DETAILS: ReadonlyArray<[string, string]> = [
  ["no_pid", "The listener did not say which process it is"],
  ["no_binding", "No session holds this slot yet"],
  ["session_mismatch", "A different session holds this slot"],
  ["no_client_pid", "The slot does not record its client process"],
  ["process_table_unavailable", "The process table could not be read"],
  ["not_descendant", "The listener does not run under the slot's client"],
  ["agents_unavailable", "The client list could not be read"],
  ["start_mismatch", "The slot's client is not running, or started again"]
];

const GENERAL: WaitText = waitTextOf("identity_unverified");

for (const [identityCheck, detail] of DETAILS) {
  test(`identity hold named ${identityCheck} shows its own detail`, () => {
    const text = holdTextOf({ reason: "identity_unverified", identityCheck });
    assert.equal(text.detail, detail);
    assert.equal(text.title, GENERAL.title);
  });
}

/** A hold without a listed check, or with a check of another reason, keeps the text its reason has. */
const FALLBACK: ReadonlyArray<{
  name: string;
  hold: { reason: string; identityCheck?: string };
  expected: WaitText;
}> = [
  {
    name: "an identity hold without a recorded check keeps the general text",
    hold: { reason: "identity_unverified" },
    expected: GENERAL
  },
  {
    name: "an identity hold with a code the table does not list keeps the general text",
    hold: { reason: "identity_unverified", identityCheck: "a_newer_check" },
    expected: GENERAL
  },
  {
    name: "an identity hold with verified keeps the general text",
    hold: { reason: "identity_unverified", identityCheck: "verified" },
    expected: GENERAL
  },
  {
    name: "a check on a busy hold is ignored",
    hold: { reason: "busy", identityCheck: "no_pid" },
    expected: waitTextOf("busy")
  },
  {
    name: "a pause hold keeps its own text",
    hold: { reason: "workspace_paused" },
    expected: waitTextOf("workspace_paused")
  }
];

for (const row of FALLBACK) {
  test(`hold text falls back: ${row.name}`, () => {
    assert.deepEqual(holdTextOf(row.hold), row.expected);
  });
}

test("every identity detail is a key of the section catalog", () => {
  for (const [, detail] of DETAILS) {
    assert.ok(WAITING_LABEL_KEYS.includes(detail), detail);
  }
});

test("every identity detail is in the en-US catalog", () => {
  const catalog = JSON.parse(
    fs.readFileSync("public/locales/en_US/translation.json", "utf8")
  ) as Record<string, string>;
  for (const [, detail] of DETAILS) {
    assert.equal(catalog[detail], detail);
  }
});
