import assert from "node:assert/strict";
import test from "node:test";
import {
  activityAfterSave,
  approvedAgentsOf,
  isApprovedAt,
  withApproval
} from "../src/daemon/activation-activity.js";
import {
  isThreadExtras,
  type ActivationApproval,
  type ThreadActivity
} from "../src/daemon/activation-file.js";

const ACTIVITY: ThreadActivity = {
  authorizedRevision: "rev-1",
  authorizedHash: "hash-1",
  currentStage: "planning",
  stages: {}
};

const FIRST: ActivationApproval = {
  agentId: "claude-software-architect",
  revision: "rev-1",
  at: "2026-11-10T12:00:00.000Z"
};

const SECOND: ActivationApproval = {
  agentId: "claude-second-architect",
  revision: "rev-1",
  at: "2026-11-10T12:01:00.000Z"
};

test("the thread file accepts an activation without approvals, and one with valid approvals", () => {
  assert.equal(isThreadExtras({ activation: ACTIVITY }), true);
  assert.equal(
    isThreadExtras({ activation: { ...ACTIVITY, approvals: [FIRST, SECOND] } }),
    true
  );
});

const INVALID_APPROVALS: Array<{ name: string; approvals: unknown }> = [
  { name: "a value that is not a list", approvals: { agentId: FIRST.agentId } },
  {
    name: "an approval without its revision",
    approvals: [{ agentId: FIRST.agentId, at: FIRST.at }]
  },
  {
    name: "an approval with an empty agent id",
    approvals: [{ ...FIRST, agentId: "" }]
  },
  {
    name: "an approval that is not a record",
    approvals: ["claude-software-architect"]
  }
];

for (const row of INVALID_APPROVALS) {
  test(`the thread file refuses ${row.name}`, () => {
    assert.equal(
      isThreadExtras({ activation: { ...ACTIVITY, approvals: row.approvals } }),
      false
    );
  });
}

test("an approval of an architect replaces its earlier approval and keeps the others", () => {
  const renewed: ActivationApproval = {
    ...FIRST,
    revision: "rev-2",
    at: "2026-11-11T09:00:00.000Z"
  };
  const activation = withApproval(
    withApproval(withApproval(ACTIVITY, FIRST), SECOND),
    renewed
  );
  assert.deepEqual(activation.approvals, [SECOND, renewed]);
});

const REVISION_CASES: Array<{
  name: string;
  agentId: string;
  revision: string | undefined;
  approved: boolean;
}> = [
  {
    name: "a valid approval counts under its revision",
    agentId: FIRST.agentId,
    revision: "rev-1",
    approved: true
  },
  {
    name: "an approval of another revision does not count",
    agentId: FIRST.agentId,
    revision: "rev-2",
    approved: false
  },
  {
    name: "no policy in force counts no approval",
    agentId: FIRST.agentId,
    revision: undefined,
    approved: false
  },
  {
    name: "an architect without approval does not count",
    agentId: "codex-software-architect",
    revision: "rev-1",
    approved: false
  }
];

for (const row of REVISION_CASES) {
  test(`approval check: ${row.name}`, () => {
    const activation = withApproval(ACTIVITY, FIRST);
    assert.equal(
      isApprovedAt(activation, row.agentId, row.revision),
      row.approved
    );
  });
}

test("the approved architects of a revision are listed in their order", () => {
  const activation = withApproval(withApproval(ACTIVITY, FIRST), SECOND);
  assert.deepEqual(approvedAgentsOf(activation, "rev-1"), [
    FIRST.agentId,
    SECOND.agentId
  ]);
});

test("a save clears every approval, because the saved activity does not carry them", () => {
  const approved = withApproval(withApproval(ACTIVITY, FIRST), SECOND);
  const saved = activityAfterSave(
    approved,
    { revision: "rev-2", hash: "hash-2" },
    "planning"
  );
  assert.equal(saved.approvals, undefined);
  assert.equal(saved.authorizedRevision, "rev-2");
  assert.deepEqual(approvedAgentsOf(saved, "rev-2"), []);
});
