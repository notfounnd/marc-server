import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  RegistryFile,
  SessionBinding
} from "../src/core/session-slots.js";
import { emptyRegistryFile } from "../src/daemon/session-file.js";
import { reserveBinding } from "../src/daemon/session-transitions.js";

const SLOT = {
  workspaceId: "w",
  threadId: "t",
  profile: "claude-second-architect"
};
const KEY = "w:t:claude-second-architect";
const NOW = "2026-11-10T12:00:00.000Z";

/** A binding as an earlier reservation left it: released, with the session total it reported, when any. */
function previousOf(
  nativeSessionId: string,
  lastCostUsd: number | undefined
): SessionBinding {
  return {
    ...SLOT,
    client: "claude-code",
    nativeSessionId,
    hostId: "host",
    origin: "supervisor",
    generation: 1,
    owner: {},
    boundAt: NOW,
    endedAt: NOW,
    conflicts: [],
    ...Object.fromEntries(
      [["lastCostUsd", lastCostUsd]].filter(([, value]) => value !== undefined)
    )
  };
}

/** A registry file that holds the previous binding under the slot key, or no binding at all. */
function fileWith(previous: SessionBinding | undefined): RegistryFile {
  const slots = Object.fromEntries(
    [[KEY, previous]].filter(([, binding]) => binding !== undefined)
  ) as Record<string, SessionBinding>;
  return { ...emptyRegistryFile(), slots };
}

/**
 * Each row reserves the slot again under a session. A continuing session keeps the total its last turn
 * reported; a new session, or a slot with no earlier binding, starts without one.
 */
const ROWS: readonly {
  name: string;
  previous: SessionBinding | undefined;
  nativeSessionId: string;
  origin: SessionBinding["origin"];
  expected: number | undefined;
}[] = [
  {
    name: "the same session keeps the total of its last supervised turn",
    previous: previousOf("session-a", 0.005),
    nativeSessionId: "session-a",
    origin: "supervisor",
    expected: 0.005
  },
  {
    name: "the same session keeps the total when a human opens it",
    previous: previousOf("session-a", 0.005),
    nativeSessionId: "session-a",
    origin: "open",
    expected: 0.005
  },
  {
    name: "the same session without a recorded total keeps none",
    previous: previousOf("session-a", undefined),
    nativeSessionId: "session-a",
    origin: "supervisor",
    expected: undefined
  },
  {
    name: "a new session discards the total of the old one",
    previous: previousOf("session-a", 0.005),
    nativeSessionId: "session-b",
    origin: "supervisor",
    expected: undefined
  },
  {
    name: "a slot with no earlier binding starts without a total",
    previous: undefined,
    nativeSessionId: "session-a",
    origin: "supervisor",
    expected: undefined
  }
];

for (const row of ROWS) {
  test(`reserve the slot: ${row.name}`, () => {
    const result = reserveBinding(
      fileWith(row.previous),
      KEY,
      SLOT,
      {
        hostId: "host",
        nativeSessionId: row.nativeSessionId,
        ownerToken: "token",
        now: NOW
      },
      row.origin
    );
    assert.equal(result.file.slots[KEY].lastCostUsd, row.expected);
    assert.equal(result.file.slots[KEY].nativeSessionId, row.nativeSessionId);
  });
}
