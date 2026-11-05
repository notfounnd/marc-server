import assert from "node:assert/strict";
import { test } from "node:test";
import { activationSettingsInputOf } from "../src/core/activation-settings-input.js";
import {
  MAX_SUPERVISION_RECORDS,
  belowFloor,
  pruneSupervision
} from "../src/core/activation-supervision-records.js";
import type {
  SupervisionRecord,
  SupervisionState,
  SupervisionStatus
} from "../src/core/activation-supervision-types.js";
import { renderActivitySection } from "../src/core/thread-activity-markdown.js";
import { isOptionalSupervision } from "../src/daemon/activation-supervision-file.js";
import { expireState } from "../src/daemon/supervision-sweep.js";
import {
  supervisionCardsOf,
  supervisionCountsOf
} from "../src/daemon/supervision-views.js";

const T0 = "2026-11-10T12:00:00.000Z";
const MIN = 60_000;

function card(
  overrides: Partial<SupervisionRecord> & { messageId: string }
): SupervisionRecord {
  return {
    messageAt: "2026-11-10T11:00:00.000Z",
    recipient: "claude-second-architect",
    stage: "planning",
    status: "waiting",
    createdAt: T0,
    expiresAt: new Date(Date.parse(T0) + 1440 * MIN).toISOString(),
    attempt: 0,
    ...overrides
  };
}

test("the activation section input keeps only present keys and refuses invalid ones", async (t) => {
  const rows: Array<[string, unknown, unknown]> = [
    ["absent section", undefined, undefined],
    ["empty object", {}, undefined],
    ["cycles only", { cyclesPerStage: 3 }, { cyclesPerStage: 3 }],
    ["time limit only", { turnTimeoutMinutes: 90 }, { turnTimeoutMinutes: 90 }],
    [
      "both keys",
      { cyclesPerStage: 2, turnTimeoutMinutes: 15 },
      { cyclesPerStage: 2, turnTimeoutMinutes: 15 }
    ],
    ["cycles above range", { cyclesPerStage: 21 }, "invalid"],
    ["time limit below range", { turnTimeoutMinutes: 14 }, "invalid"],
    ["time limit not integer", { turnTimeoutMinutes: 60.5 }, "invalid"],
    ["section not an object", "60", "invalid"],
    [
      "one invalid key spoils the section",
      { cyclesPerStage: 3, turnTimeoutMinutes: 5 },
      "invalid"
    ]
  ];
  for (const [name, input, expected] of rows) {
    await t.test(name, () => {
      assert.deepEqual(activationSettingsInputOf(input), expected);
    });
  }
});

test("the supervision state validator accepts the shape and refuses malformed values", async (t) => {
  const valid: SupervisionState = {
    records: [card({ messageId: "m1" })],
    floors: { "claude-second-architect": "2026-11-10T11:00:00.000Z" }
  };
  const rows: Array<[string, unknown, boolean]> = [
    ["absent key", undefined, true],
    ["valid state", valid, true],
    [
      "unknown status",
      {
        records: [{ ...valid.records[0], status: "running_maybe" }],
        floors: {}
      },
      false
    ],
    [
      "negative attempt",
      { records: [{ ...valid.records[0], attempt: -1 }], floors: {} },
      false
    ],
    ["non-text floor", { records: [], floors: { a: 1 } }, false],
    [
      "unknown stage",
      { records: [{ ...valid.records[0], stage: "review_later" }], floors: {} },
      false
    ]
  ];
  for (const [name, value, expected] of rows) {
    await t.test(name, () => {
      assert.equal(isOptionalSupervision(value), expected);
    });
  }
});

test("the expiry sweep expires only pending and failed cards past their deadline", async (t) => {
  const due = (status: SupervisionStatus): SupervisionRecord =>
    card({ messageId: status, status, expiresAt: T0 });
  const later = new Date(Date.parse(T0) + MIN).toISOString();
  const rows: Array<[SupervisionStatus, SupervisionStatus]> = [
    ["waiting", "expired"],
    ["awaiting_confirmation", "expired"],
    ["failed", "expired"],
    ["starting", "starting"],
    ["running", "running"]
  ];
  for (const [before, after] of rows) {
    await t.test(`${before} after its deadline becomes ${after}`, () => {
      const state: SupervisionState = { records: [due(before)], floors: {} };
      const next = expireState(state, later);
      assert.equal(next.records[0]?.status, after);
    });
  }
});

