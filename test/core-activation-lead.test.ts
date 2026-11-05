import assert from "node:assert/strict";
import test from "node:test";
import {
  appendLeadChange,
  effectiveLeadOf,
  LEAD_CHANGE_LIMIT,
  leadChangeRefusal,
  type LeadChange,
  type LeadChangeInput
} from "../src/core/activation-lead.js";

type LeadRow = {
  name: string;
  input: LeadChangeInput;
  expect: string | undefined;
};

/** The lead change in its order: the architect check, then the expected lead, then a real change. */
const LEAD_ROWS: readonly LeadRow[] = [
  {
    name: "a developer cannot become lead",
    input: {
      current: "a",
      expectedLead: "a",
      agentId: "dev",
      architect: false
    },
    expect: "not_architect"
  },
  {
    name: "a stale expected lead is refused",
    input: { current: "a", expectedLead: "x", agentId: "b", architect: true },
    expect: "lead_changed"
  },
  {
    name: "the same lead is refused",
    input: { current: "a", expectedLead: "a", agentId: "a", architect: true },
    expect: "same_lead"
  },
  {
    name: "a thread with no lead accepts the first architect",
    input: {
      current: undefined,
      expectedLead: null,
      agentId: "b",
      architect: true
    },
    expect: undefined
  },
  {
    name: "another architect becomes lead",
    input: { current: "a", expectedLead: "a", agentId: "b", architect: true },
    expect: undefined
  }
];

for (const row of LEAD_ROWS) {
  test(`lead change: ${row.name}`, () => {
    assert.equal(leadChangeRefusal(row.input), row.expect);
  });
}

type EffectiveRow = {
  name: string;
  derived: string | undefined;
  recorded: string | undefined;
  architects: string[];
  expect: string | undefined;
};

/** The shown lead: a recorded change only while its profile is still an architect, else the derived one. */
const EFFECTIVE_ROWS: readonly EffectiveRow[] = [
  {
    name: "a recorded architect wins over the derived one",
    derived: "claude",
    recorded: "codex",
    architects: ["claude", "codex"],
    expect: "codex"
  },
  {
    name: "a recorded profile that lost the architect role falls back to the derived lead",
    derived: "claude",
    recorded: "codex",
    architects: ["claude"],
    expect: "claude"
  },
  {
    name: "no recorded change shows the derived lead",
    derived: "claude",
    recorded: undefined,
    architects: ["claude"],
    expect: "claude"
  },
  {
    name: "no lead at all shows none",
    derived: undefined,
    recorded: undefined,
    architects: [],
    expect: undefined
  }
];

for (const row of EFFECTIVE_ROWS) {
  test(`effective lead: ${row.name}`, () => {
    assert.equal(
      effectiveLeadOf(row.derived, row.recorded, new Set(row.architects)),
      row.expect
    );
  });
}

test("the change list is bounded and keeps the newest changes", () => {
  const change = (index: number): LeadChange => ({
    at: `t${index}`,
    to: "a",
    by: "human"
  });
  const kept = Array.from({ length: LEAD_CHANGE_LIMIT + 3 }, (_, index) =>
    change(index)
  ).reduce<LeadChange[]>((list, item) => appendLeadChange(list, item), []);
  assert.equal(kept.length, LEAD_CHANGE_LIMIT);
  assert.equal(kept.at(-1)?.at, `t${LEAD_CHANGE_LIMIT + 2}`);
});
