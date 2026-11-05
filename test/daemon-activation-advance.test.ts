import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import { writeThreadPolicy } from "../src/core/activation-policy-store.js";
import {
  createThread,
  initWorkspace,
  registerAgent
} from "../src/core/workspace.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import {
  agentAdvanceIn,
  type AgentAdvanceOutcome,
  type AgentAdvanceInput
} from "../src/daemon/activation-agent-advance.js";
import {
  advanceStage,
  type StageActionOutcome
} from "../src/daemon/activation-stage-actions.js";
import type { ThreadFile, ThreadScope } from "../src/daemon/thread-store.js";
import {
  clock,
  policyFor,
  stateHarness,
  type StateHarness
} from "./daemon-thread-state-fixtures.js";

const ARCHITECT = "claude-software-architect";
const CODEX = "codex-software-architect";

type Setup = Awaited<ReturnType<typeof setup>>;

async function setup(h: StateHarness) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marc-advance-"));
  const info: WorkspaceInfo = await initWorkspace(root);
  const thread = await createThread(root, "Advance test");
  for (const id of [ARCHITECT, CODEX]) {
    await registerAgent(root, {
      id,
      role: "architect",
      model: "claude-opus-5-5",
      description: "Architect profile for advance tests."
    });
  }
  const scope: ThreadScope = { workspaceId: info.id, threadId: thread.id };
  await writeThreadPolicy(info, thread.id, policyFor("rev-1"));
  await h.ledger.authorize(scope, policyFor("rev-1"));
  await appendMessageInWorkspace(info, thread.id, {
    agentId: ARCHITECT,
    body: "The plan is ready for review by the architects of this thread.",
    role: "architect"
  });
  return { root, info, scope, threadId: thread.id };
}

type AdvanceOverrides = Partial<
  Pick<
    AgentAdvanceInput,
    "agentId" | "expectedStage" | "advanceTo" | "identityVerified"
  >
>;

/** The agent's advance inside the queue; the cycles setting is read there, not passed in. */
async function advance(
  h: StateHarness,
  s: Setup,
  overrides: AdvanceOverrides = {}
): Promise<AgentAdvanceOutcome> {
  return agentAdvanceIn({
    services: h,
    workspace: s.info,
    threadId: s.threadId,
    agentId: ARCHITECT,
    expectedStage: "planning",
    advanceTo: "execution",
    identityVerified: true,
    operationId: "op-1",
    now: clock,
    ...overrides
  });
}

function keyOf(outcome: AgentAdvanceOutcome | StageActionOutcome): string {
  return outcome.decision === "done" ? "done" : `refused:${outcome.reason}`;
}

test("the lead advances with a verified identity, and the history records the agent move with its operation", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const s = await setup(h);
  t.after(() => fs.rm(s.root, { recursive: true, force: true }));

  const outcome = await advance(h, s);
  assert.deepEqual(outcome, {
    decision: "done",
    stage: "execution",
    operationId: "op-1",
    droppedHolds: 0
  });

  const stored = (await h.threads.read(s.scope)) as {
    status: "ready";
    file: ThreadFile;
  };
  assert.deepEqual(stored.file.stageHistory, [
    {
      at: clock(),
      from: "planning",
      to: "execution",
      by: "agent",
      agentId: ARCHITECT,
      operationId: "op-1",
      droppedHolds: 0
    }
  ]);
});

const REFUSAL_ROWS: ReadonlyArray<{
  name: string;
  overrides: AdvanceOverrides;
  expect: string;
}> = [
  {
    name: "an unverified identity is refused",
    overrides: { identityVerified: false },
    expect: "refused:identity_unverified"
  },
  {
    name: "a non-lead is refused before the identity",
    overrides: { agentId: CODEX, identityVerified: false },
    expect: "refused:not_lead"
  },
  {
    name: "a stage the agent did not see is refused",
    overrides: { expectedStage: "execution" },
    expect: "refused:stage_changed"
  },
  {
    name: "a destination that is not ahead is refused",
    overrides: { advanceTo: "planning" },
    expect: "refused:not_ahead"
  }
];

for (const row of REFUSAL_ROWS) {
  test(`agent advance refused: ${row.name}`, async (t) => {
    const h = await stateHarness();
    t.after(() => h.cleanup());
    const s = await setup(h);
    t.after(() => fs.rm(s.root, { recursive: true, force: true }));
    assert.equal(keyOf(await advance(h, s, row.overrides)), row.expect);
    const stored = (await h.threads.read(s.scope)) as {
      status: "ready";
      file: ThreadFile;
    };
    assert.equal(stored.file.stageHistory, undefined);
  });
}

test("an exhausted stage refuses the agent, and the human advance is not refused by the same budget", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const s = await setup(h);
  t.after(() => fs.rm(s.root, { recursive: true, force: true }));
  await h.threads.update(s.scope, (file) => ({
    value: undefined,
    file: {
      ...file,
      activation: {
        ...(file.activation as NonNullable<ThreadFile["activation"]>),
        stages: { planning: { cyclesUsed: 5, extensions: [] } }
      }
    }
  }));
  assert.equal(keyOf(await advance(h, s)), "refused:stage_exhausted");
  const human = await advanceStage({
    services: h,
    workspace: s.info,
    threadId: s.threadId,
    now: clock,
    expectedStage: "planning",
    to: "execution"
  });
  assert.deepEqual(human, {
    decision: "done",
    stage: "execution",
    droppedHolds: 0
  });
});

test("the last stage cannot be advanced by an agent", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const s = await setup(h);
  t.after(() => fs.rm(s.root, { recursive: true, force: true }));
  const move = {
    services: h,
    workspace: s.info,
    threadId: s.threadId,
    now: clock
  };
  await advanceStage({ ...move, expectedStage: "planning", to: "execution" });
  await advanceStage({ ...move, expectedStage: "execution", to: "review" });
  assert.equal(
    keyOf(
      await advance(h, s, { expectedStage: "review", advanceTo: "review" })
    ),
    "refused:last_stage"
  );
});

test("two concurrent advances with the same expected stage: one moves, the other sees stage_changed", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const s = await setup(h);
  t.after(() => fs.rm(s.root, { recursive: true, force: true }));
  const results = await Promise.all([
    advance(h, s),
    advanceStage({
      services: h,
      workspace: s.info,
      threadId: s.threadId,
      now: clock,
      expectedStage: "planning",
      to: "execution"
    })
  ]);
  assert.deepEqual(results.map(keyOf).sort(), [
    "done",
    "refused:stage_changed"
  ]);
});
