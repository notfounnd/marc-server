import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveSlotState,
  type ClientProcess,
  type PresenceSources,
  type SessionBinding,
  type SlotStateName
} from "../src/core/session-slots.js";

/**
 * Reservations and absence proof when the owner's startedAt is unknown. A reservation holds an
 * ownerToken and no clientStartedAt, with or without a clientPid. Absence is proven by the
 * complete agents source, with no process carrying the session or the owner's pid.
 */

const NOW = Date.parse("2026-11-03T12:00:00.000Z");
const HOST = "host-a";
const SESSION = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const STARTED = 1_793_747_271_627;

type Row = {
  name: string;
  binding: SessionBinding;
  sources: PresenceSources;
  state: SlotStateName;
  reason: string;
};

function iso(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

function binding(overrides: Partial<SessionBinding> = {}): SessionBinding {
  return {
    workspaceId: "ws-1",
    threadId: "thread-1",
    profile: "claude-dev",
    client: "claude-code",
    nativeSessionId: SESSION,
    hostId: HOST,
    origin: "open",
    generation: 3,
    owner: {},
    boundAt: iso(-60_000),
    conflicts: [],
    ...overrides
  };
}

function entry(overrides: Partial<ClientProcess> = {}): ClientProcess {
  return {
    pid: 100,
    startedAt: STARTED,
    sessionId: SESSION,
    status: "idle",
    ...overrides
  };
}

function live(processes: ClientProcess[]): PresenceSources {
  return {
    hostId: HOST,
    agents: { status: "available", processes },
    mcpLeases: [],
    listening: false
  };
}

const rows: Row[] = [
  {
    name: "an owner without startedAt whose pid is listed with another session is unknown",
    binding: binding({ owner: { clientPid: 100 } }),
    sources: live([entry({ sessionId: OTHER })]),
    state: "unknown",
    reason: "no_proof"
  },
  {
    name: "a reservation with a pid and no startedAt is reserved within the TTL",
    binding: binding({
      owner: { clientPid: 100, ownerToken: "token", reservedAt: iso(-10_000) }
    }),
    sources: live([]),
    state: "reserved",
    reason: "reservation_active"
  },
  {
    name: "a reservation with a pid and no startedAt stays reserved while its session is listed",
    binding: binding({
      owner: { clientPid: 100, ownerToken: "token", reservedAt: iso(-10_000) }
    }),
    sources: live([entry()]),
    state: "reserved",
    reason: "reservation_active"
  },
  {
    name: "an expired reservation with a pid and proof is ended",
    binding: binding({
      owner: { clientPid: 100, ownerToken: "token", reservedAt: iso(-60_000) }
    }),
    sources: live([]),
    state: "ended",
    reason: "reservation_expired"
  },
  {
    name: "an expired reservation whose pid is listed with another session is unknown",
    binding: binding({
      owner: { clientPid: 100, ownerToken: "token", reservedAt: iso(-60_000) }
    }),
    sources: live([entry({ sessionId: OTHER })]),
    state: "unknown",
    reason: "reservation_unproven"
  },
  {
    name: "a binding without a start time or a reservation is unknown, even when absent",
    binding: binding({ origin: "adopted", owner: { clientPid: 100 } }),
    sources: live([]),
    state: "unknown",
    reason: "no_proof"
  },
  {
    name: "a released binding without a start time ends when the proof shows it absent",
    binding: binding({ endedAt: iso(-1000), owner: { clientPid: 100 } }),
    sources: live([]),
    state: "ended",
    reason: "released"
  },
  {
    name: "a released binding without a start time is unknown while its pid is listed",
    binding: binding({ endedAt: iso(-1000), owner: { clientPid: 100 } }),
    sources: live([entry({ sessionId: OTHER })]),
    state: "unknown",
    reason: "released_unproven"
  }
];

for (const row of rows) {
  test(`reservation and absence: ${row.name}`, () => {
    const result = deriveSlotState(row.binding, row.sources, NOW);
    assert.equal(result.state, row.state);
    assert.equal(result.details.reason, row.reason);
  });
}
