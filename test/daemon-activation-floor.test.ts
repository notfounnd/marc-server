import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { stampedFloorOf } from "../src/core/activation-floor.js";
import { writeThreadPolicy } from "../src/core/activation-policy-store.js";
import { renderChatHeader, renderMessage } from "../src/core/markdown.js";
import { messagesOfThreadInWorkspace } from "../src/core/threads.js";
import type { ChatMessage, WorkspaceInfo } from "../src/core/types.js";
import type { ThreadActivity } from "../src/daemon/activation-file.js";
import type { RecoverReport } from "../src/daemon/activation-ledger.js";
import { advanceStage } from "../src/daemon/activation-stage-actions.js";
import type { ThreadFile, ThreadScope } from "../src/daemon/thread-store.js";
import type { ReservationRecord } from "../src/core/activation-reservation-types.js";
import {
  AUTHORIZED_CYCLES,
  CLOCK_ISO,
  clock,
  policyFor,
  stateHarness,
  threadPath,
  type StateHarness
} from "./daemon-thread-state-fixtures.js";

const SCOPE: ThreadScope = { workspaceId: "ws-1", threadId: "thread-1" };
const ARCHITECT = "claude-software-architect";

/** The planning counters of a judged state. Only the ready and restored states carry stages. */
function planningOf(state: unknown): unknown {
  return (state as { stages: Record<string, unknown> }).stages.planning;
}

/** A workspace whose CHAT.md holds the given messages, so the floor is read from Markdown. */
async function workspaceWithChat(
  h: StateHarness,
  messages: ChatMessage[]
): Promise<WorkspaceInfo> {
  const marcPath = path.join(h.dataDir, "marc");
  await fs.mkdir(path.join(marcPath, "threads", SCOPE.threadId), {
    recursive: true
  });
  const chat =
    renderChatHeader("Thread", SCOPE.threadId, CLOCK_ISO) +
    messages.map(renderMessage).join("");
  await fs.writeFile(
    path.join(marcPath, "threads", SCOPE.threadId, "CHAT.md"),
    chat
  );
  return { id: SCOPE.workspaceId, name: "ws", rootPath: h.dataDir, marcPath };
}

function stamped(cycle: number): ChatMessage {
  return {
    id: `msg_${cycle}`,
    threadId: SCOPE.threadId,
    timestamp: CLOCK_ISO,
    agentId: ARCHITECT,
    role: "architect",
    body: "Stamped message.",
    artifacts: [],
    stage: "planning",
    cycle
  };
}

async function floorOf(workspace: WorkspaceInfo) {
  return stampedFloorOf(
    await messagesOfThreadInWorkspace(workspace, SCOPE.threadId)
  );
}

/** Writes stored counters directly, the way an older copy of the state file would hold them. */
async function storeCycles(h: StateHarness, cyclesUsed: number): Promise<void> {
  await h.threads.update(SCOPE, (file) => ({
    value: undefined,
    file: {
      ...file,
      activation: {
        ...(file.activation as ThreadActivity),
        stages: {
          ...(file.activation as ThreadActivity).stages,
          planning: { cyclesUsed, extensions: [] }
        }
      }
    }
  }));
}

test("a lost state is rebuilt from the stamped cycles, stays paused until a save, and keeps them after it", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const workspace = await workspaceWithChat(h, [stamped(3)]);
  await h.ledger.authorize(SCOPE, policyFor("rev-1"));
  await fs.rm(threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId));

  const report = (await h.ledger.recover(workspace)) as RecoverReport;
  assert.deepEqual(
    report.threads.map((item) => [item.threadId, item.reason]),
    [["thread-1", "registry_lost"]]
  );
  const floor = await floorOf(workspace);
  const paused = await h.ledger.threadState(
    SCOPE,
    { status: "ready", policy: policyFor("rev-1") },
    AUTHORIZED_CYCLES,
    floor
  );
  assert.equal(paused.status, "revision_mismatch");

  await h.ledger.authorize(SCOPE, policyFor("rev-2"));
  const ready = await h.ledger.threadState(
    SCOPE,
    { status: "ready", policy: policyFor("rev-2") },
    AUTHORIZED_CYCLES,
    floor
  );
  assert.deepEqual(
    [ready.status, planningOf(ready)],
    ["ready", { cyclesUsed: 3, extensions: [] }]
  );
});

test("an older copy pauses with ledger_restored, and recovery raises the counter to the stamped cycles", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const workspace = await workspaceWithChat(h, [stamped(3)]);
  await h.ledger.authorize(SCOPE, policyFor("rev-1"));
  await storeCycles(h, 1);
  const floor = await floorOf(workspace);
  const view = { status: "ready" as const, policy: policyFor("rev-1") };

  const behind = await h.ledger.threadState(
    SCOPE,
    view,
    AUTHORIZED_CYCLES,
    floor
  );
  assert.equal(behind.status, "ledger_restored");

  await h.ledger.recover(workspace);
  const restored = await h.ledger.threadState(
    SCOPE,
    view,
    AUTHORIZED_CYCLES,
    floor
  );
  assert.deepEqual(
    [restored.status, planningOf(restored)],
    ["ready", { cyclesUsed: 3, extensions: [] }]
  );
});

test("recovery never lowers a stored counter that is already above the stamped floor", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const workspace = await workspaceWithChat(h, [stamped(3)]);
  await h.ledger.authorize(SCOPE, policyFor("rev-1"));
  await storeCycles(h, 4);

  const report = await h.ledger.recover(workspace);
  assert.deepEqual(report, {
    decision: "refused",
    reason: "nothing_to_recover"
  });
  const floor = await floorOf(workspace);
  const state = await h.ledger.threadState(
    SCOPE,
    { status: "ready", policy: policyFor("rev-1") },
    AUTHORIZED_CYCLES,
    floor
  );
  assert.deepEqual(
    [state.status, planningOf(state)],
    ["ready", { cyclesUsed: 4, extensions: [] }]
  );
});

test("a human advance ends every retained hold with stage_advanced and records the move", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const workspace = await workspaceWithChat(h, []);
  await writeThreadPolicy(workspace, SCOPE.threadId, policyFor("rev-1"));
  await h.ledger.authorize(SCOPE, policyFor("rev-1"));
  const held: ReservationRecord = {
    messageId: "msg_1",
    recipient: "codex-software-architect",
    author: ARCHITECT,
    origin: "architect",
    holder: "session-codex",
    runId: "run-1",
    runIds: [],
    stage: "planning",
    status: "held",
    reason: "budget_exhausted",
    granted: false,
    attempts: 0,
    cycleRole: "none",
    messageAt: CLOCK_ISO
  };
  await h.threads.update(SCOPE, (file) => ({
    value: undefined,
    file: { ...file, reservations: [held] }
  }));

  const outcome = await advanceStage({
    services: h,
    workspace,
    threadId: SCOPE.threadId,
    now: clock,
    expectedStage: "planning",
    to: "execution"
  });
  assert.deepEqual(outcome, {
    decision: "done",
    stage: "execution",
    droppedHolds: 1
  });

  const stored = (await h.threads.read(SCOPE)) as {
    status: "ready";
    file: ThreadFile;
  };
  assert.deepEqual(
    [
      stored.file.reservations?.[0]?.status,
      stored.file.reservations?.[0]?.reason
    ],
    ["refused", "stage_advanced"]
  );
  assert.deepEqual(stored.file.stageHistory, [
    {
      at: CLOCK_ISO,
      from: "planning",
      to: "execution",
      by: "human",
      droppedHolds: 1
    }
  ]);
});
