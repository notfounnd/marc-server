import assert from "node:assert/strict";
import test from "node:test";
import { queryInterpretationMessages } from "../src/core/memory/query-interpretation-inference.js";

test("makes literal selection the conservative interpretation default", () => {
  const messages = queryInterpretationMessages("toogle", ["toogle", "toggle"]);
  const system = messages[0]?.content ?? "";

  assert.match(system, /Candidate 0 is the default/i);
  assert.match(system, /clear accidental character-level typo/i);
  assert.match(system, /Do not select synonyms, inflections/i);
  assert.match(system, /If uncertain, select 0/i);
});

test("includes guard feedback in a repeated interpretation request", () => {
  const messages = queryInterpretationMessages(
    "toogle",
    ["toogle", "toggle"],
    "Return an integer index from 0 to 1."
  );

  assert.match(messages[1]?.content ?? "", /Correction: Return an integer/);
});
