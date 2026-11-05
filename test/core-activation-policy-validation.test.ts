import assert from "node:assert/strict";
import test from "node:test";
import {
  participantsOf,
  policyCandidate,
  saveErrorsOf,
  validatePolicy,
  type ProfileRef
} from "../src/core/activation-policy.js";
import { isLegacyPolicy } from "../src/core/activation-policy-v1.js";

const PROFILES: ProfileRef[] = [
  { id: "claude-software-architect", role: "architect" },
  { id: "codex-software-architect", role: "architect" },
  { id: "claude-dev", role: "developer" },
  { id: "ui-user", role: "user" }
];

const VALID_V2 = {
  version: 2,
  revision: "rev-1",
  enabled: true,
  mode: "confirm",
  attemptCap: 2,
  pendingTtlMinutes: 1440,
  updatedAt: "2026-11-05T00:00:00.000Z"
};

type ValidationRow = {
  name: string;
  input: unknown;
  field: string | undefined;
};

const VALIDATION_ROWS: ValidationRow[] = [
  {
    name: "a complete version 2 policy is valid",
    input: VALID_V2,
    field: undefined
  },
  {
    name: "version 1 is not a v2 policy",
    input: { ...VALID_V2, version: 1 },
    field: "version"
  },
  {
    name: "a non-boolean switch is refused",
    input: { ...VALID_V2, enabled: "yes" },
    field: "enabled"
  },
  {
    name: "attemptCap above five is out of range",
    input: { ...VALID_V2, attemptCap: 9 },
    field: "attemptCap"
  },
  { name: "a missing policy is never valid", input: undefined, field: "policy" }
];

for (const row of VALIDATION_ROWS) {
  test(`validate: ${row.name}`, () => {
    const result = validatePolicy(row.input);
    const first = result.ok ? undefined : result.errors[0]?.field;
    assert.equal(first, row.field);
  });
}

test("the form keeps only the switch and the limits", () => {
  const candidate = policyCandidate(
    {
      enabled: true,
      participants: ["x"],
      stages: [{ id: "a" }],
      attemptCap: 3
    },
    "rev-2",
    "2026-11-05T00:00:00.000Z"
  );
  assert.deepEqual(candidate, {
    enabled: true,
    attemptCap: 3,
    version: 2,
    mode: "confirm",
    revision: "rev-2",
    updatedAt: "2026-11-05T00:00:00.000Z"
  });
});

test("participants are every architect-role profile, computed live", () => {
  assert.deepEqual(participantsOf(PROFILES), [
    "claude-software-architect",
    "codex-software-architect"
  ]);
});

test("saving an enabled policy with no architect is refused", () => {
  const policy = validatePolicy(VALID_V2);
  assert.ok(policy.ok);
  assert.deepEqual(
    saveErrorsOf(policy.policy, [{ id: "claude-dev", role: "developer" }]),
    [{ field: "participants", code: "no_participants" }]
  );
});

test("a disabled policy never needs an architect to save", () => {
  const policy = validatePolicy({ ...VALID_V2, enabled: false });
  assert.ok(policy.ok);
  assert.deepEqual(saveErrorsOf(policy.policy, []), []);
});

test("an F3a version 1 file is recognized as legacy, not as a v2 policy", () => {
  assert.equal(isLegacyPolicy({ version: 1, enabled: true, stages: [] }), true);
  assert.equal(isLegacyPolicy(VALID_V2), false);
});
