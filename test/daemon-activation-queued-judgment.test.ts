import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeThreadPolicy } from "../src/core/activation-policy-store.js";
import { updateWorkspaceSettingsInWorkspace } from "../src/core/memory/settings.js";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import {
  createThread,
  initWorkspace,
  registerAgent
} from "../src/core/workspace.js";
import { cyclesCountersOf } from "../src/daemon/activation-activity.js";
import type { ThreadActivity } from "../src/daemon/activation-file.js";
import { agentAdvanceIn } from "../src/daemon/activation-agent-advance.js";
import { reserveIn } from "../src/daemon/activation-reservation-store.js";
import {
  advanceStage,
  extendStage
} from "../src/daemon/activation-stage-actions.js";
import type { ThreadFile, ThreadScope } from "../src/daemon/thread-store.js";
import {
  clock,
  policyFor,
  stateHarness,
  type StateHarness
} from "./daemon-thread-state-fixtures.js";

/**
 * A judgment that waits behind the thread's queue decides with the state in force when it runs. Each
 * row holds the queue, starts the call, changes one authorization, releases the queue, and compares
 * the result with the same call made after the change. Both must equal the declared outcome.
 */

const ARCHITECT = "claude-software-architect";
const CODEX = "codex-software-architect";
const SESSION = "session-codex";

type Hook = { after(fn: () => unknown): void };

type Setup = {
  h: StateHarness;
  info: WorkspaceInfo;
  threadId: string;
  scope: ThreadScope;
  /** The architect's mention of the waiter: the message the reservation names. */
  messageId: string;
};

type Snapshot = { cyclesUsed: number; grants: number[] };

type Observed = { outcome: unknown; state: Snapshot };

type Row = {
  name: string;
  prepare?(s: Setup): Promise<void>;
  call(s: Setup): Promise<unknown>;
  change(s: Setup): Promise<void>;
  expect: Observed;
};

type Hold = { release(): void; done: Promise<unknown> };

const NONE: Snapshot = { cyclesUsed: 0, grants: [] };

/** A reservation's answer while the thread stands on planning. */
const answer = (decision: string, reason: string): unknown => ({
  decision,
  reason,
  stage: "planning"
});

const refusal = (reason: string): unknown => ({ decision: "refused", reason });

async function setup(t: Hook): Promise<Setup> {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marc-queued-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const info = await initWorkspace(root);
  const thread = await createThread(root, "Queued judgment test");
  for (const id of [ARCHITECT, CODEX]) {
    await registerAgent(root, {
      id,
      role: "architect",
      model: "claude-opus-5-5",
      description: "Architect profile for queued judgment tests."
    });
  }
  const scope: ThreadScope = { workspaceId: info.id, threadId: thread.id };
  await writeThreadPolicy(info, thread.id, policyFor("rev-1"));
  await h.ledger.authorize(scope, policyFor("rev-1"));
  const message = await appendMessageInWorkspace(info, thread.id, {
    agentId: ARCHITECT,
    body: `Please review marc://@${CODEX} now.`,
    role: "architect"
  });
  return { h, info, threadId: thread.id, scope, messageId: message.id };
}

/** Holds the thread's queue until released. The held step returns no file, so nothing is written. */
function holdQueue(s: Setup): Hold {
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = () => resolve();
  });
  const done = s.h.threads.update(s.scope, async () => {
    await gate;
    return { value: undefined };
  });
  return { release: () => open(), done };
}

async function snapshotOf(s: Setup): Promise<Snapshot> {
  const stored = (await s.h.threads.read(s.scope)) as {
    status: "ready";
    file: ThreadFile;
  };
  const activation = stored.file.activation as ThreadActivity;
  const planning = cyclesCountersOf(activation.stages.planning);
  return {
    cyclesUsed: planning.cyclesUsed,
    grants: planning.extensions.map((grant) => grant.cycles)
  };
}

/** The outcome as JSON sends it, so an absent optional field and an undefined one compare alike. */
function plain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

async function observeQueued(t: Hook, row: Row): Promise<Observed> {
  const s = await setup(t);
  await row.prepare?.(s);
  const hold = holdQueue(s);
  const pending = row.call(s);
  await row.change(s);
  hold.release();
  const outcome = await pending;
  await hold.done;
  return { outcome: plain(outcome), state: await snapshotOf(s) };
}

async function observeDirect(t: Hook, row: Row): Promise<Observed> {
  const s = await setup(t);
  await row.prepare?.(s);
  await row.change(s);
  const outcome = await row.call(s);
  return { outcome: plain(outcome), state: await snapshotOf(s) };
}

