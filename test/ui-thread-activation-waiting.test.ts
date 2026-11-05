import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import {
  WAITING_LABEL_KEYS,
  durationOf,
  permissionPathOf,
  supervisionPathOf,
  waitingCountOf,
  waitingItemsOf,
  waitTextOf,
  type WaitingKind
} from "../src/ui/thread-activation-waiting-model.js";
import type {
  ActivationHoldView,
  ActivationPermissionView,
  ActivationSupervisionCard,
  ActivationSupervisionStatus
} from "../src/ui/types.js";

const T0 = "2026-11-10T12:00:00.000Z";

function request(requestId: string): ActivationPermissionView {
  return {
    requestId,
    toolName: "Bash",
    summary: '{"command":"pnpm test"}',
    createdAt: T0,
    expiresAt: T0
  };
}

function card(
  overrides: Partial<ActivationSupervisionCard> & {
    status: ActivationSupervisionStatus;
  }
): ActivationSupervisionCard {
  return {
    messageId: `msg_${overrides.status}`,
    recipient: "claude-software-architect",
    stage: "planning",
    expiresAt: T0,
    attempt: 1,
    permissions: [],
    canRetry: false,
    canContinue: false,
    ...overrides
  };
}

function hold(messageId: string): ActivationHoldView {
  return {
    messageId,
    recipient: "codex-software-architect",
    stage: "planning",
    reason: "busy"
  };
}

/** Each row: one card status and its shape, and the one kind of row the section shows for it. */
const STATE_ROWS: Array<[string, ActivationSupervisionCard, WaitingKind[]]> = [
  [
    "awaiting confirmation is a start",
    card({ status: "awaiting_confirmation" }),
    ["start"]
  ],
  [
    "waiting is a wait",
    card({ status: "waiting", reason: "busy" }),
    ["waiting"]
  ],
  ["starting is a running row", card({ status: "starting" }), ["running"]],
  [
    "running without requests is a running row",
    card({ status: "running" }),
    ["running"]
  ],
  [
    "running with two requests is one row per request",
    card({
      status: "running",
      permissions: [request("r1"), request("r2")]
    }),
    ["permission", "permission"]
  ],
  [
    "a timed-out failure that can continue is a continue row",
    card({
      status: "failed",
      reason: "timeout",
      canContinue: true,
      canRetry: true
    }),
    ["continue"]
  ],
  [
    "a crash that can retry is a retry row",
    card({ status: "failed", reason: "crashed", canRetry: true }),
    ["retry"]
  ],
  [
    "a timed-out failure at the cap is a stopped row",
    card({
      status: "failed",
      reason: "timeout",
      canContinue: false,
      canRetry: false
    }),
    ["stopped"]
  ],
  [
    "a revoked failure is a stopped row",
    card({ status: "failed", reason: "revoked" }),
    ["stopped"]
  ],
  ["done leaves the panel", card({ status: "done" }), []],
  ["declined leaves the panel", card({ status: "declined" }), []],
  ["expired leaves the panel", card({ status: "expired" }), []],
  ["superseded leaves the panel", card({ status: "superseded" }), []]
];

for (const [name, shape, kinds] of STATE_ROWS) {
  test(`waiting section: ${name}`, () => {
    const kindsShown = waitingItemsOf({ supervision: [shape], holds: [] }).map(
      (item) => item.kind
    );
    assert.deepEqual(kindsShown, kinds);
  });
}

const COUNT_ROWS: Array<
  [string, Parameters<typeof waitingCountOf>[0], number]
