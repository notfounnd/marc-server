import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { ReservationRecord } from "../src/core/activation-reservation-types.js";
import {
  expireDue,
  transitionRecord,
  upsertRecord
} from "../src/core/activation-supervision-records.js";
import type {
  SupervisionRecord,
  SupervisionState
} from "../src/core/activation-supervision-types.js";
import { writeFileAtomically } from "../src/core/write-coordination.js";
import { createPermissionStore } from "../src/daemon/supervision-permission-store.js";
import {
  createThreadStore,
  type ThreadFile,
  type ThreadScope
} from "../src/daemon/thread-store.js";

/**
 * A background change must reach the panel without a route: each row performs one transition on the real thread
 * store, through the real transition helpers, and checks that the store announces the thread it changed.
 */

const T0 = "2026-11-10T12:00:00.000Z";
const LATE = "2026-11-12T12:00:00.000Z";
const MIN = 60_000;
const SCOPE: ThreadScope = { workspaceId: "ws-1", threadId: "t-1" };

const CARD: SupervisionRecord = {
  messageId: "msg-1",
  messageAt: T0,
  recipient: "claude-software-architect",
  stage: "planning",
  status: "awaiting_confirmation",
  createdAt: T0,
  expiresAt: "2026-11-10T12:01:00.000Z",
  attempt: 0
};

const STARTING: SupervisionRecord = {
  ...CARD,
  status: "starting",
  attempt: 1,
  runId: "run-1"
};

const RUNNING: SupervisionRecord = { ...STARTING, status: "running" };

const RESERVATION: ReservationRecord = {
  messageId: "msg-1",
  recipient: "claude-software-architect",
  author: "human",
  origin: "ui",
  holder: "waiter-1",
  runId: "run-1",
  runIds: ["run-1"],
  stage: "planning",
  status: "held",
  reason: "budget_exhausted",
  granted: false,
  attempts: 0,
  cycleRole: "none",
  messageAt: T0
};

function stateOf(file: ThreadFile): SupervisionState {
  return file.supervision ?? { records: [], floors: {} };
}

function withState(
  file: ThreadFile,
  change: (state: SupervisionState) => SupervisionState
): ThreadFile {
  return { ...file, supervision: change(stateOf(file)) };
}

type ThreadRow = {
  name: string;
  seeds: SupervisionRecord[];
  act: (file: ThreadFile) => ThreadFile;
  /** A periodic presence mark: the step is quiet, so nothing is announced. */
  quiet?: boolean;
  expected: string[];
};

const THREAD_ROWS: ThreadRow[] = [
  {
    name: "a card created by the pass",
    seeds: [],
    act: (file) =>
      withState(file, (state) => ({
        ...state,
        records: upsertRecord(state.records, CARD)
      })),
    expected: ["t-1"]
  },
  {
    name: "a card expired by the sweep",
    seeds: [CARD],
    act: (file) =>
      withState(file, (state) => ({
        ...state,
        records: state.records.map((record) => expireDue(record, LATE))
      })),
    expected: ["t-1"]
  },
  {
    name: "a card that starts running",
    seeds: [STARTING],
    act: (file) =>
      withState(file, (state) => ({
        ...state,
        records: state.records.map(
          (record) => transitionRecord(record, "running") ?? record
        )
      })),
    expected: ["t-1"]
  },
  {
    name: "a card that ends done",
    seeds: [RUNNING],
    act: (file) =>
      withState(file, (state) => ({
        ...state,
        records: state.records.map(
          (record) =>
            transitionRecord(record, "done", {
              outcome: { denials: 0, costUsd: 0.001 }
            }) ?? record
        )
      })),
    expected: ["t-1"]
  },
  {
    name: "a card that fails",
    seeds: [RUNNING],
    act: (file) =>
      withState(file, (state) => ({
        ...state,
        records: state.records.map(
          (record) =>
            transitionRecord(record, "failed", {
              reason: "crashed",
              outcome: { denials: 0, failure: "crashed" }
            }) ?? record
        )
      })),
    expected: ["t-1"]
  },
  {
    name: "a reservation held for the waiter",
    seeds: [],
    act: (file) => ({ ...file, reservations: [RESERVATION] }),
    expected: ["t-1"]
  },
  {
    name: "a heartbeat renews the owner's last beat and announces nothing",
    seeds: [],
    act: (file) => ({ ...file, createdAt: LATE }),
    quiet: true,
    expected: []
  },
  {
    name: "an observation that only refreshes its instant announces nothing",
    seeds: [],
    act: (file) => ({ ...file, createdAt: LATE }),
    quiet: true,
    expected: []
  },
  {
    name: "an acquired slot announces its thread",
    seeds: [],
    act: (file) => ({ ...file, generation: file.generation + 1 }),
    expected: ["t-1"]
  },
  {
    name: "a released slot announces its thread",
    seeds: [],
    act: (file) => ({ ...file, createdAt: LATE }),
    expected: ["t-1"]
  },
  {
    name: "an observation that adopts a session announces its thread",
    seeds: [],
    act: (file) => ({ ...file, generation: file.generation + 1 }),
    expected: ["t-1"]
  },
  {
    name: "a write that leaves the file as it was announces nothing",
    seeds: [CARD],
    act: (file) => file,
    expected: []
  }
];