/** The planning stage has used this many cycles, as a stamped thread would have them. */
async function usedCycles(s: Setup, cyclesUsed: number): Promise<void> {
  await s.h.threads.update(s.scope, (file) => ({
    value: undefined,
    file: {
      ...file,
      activation: {
        ...(file.activation as NonNullable<ThreadFile["activation"]>),
        stages: { planning: { cyclesUsed, extensions: [] } }
      }
    }
  }));
}

/** The cycles setting saved as the UI saves it: the file, then the authorization the daemon records. */
async function authorizeCyclesAt(
  s: Setup,
  cyclesPerStage: number
): Promise<void> {
  await updateWorkspaceSettingsInWorkspace(s.info, {
    activation: { cyclesPerStage }
  });
  await s.h.ledger.authorizeCycles(s.info, cyclesPerStage);
}

/** A hand edit of the setting: the file changes and nothing authorizes it. */
async function editCyclesAt(s: Setup, cyclesPerStage: number): Promise<void> {
  await fs.writeFile(
    path.join(s.info.marcPath, "marc.config.json"),
    JSON.stringify({ activation: { cyclesPerStage } })
  );
}

/** The thread's policy saved without authorization: a new revision, or the switch off. */
async function savePolicy(
  s: Setup,
  revision: string,
  enabled = true
): Promise<void> {
  await writeThreadPolicy(s.info, s.threadId, policyFor(revision, enabled));
}

async function pause(s: Setup): Promise<void> {
  await s.h.ledger.setPaused(s.info.id, true);
}

function reserve(s: Setup): Promise<unknown> {
  return reserveIn(s.h, s.info, s.threadId, {
    messageId: s.messageId,
    recipient: CODEX,
    holder: SESSION,
    runId: "run-queued"
  });
}

function agentAdvance(s: Setup): Promise<unknown> {
  return agentAdvanceIn({
    services: s.h,
    workspace: s.info,
    threadId: s.threadId,
    agentId: ARCHITECT,
    expectedStage: "planning",
    advanceTo: "execution",
    identityVerified: true,
    operationId: "op-queued",
    now: clock
  });
}

function humanExtend(s: Setup): Promise<unknown> {
  return extendStage({
    services: s.h,
    workspace: s.info,
    threadId: s.threadId,
    now: clock,
    expectedStage: "planning"
  });
}

function humanAdvance(s: Setup): Promise<unknown> {
  return advanceStage({
    services: s.h,
    workspace: s.info,
    threadId: s.threadId,
    now: clock,
    expectedStage: "planning",
    to: "execution"
  });
}

const ROWS: readonly Row[] = [
  {
    name: "a workspace pause raised while the reservation waits holds it with no debit",
    call: reserve,
    change: pause,
    expect: { outcome: answer("held", "workspace_paused"), state: NONE }
  },
  {
    name: "a policy switched off while the reservation waits is refused",
    call: reserve,
    change: (s) => savePolicy(s, "rev-1", false),
    expect: { outcome: answer("refused", "policy_disabled"), state: NONE }
  },
  {
    name: "a policy saved without authorization while the reservation waits is held as a revision mismatch",
    call: reserve,
    change: (s) => savePolicy(s, "rev-2"),
    expect: { outcome: answer("held", "revision_mismatch"), state: NONE }
  },
  {
    name: "a limit lowered from 5 to 3 while the agent waits exhausts a stage that used 4",
    prepare: (s) => usedCycles(s, 4),
    call: agentAdvance,
    change: (s) => authorizeCyclesAt(s, 3),
    expect: {
      outcome: refusal("stage_exhausted"),
      state: { cyclesUsed: 4, grants: [] }
    }
  },
  {
    name: "a cycles setting tampered while the agent waits refuses with the state the judge found",
    call: agentAdvance,
    change: (s) => editCyclesAt(s, 4),
    expect: { outcome: refusal("settings_tampered"), state: NONE }
  },
  {
    name: "More N cycles while the authorized setting changes grants the value in force at the write",
    call: humanExtend,
    change: (s) => authorizeCyclesAt(s, 3),
    expect: {
      outcome: { decision: "done", stage: "planning" },
      state: { cyclesUsed: 0, grants: [3] }
    }
  },
  {
    name: "a human advance with the policy switched off while it waits is refused as policy_disabled",
    call: humanAdvance,
    change: (s) => savePolicy(s, "rev-1", false),
    expect: { outcome: refusal("policy_disabled"), state: NONE }
  }
];

for (const row of ROWS) {
  test(`queued judgment: ${row.name}`, async (t) => {
    const queued = await observeQueued(t, row);
    const direct = await observeDirect(t, row);
    assert.deepEqual(queued, row.expect);
    assert.deepEqual(direct, row.expect);
  });
}