> = [
  ["no items", { supervision: [], holds: [] }, 0],
  [
    "a start counts one",
    { supervision: [card({ status: "awaiting_confirmation" })], holds: [] },
    1
  ],
  [
    "each open permission request counts one",
    {
      supervision: [
        card({ status: "running", permissions: [request("r1"), request("r2")] })
      ],
      holds: []
    },
    2
  ],
  [
    "a continue or retry counts one",
    {
      supervision: [
        card({
          status: "failed",
          reason: "timeout",
          canContinue: true,
          canRetry: true
        }),
        card({ status: "failed", reason: "crashed", canRetry: true })
      ],
      holds: []
    },
    2
  ],
  [
    "waits, running turns, stopped failures and holds count nothing",
    {
      supervision: [
        card({ status: "waiting", reason: "busy" }),
        card({ status: "running" }),
        card({ status: "failed", reason: "revoked" })
      ],
      holds: [hold("msg_hold")]
    },
    0
  ],
  [
    "a mixed panel counts only what asks for an action",
    {
      supervision: [
        card({ status: "awaiting_confirmation" }),
        card({ status: "running", permissions: [request("r1")] }),
        card({ status: "waiting", reason: "not_listening" }),
        card({ status: "failed", reason: "timeout", canContinue: true })
      ],
      holds: [hold("msg_hold")]
    },
    3
  ]
];

for (const [name, view, count] of COUNT_ROWS) {
  test(`waiting count: ${name}`, () => {
    assert.equal(waitingCountOf(view), count);
  });
}

test("the section orders permissions, starts, actions, turns, then waits and holds", () => {
  const items = waitingItemsOf({
    supervision: [
      card({ status: "waiting", reason: "busy", messageId: "a" }),
      card({ status: "running", messageId: "b" }),
      card({ status: "awaiting_confirmation", messageId: "c" }),
      card({
        status: "failed",
        reason: "timeout",
        canContinue: true,
        messageId: "d"
      }),
      card({ status: "running", permissions: [request("r1")], messageId: "e" })
    ],
    holds: [hold("h")]
  });
  assert.deepEqual(
    items.map((item) => item.kind),
    ["permission", "start", "continue", "running", "waiting", "hold"]
  );
});

test("a hold is a row of the section that never counts", () => {
  const items = waitingItemsOf({ supervision: [], holds: [hold("msg_hold")] });
  assert.deepEqual(
    items.map((item) => item.kind),
    ["hold"]
  );
  assert.equal(
    waitingCountOf({ supervision: [], holds: [hold("msg_hold")] }),
    0
  );
});

test("the section is absent when the view has no items", () => {
  assert.deepEqual(waitingItemsOf(undefined), []);
  assert.deepEqual(
    waitingItemsOf({ supervision: undefined, holds: undefined }),
    []
  );
});

const DURATION_ROWS: Array<[number, string, number]> = [
  [0, "{{count}} min", 0],
  [59_000, "{{count}} min", 1],
  [60 * 60_000, "{{count}} h", 1],
  [23.5 * 60 * 60_000, "{{count}} h", 23],
  [42 * 60_000, "{{count}} min", 42]
];

for (const [ms, key, count] of DURATION_ROWS) {
  test(`duration of ${ms} ms reads as ${count} in ${key}`, () => {
    assert.deepEqual(durationOf(ms), { key, count });
  });
}

const WAIT_TEXT_ROWS: Array<[string | undefined, string]> = [
  ["not_listening", "{{agent}} is open but not listening"],
  ["busy", "{{agent}} is busy"],
  ["something_new", "{{agent}} is waiting"],
  [undefined, "{{agent}} is waiting"]
];

for (const [reason, title] of WAIT_TEXT_ROWS) {
  test(`wait text for ${reason ?? "no reason"} is ${title}`, () => {
    assert.equal(waitTextOf(reason).title, title);
  });
}

test("the card and permission paths use the daemon routes and encode the ids", () => {
  assert.equal(
    supervisionPathOf("ws 1", "thread/a", "approve"),
    "/api/workspaces/ws%201/threads/thread%2Fa/activation/supervision/approve"
  );
  assert.equal(
    permissionPathOf("ws", "t", "req-1"),
    "/api/workspaces/ws/threads/t/activation/supervision/permissions/req-1"
  );
});

test("every key of the section is in the en-US catalog", () => {
  const catalog = JSON.parse(
    fs.readFileSync("public/locales/en_US/translation.json", "utf8")
  ) as Record<string, string>;
  const missing = WAITING_LABEL_KEYS.filter((key) => !(key in catalog));
  assert.deepEqual(missing, []);
});
