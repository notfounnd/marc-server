import assert from "node:assert/strict";
import test from "node:test";
import {
  renderActivitySection,
  UNAVAILABLE_LINE,
  type ActivityRecord,
  type ThreadActivitySnapshot
} from "../src/core/thread-activity-markdown.js";

const EMPTY: ThreadActivitySnapshot = {
  threadId: "thread-1",
  profiles: [],
  stages: [],
  policyRevision: null,
  pausedDuringThread: "never",
  conflicts: 0
};

const FULL: ThreadActivitySnapshot = {
  threadId: "thread-1",
  profiles: [
    {
      profile: "claude-dev",
      role: "developer",
      origin: "open",
      startedAt: "2026-11-04T10:00:00.000Z",
      lastSeenAt: "2026-11-04T11:00:00.000Z",
      activations: 0
    },
    { profile: "codex-dev", role: "developer", origin: "none", activations: 0 }
  ],
  stages: [
    { id: "planning", cyclesUsed: 5, max: 5, outcome: "exhausted" },
    { id: "execution", cyclesUsed: 0, max: 5, outcome: "not_reached" }
  ],
  policyRevision: "5f2a-revision",
  pausedDuringThread: "yes",
  conflicts: 2
};

const GOLDEN_FULL = [
  "## Activity",
  "",
  "| Profile | Role | Origin | Started | Last seen | Activations |",
  "| --- | --- | --- | --- | --- | --- |",
  "| claude-dev | developer | open | 2026-11-04T10:00:00.000Z | 2026-11-04T11:00:00.000Z | 0 |",
  "| codex-dev | developer | none | - | - | 0 |",
  "",
  "| Stage | Cycles used | Max cycles | Outcome |",
  "| --- | --- | --- | --- |",
  "| Planning | 5 | 5 | exhausted |",
  "| Execution | 0 | 5 | not reached |",
  "",
  "Policy revision: `5f2a-revision`. Pause during the thread: yes. Recorded conflicts: 2."
].join("\n");

const SENTINELS = [
  "native-secret-123",
  "host-secret",
  "4242",
  "token-secret-xyz"
];

const CASES: ReadonlyArray<{
  name: string;
  record: ActivityRecord | undefined;
  expected: string | undefined;
}> = [
  { name: "no record", record: undefined, expected: undefined },
  {
    name: "empty recorded snapshot",
    record: { status: "recorded", snapshot: EMPTY },
    expected: undefined
  },
  {
    name: "daemon unavailable",
    record: { status: "unavailable" },
    expected: ["## Activity", "", UNAVAILABLE_LINE].join("\n")
  },
  {
    name: "full recorded snapshot",
    record: { status: "recorded", snapshot: FULL },
    expected: GOLDEN_FULL
  },
  {
    name: "policy without a bound profile",
    record: {
      status: "recorded",
      snapshot: { ...EMPTY, policyRevision: "rev-1" }
    },
    expected: [
      "## Activity",
      "",
      "No profile was bound in this thread.",
      "",
      "Policy revision: `rev-1`. Pause during the thread: never. Recorded conflicts: 0."
    ].join("\n")
  }
];

for (const row of CASES) {
  test(`activity section renders as expected: ${row.name}`, () => {
    assert.equal(renderActivitySection(row.record), row.expected);
  });
}

test("a pipe inside a value cannot break the table", () => {
  const section = renderActivitySection({
    status: "recorded",
    snapshot: {
      ...EMPTY,
      profiles: [
        { profile: "a|b", role: "developer", origin: "open", activations: 0 }
      ]
    }
  });
  assert.ok(section?.includes("| a\\|b | developer | open | - | - | 0 |"));
});

test("native session ids, process ids and owner tokens never reach the section, even when a caller passes them", () => {
  const leaking = {
    ...FULL,
    nativeSessionId: "native-secret-123",
    hostId: "host-secret",
    clientPid: 4242,
    ownerToken: "token-secret-xyz"
  } as unknown as ThreadActivitySnapshot;
  const section =
    renderActivitySection({ status: "recorded", snapshot: leaking }) ?? "";
  for (const sentinel of SENTINELS) {
    assert.equal(
      section.includes(sentinel),
      false,
      `section leaked ${sentinel}`
    );
  }
});
