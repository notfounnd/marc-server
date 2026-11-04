import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveSlotState,
  type ClientProcess,
  type PresenceSources,
  type SessionBinding,
  type SlotStateName
} from "../src/core/session-slots.js";
import {
  NOW,
  OTHER,
  SESSION,
  STARTED,
  UNAVAILABLE,
  binding,
  entry,
  iso,
  live
} from "./core-session-slots-fixtures.js";

const RESUMED = STARTED + 1000;
const RELEASED = {
  endedAt: iso(-1000),
  owner: { clientPid: 100, clientStartedAt: STARTED }
};
const NO_STARTED_AT = {
  pid: 200,
  sessionId: SESSION,
  status: "idle"
} as unknown as ClientProcess;

type Row = {
  name: string;
  binding: SessionBinding;
  sources: PresenceSources;
  state: SlotStateName;
  reason: string;
  busy?: boolean;
  pastConflict?: boolean;
};

const resumeRows: Row[] = [
  {
    name: "a released binding resumes when one process carries the session with a verified startedAt",
    binding: binding(RELEASED),
    sources: live([entry({ pid: 200, startedAt: RESUMED })]),
    state: "online",
    reason: "session_resumed"
  },
  {
    name: "a marc open binding that still holds its owner token resumes the same way",
    binding: binding(),
    sources: live([entry({ pid: 200, startedAt: RESUMED })]),
    state: "online",
    reason: "session_resumed"
  },
  {
    name: "a reused pid with a new startedAt that carries the session resumes",
    binding: binding(),
    sources: live([entry({ pid: 100, startedAt: RESUMED })]),
    state: "online",
    reason: "session_resumed"
  },
  {
    name: "a resumed process reports its busy status",
    binding: binding(RELEASED),
    sources: live([entry({ pid: 200, startedAt: RESUMED, status: "busy" })]),
    state: "online",
    reason: "session_resumed",
    busy: true
  },
  {
    name: "two processes with the session conflict and never resume",
    binding: binding(RELEASED),
    sources: live([
      entry({ pid: 200, startedAt: RESUMED }),
      entry({ pid: 300, startedAt: RESUMED + 1000 })
    ]),
    state: "conflict",
    reason: "two_processes"
  },
  {
    name: "two processes conflict while the owner is still listed",
    binding: binding(),
    sources: live([entry(), entry({ pid: 300, startedAt: RESUMED })]),
    state: "conflict",
    reason: "two_processes"
  },
  {
    name: "an owner listed with another session keeps the session changed, not resumed",
    binding: binding(),
    sources: live([
      entry({ sessionId: OTHER }),
      entry({ pid: 200, startedAt: RESUMED })
    ]),
    state: "unknown",
    reason: "session_changed"
  },
  {
    name: "a single process without a verified startedAt stays unknown",
    binding: binding(RELEASED),
    sources: live([NO_STARTED_AT]),
    state: "unknown",
    reason: "identity_unproven"
  },
  {
    name: "an owner without a verified instance cannot prove absence, so nothing resumes",
    binding: binding({ endedAt: iso(-1000), owner: { clientPid: 100 } }),
    sources: live([entry({ pid: 200, startedAt: RESUMED })]),
    state: "unknown",
    reason: "identity_unproven"
  },
  {
    name: "a live reservation with a listed process stays reserved",
    binding: binding({
      owner: { ownerToken: "token", reservedAt: iso(-10_000) }
    }),
    sources: live([entry({ pid: 200, startedAt: RESUMED })]),
    state: "reserved",
    reason: "reservation_active"
  },
  {
    name: "a binding from another host never resumes",
    binding: binding({ ...RELEASED, hostId: "host-b" }),
    sources: live([entry({ pid: 200, startedAt: RESUMED })]),
    state: "unknown",
    reason: "other_host"
  },
  {
    name: "an unavailable agents source never resumes",
    binding: binding(RELEASED),
    sources: UNAVAILABLE,
    state: "unknown",
    reason: "agents_unavailable"
  },
  {
    name: "a recorded conflict still listed outranks a resume",
    binding: binding({
      ...RELEASED,
      conflicts: [{ sessionId: OTHER, at: iso(-500) }]
    }),
    sources: live([
      entry({ pid: 200, startedAt: RESUMED }),
      entry({ pid: 300, sessionId: OTHER, startedAt: RESUMED + 5 })
    ]),
    state: "conflict",
    reason: "recorded_conflict"
  },
  {
    name: "a recorded conflict against the resumed session itself is history: the session resumes",
    binding: binding({
      ...RELEASED,
      conflicts: [{ sessionId: SESSION, at: iso(-500) }]
    }),
    sources: live([entry({ pid: 200, startedAt: RESUMED })]),
    state: "online",
    reason: "session_resumed",
    pastConflict: true
  },
  {
    name: "a recorded self-conflict also resumes a marc open binding that still holds its token",
    binding: binding({ conflicts: [{ sessionId: SESSION, at: iso(-500) }] }),
    sources: live([entry({ pid: 200, startedAt: RESUMED })]),
    state: "online",
    reason: "session_resumed",
    pastConflict: true
  },
  {
    name: "a recorded self-conflict plus two processes stays a conflict",
    binding: binding({
      ...RELEASED,
      conflicts: [{ sessionId: SESSION, at: iso(-500) }]
    }),
    sources: live([
      entry({ pid: 200, startedAt: RESUMED }),
      entry({ pid: 300, startedAt: RESUMED + 1000 })
    ]),
    state: "conflict",
    reason: "two_processes"
  },
  {
    name: "a recorded conflict from another session still listed with the owner alive stays a conflict",
    binding: binding({ conflicts: [{ sessionId: OTHER, at: iso(-500) }] }),
    sources: live([entry(), entry({ pid: 300, sessionId: OTHER })]),
    state: "conflict",
    reason: "recorded_conflict"
  },
  {
    name: "a recorded self-conflict does not hide a live conflict from another listed session",
    binding: binding({
      ...RELEASED,
      conflicts: [
        { sessionId: SESSION, at: iso(-500) },
        { sessionId: OTHER, at: iso(-400) }
      ]
    }),
    sources: live([
      entry({ pid: 200, startedAt: RESUMED }),
      entry({ pid: 300, sessionId: OTHER, startedAt: RESUMED + 5 })
    ]),
    state: "conflict",
    reason: "recorded_conflict"
  }
];

for (const row of resumeRows) {
  test(`session resume state: ${row.name}`, () => {
    const result = deriveSlotState(row.binding, row.sources, NOW);
    assert.equal(result.state, row.state);
    assert.equal(result.details.reason, row.reason);
    assert.equal(result.details.busy, row.busy ?? false);
    assert.equal(result.details.pastConflict, row.pastConflict ?? false);
  });
}
