import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveSlotState,
  isFreeState,
  type PresenceSources,
  type SessionBinding,
  type SlotStateName
} from "../src/core/session-slots.js";
import {
  binding,
  entry,
  iso,
  live,
  NOW,
  OTHER,
  STARTED,
  UNAVAILABLE
} from "./core-session-slots-fixtures.js";

type Row = {
  name: string;
  binding: SessionBinding | undefined;
  sources: PresenceSources;
  state: SlotStateName;
  reason: string;
  busy?: boolean;
  pastConflict?: boolean;
  listening?: boolean;
};

const rows: Row[] = [
  {
    name: "unbound slot has no binding",
    binding: undefined,
    sources: live([]),
    state: "unbound",
    reason: "no_binding"
  },
  {
    name: "online when pid, startedAt and sessionId match",
    binding: binding(),
    sources: live([entry()]),
    state: "online",
    reason: "owner_listed",
    busy: false
  },
  {
    name: "online busy reflects the status from claude agents",
    binding: binding(),
    sources: live([entry({ status: "busy" })]),
    state: "online",
    reason: "owner_listed",
    busy: true
  },
  {
    name: "listening is reported with the online owner",
    binding: binding(),
    sources: { ...live([entry()]), listening: true },
    state: "online",
    reason: "owner_listed",
    listening: true
  },
  {
    name: "ended by absence when the owner is not listed and the proof is complete",
    binding: binding(),
    sources: live([]),
    state: "ended",
    reason: "owner_absent"
  },
  {
    name: "ended by release when no live process holds the session",
    binding: binding({
      endedAt: iso(-1000),
      owner: { clientPid: 100, clientStartedAt: STARTED }
    }),
    sources: live([]),
    state: "ended",
    reason: "released"
  },
  {
    name: "a release does not end a session that is still listed",
    binding: binding({
      endedAt: iso(-1000),
      owner: { clientPid: 100, clientStartedAt: STARTED }
    }),
    sources: live([entry()]),
    state: "online",
    reason: "owner_listed"
  },
  {
    name: "unknown when the agents source is unavailable",
    binding: binding(),
    sources: UNAVAILABLE,
    state: "unknown",
    reason: "agents_unavailable"
  },
  {
    name: "unknown when the binding belongs to another host",
    binding: binding({ hostId: "host-b" }),
    sources: live([]),
    state: "unknown",
    reason: "other_host"
  },
  {
    name: "a reused pid with a different startedAt is not online",
    binding: binding(),
    sources: live([entry({ startedAt: STARTED + 5000, sessionId: OTHER })]),
    state: "ended",
    reason: "owner_absent"
  },
  {
    name: "conflict when two processes carry the binding session",
    binding: binding(),
    sources: live([entry({ pid: 200 }), entry({ pid: 300 })]),
    state: "conflict",
    reason: "two_processes"
  },
  {
    name: "a recorded conflict whose session is still listed outranks online",
    binding: binding({ conflicts: [{ sessionId: OTHER, at: iso(-500) }] }),
    sources: live([entry(), entry({ pid: 200, sessionId: OTHER })]),
    state: "conflict",
    reason: "recorded_conflict"
  },
  {
    name: "a recorded conflict whose session is gone leaves the owner online as a past conflict",
    binding: binding({ conflicts: [{ sessionId: OTHER, at: iso(-500) }] }),
    sources: live([entry()]),
    state: "online",
    reason: "owner_listed",
    pastConflict: true
  },
  {
    name: "a live reservation with one listed process is reserved, not unproven",
    binding: binding({
      owner: { ownerToken: "token", reservedAt: iso(-10_000) }
    }),
    sources: live([entry({ pid: 300 })]),
    state: "reserved",
    reason: "reservation_active"
  },
  {
    name: "an incomplete source stays unknown even with a recorded conflict",
    binding: binding({ conflicts: [{ sessionId: OTHER, at: iso(-500) }] }),
    sources: UNAVAILABLE,
    state: "unknown",
    reason: "agents_unavailable",
    pastConflict: true
  },
  {
    name: "/clear keeps pid and startedAt but changes the session: unknown, not ended",
    binding: binding(),
    sources: live([entry({ sessionId: OTHER })]),
    state: "unknown",
    reason: "session_changed"
  },
  {
    name: "the same UUID in another verified instance resumes when the owner is gone",
    binding: binding(),
    sources: live([entry({ pid: 200, startedAt: STARTED + 1 })]),
    state: "online",
    reason: "session_resumed"
  },
  {
    name: "an owner without startedAt or ownerToken is unknown even when the proof shows it absent",
    binding: binding({ owner: { clientPid: 100 } }),
    sources: live([]),
    state: "unknown",
    reason: "no_proof"
  },
  {
    name: "an active reservation is reserved and blocks other owners",
    binding: binding({
      owner: { ownerToken: "token", reservedAt: iso(-10_000) }
    }),
    sources: live([]),
    state: "reserved",
    reason: "reservation_active"
  },
  {
    name: "a recent heartbeat keeps a reservation active",
    binding: binding({
      owner: {
        ownerToken: "token",
        reservedAt: iso(-120_000),
        lastHeartbeatAt: iso(-5000)
      }
    }),
    sources: live([]),
    state: "reserved",
    reason: "reservation_active"
  },
  {
    name: "an expired reservation with proof is ended and free",
    binding: binding({
      owner: { ownerToken: "token", reservedAt: iso(-60_000) }
    }),
    sources: live([]),
    state: "ended",
    reason: "reservation_expired"
  },
  {
    name: "an expired reservation without an agents source is unknown",
    binding: binding({
      owner: { ownerToken: "token", reservedAt: iso(-60_000) }
    }),
    sources: UNAVAILABLE,
    state: "unknown",
    reason: "agents_unavailable"
  },
  {
    name: "an expired reservation with the session listed elsewhere is unproven",
    binding: binding({
      owner: { ownerToken: "token", reservedAt: iso(-60_000) }
    }),
    sources: live([entry({ pid: 300 })]),
    state: "unknown",
    reason: "identity_unproven"
  },
  {
    name: "a released binding without an agents source is unknown",
    binding: binding({ endedAt: iso(-1000), owner: {} }),
    sources: UNAVAILABLE,
    state: "unknown",
    reason: "agents_unavailable"
  }
];

for (const row of rows) {
  test(`slot state: ${row.name}`, () => {
    const result = deriveSlotState(row.binding, row.sources, NOW);
    assert.equal(result.state, row.state);
    assert.equal(result.details.reason, row.reason);
    assert.equal(result.details.busy, row.busy ?? false);
    assert.equal(result.details.listening, row.listening ?? false);
    assert.equal(result.details.pastConflict, row.pastConflict ?? false);
  });
}

const FREE_STATES: Array<[SlotStateName, boolean]> = [
  ["unbound", true],
  ["ended", true],
  ["online", false],
  ["reserved", false],
  ["unknown", false],
  ["conflict", false]
];

for (const [state, expected] of FREE_STATES) {
  test(`only unbound and proven ended slots are free: ${state}`, () => {
    assert.equal(isFreeState(state), expected);
  });
}