test("an expired card moves its recipient's floor, so the same mention is not recreated", () => {
  const state: SupervisionState = {
    records: [card({ messageId: "m1", status: "waiting", expiresAt: T0 })],
    floors: {}
  };
  const next = expireState(state, new Date(Date.parse(T0) + MIN).toISOString());
  const [record] = next.records;
  assert.ok(record);
  assert.equal(next.floors[record.recipient], record.messageAt);
  assert.equal(
    belowFloor(record.messageAt, next.floors[record.recipient]),
    true
  );
});

test("pruning keeps the newest settled cards and the floor refuses the pruned ones", () => {
  const settled = Array.from(
    { length: MAX_SUPERVISION_RECORDS + 2 },
    (_, index) =>
      card({
        messageId: `m${index}`,
        status: "declined",
        messageAt: new Date(Date.parse(T0) - (index + 1) * MIN).toISOString(),
        createdAt: new Date(Date.parse(T0) + index * MIN).toISOString()
      })
  );
  const pruned = pruneSupervision({ records: settled, floors: {} });
  assert.equal(pruned.records.length, MAX_SUPERVISION_RECORDS);
  const oldest = settled[settled.length - 1];
  assert.ok(oldest);
  assert.equal(
    belowFloor(oldest.messageAt, pruned.floors[oldest.recipient]),
    true
  );
});

test("active cards are never pruned, even above the limit", () => {
  const active = Array.from(
    { length: MAX_SUPERVISION_RECORDS + 1 },
    (_, index) => card({ messageId: `a${index}`, status: "starting" })
  );
  const pruned = pruneSupervision({ records: active, floors: {} });
  assert.equal(pruned.records.length, MAX_SUPERVISION_RECORDS + 1);
});

test("the panel shows only cards that have not left it", async (t) => {
  const rows: Array<[SupervisionStatus, boolean]> = [
    ["waiting", true],
    ["awaiting_confirmation", true],
    ["starting", true],
    ["running", true],
    ["failed", true],
    ["done", false],
    ["declined", false],
    ["expired", false],
    ["superseded", false]
  ];
  for (const [status, shown] of rows) {
    await t.test(`${status} shown: ${shown}`, () => {
      const cards = supervisionCardsOf({
        records: [card({ messageId: status, status })],
        floors: {}
      });
      assert.equal(cards.length, Number(shown));
    });
  }
});

test("the card view carries no run id, outcome or process data", () => {
  const [view] = supervisionCardsOf({
    records: [
      card({
        messageId: "m1",
        status: "running",
        runId: "secret-run",
        outcome: { costUsd: 0.01, denials: 0 }
      })
    ],
    floors: {}
  });
  assert.equal(JSON.stringify(view).includes("secret-run"), false);
  assert.equal("outcome" in (view ?? {}), false);
});

test("the Activity counts sum the started turns and count failed and expired cards", () => {
  const counts = supervisionCountsOf({
    records: [
      card({ messageId: "a", status: "done", attempt: 2 }),
      card({ messageId: "b", status: "failed", attempt: 1 }),
      card({ messageId: "c", status: "expired", attempt: 0 })
    ],
    floors: {}
  });
  assert.deepEqual(counts, {
    activations: 3,
    failures: 1,
    expired: 1,
    costUsd: 0
  });
});

const SUPERVISOR_LINE =
  "Supervisor: 2 activation(s), 1 failure(s), 0 expired card(s), estimated cost at API prices USD 0.0000.";

test("the Activity section shows the supervisor line only when it did something", async (t) => {
  const snapshotWith = (supervision: object | undefined) => ({
    status: "recorded" as const,
    snapshot: {
      threadId: "thread-1",
      profiles: [],
      stages: [],
      policyRevision: null,
      pausedDuringThread: "never" as const,
      conflicts: 0,
      ...supervision
    }
  });
  const rows: Array<[string, object | undefined, boolean]> = [
    ["no supervisor counts", undefined, false],
    [
      "all zero",
      { supervision: { activations: 0, failures: 0, expired: 0, costUsd: 0 } },
      false
    ],
    [
      "turns and a failure",
      { supervision: { activations: 2, failures: 1, expired: 0, costUsd: 0 } },
      true
    ]
  ];
  for (const [name, supervision, shown] of rows) {
    await t.test(name, () => {
      const section = renderActivitySection(
        snapshotWith(supervision) as Parameters<typeof renderActivitySection>[0]
      );
      assert.equal((section ?? "").includes(SUPERVISOR_LINE), shown);
    });
  }
});