for (const row of THREAD_ROWS) {
  test(`background change in a thread: ${row.name}`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "marc-changed-"));
    try {
      const announced: string[] = [];
      const threads = createThreadStore(dir, {
        writeAtomic: writeFileAtomically,
        now: () => T0,
        changed: (scope) => announced.push(scope.threadId)
      });
      await threads.update(SCOPE, (file) => ({
        value: undefined,
        file: withState(file, (state) => ({ ...state, records: row.seeds }))
      }));
      announced.length = 0;
      const result = await threads.update(SCOPE, (file) => ({
        value: undefined,
        file: row.act(file),
        quiet: row.quiet ?? false
      }));
      assert.equal(result.status, "done");
      assert.deepEqual(announced, row.expected);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

function permissionEnv() {
  const calls: string[] = [];
  const scheduled: Array<() => void> = [];
  const clock = { now: Date.parse(T0) };
  const store = createPermissionStore({
    now: () => clock.now,
    newId: () => "req-1",
    timeoutMs: 10 * MIN,
    changed: (_workspaceId, threadId) => calls.push(threadId),
    schedule: (fire) => scheduled.push(fire)
  });
  return { store, calls, scheduled, clock };
}

type PermissionEnv = ReturnType<typeof permissionEnv>;

const REQUEST = {
  runId: "run-1",
  workspaceId: "ws-1",
  threadId: "t-1",
  toolName: "Bash",
  input: { command: "pnpm test --filter supervision" }
};

const PERMISSION_ROWS: Array<{
  name: string;
  run: (env: PermissionEnv) => void;
  expected: string[];
}> = [
  {
    name: "a permission request is created",
    run: (env) => {
      env.store.open(REQUEST);
    },
    expected: ["t-1"]
  },
  {
    name: "a permission request decided in the panel",
    run: (env) => {
      env.store.open(REQUEST);
      env.calls.length = 0;
      env.store.decide({
        workspaceId: "ws-1",
        threadId: "t-1",
        requestId: "req-1",
        decision: "allow"
      });
    },
    expected: ["t-1"]
  },
  {
    name: "a permission request denied at its deadline",
    run: (env) => {
      env.store.open(REQUEST);
      env.calls.length = 0;
      env.clock.now += 10 * MIN + 1;
      env.scheduled[0]?.();
    },
    expected: ["t-1"]
  },
  {
    name: "a permission request denied at the end of its turn",
    run: (env) => {
      env.store.open(REQUEST);
      env.calls.length = 0;
      env.store.denyOpen("run-1", "turn ended");
    },
    expected: ["t-1"]
  }
];

for (const row of PERMISSION_ROWS) {
  test(`background change of a permission request: ${row.name}`, () => {
    const env = permissionEnv();
    row.run(env);
    assert.deepEqual(env.calls, row.expected);
  });
}
