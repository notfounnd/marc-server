import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveSlotState,
  type ObservedClient,
  type ObserveInput,
  type PresenceSources,
  type SessionBinding
} from "../src/core/session-slots.js";
import {
  observationView,
  planObservation,
  type ObservationPlan
} from "../src/daemon/session-observation.js";
import {
  HOST,
  NOW,
  SESSION,
  STARTED,
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

type PlanRow = {
  name: string;
  binding: SessionBinding | undefined;
  sources: PresenceSources;
  identity: ObservedClient;
  observedAt?: string;
  plan: ObservationPlan;
};

const CLIENT_200: ObservedClient = {
  nativeSessionId: SESSION,
  clientPid: 200,
  clientStartedAt: RESUMED,
  hostId: HOST
};

const planRows: PlanRow[] = [
  {
    name: "the single resumed process takes a released binding",
    binding: binding(RELEASED),
    sources: live([entry({ pid: 200, startedAt: RESUMED })]),
    identity: CLIENT_200,
    plan: "resume"
  },
  {
    name: "a different verified instance with the same session conflicts instead",
    binding: binding(RELEASED),
    sources: live([entry({ pid: 200, startedAt: RESUMED })]),
    identity: { ...CLIENT_200, clientPid: 300, clientStartedAt: RESUMED + 9 },
    plan: "conflict"
  },
  {
    name: "two processes with the session never resume, and the observer conflicts",
    binding: binding(RELEASED),
    sources: live([
      entry({ pid: 200, startedAt: RESUMED }),
      entry({ pid: 300, startedAt: RESUMED + 1000 })
    ]),
    identity: CLIENT_200,
    plan: "conflict"
  },
  {
    name: "an unverified observation of the resumable session is ignored",
    binding: binding(RELEASED),
    sources: live([entry({ pid: 200, startedAt: RESUMED })]),
    identity: { ...CLIENT_200, clientStartedAt: undefined },
    plan: "unverified"
  },
  {
    name: "a proven-ended slot is adopted, not resumed",
    binding: binding(RELEASED),
    sources: live([]),
    identity: { ...CLIENT_200, clientPid: 300, clientStartedAt: RESUMED + 9 },
    plan: "adopt"
  },
  {
    name: "an older observation never resumes",
    binding: binding({ observedAt: iso(-5000) }),
    sources: live([entry({ pid: 200, startedAt: RESUMED })]),
    identity: CLIENT_200,
    observedAt: iso(-6000),
    plan: "stale"
  },
  {
    name: "a recorded self-conflict does not stop the single resumed process from taking the slot",
    binding: binding({
      ...RELEASED,
      conflicts: [{ sessionId: SESSION, at: iso(-500) }]
    }),
    sources: live([entry({ pid: 200, startedAt: RESUMED })]),
    identity: CLIENT_200,
    plan: "resume"
  },
  {
    name: "a recorded self-conflict with two processes never resumes",
    binding: binding({
      ...RELEASED,
      conflicts: [{ sessionId: SESSION, at: iso(-500) }]
    }),
    sources: live([
      entry({ pid: 200, startedAt: RESUMED }),
      entry({ pid: 300, startedAt: RESUMED + 1000 })
    ]),
    identity: CLIENT_200,
    plan: "conflict"
  }
];

for (const row of planRows) {
  test(`session resume plan: ${row.name}`, () => {
    const state = deriveSlotState(row.binding, row.sources, NOW);
    const view = observationView(state, row.identity);
    const input: ObserveInput = {
      slot: {
        workspaceId: "ws-1",
        threadId: "thread-1",
        profile: "claude-software-architect"
      },
      role: "architect",
      observedAt: row.observedAt ?? iso(0),
      identity: row.identity
    };
    assert.equal(planObservation(row.binding, input, view), row.plan);
  });
}
