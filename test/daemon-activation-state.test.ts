import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { isThreadPaused } from "../src/core/activation-budget.js";
import type { CyclesState } from "../src/core/activation-cycles.js";
import {
  writeThreadPolicy,
  type PolicyView
} from "../src/core/activation-policy-store.js";
import { writeFileAtomically } from "../src/core/write-coordination.js";
import { updateWorkspaceSettingsInWorkspace } from "../src/core/memory/settings.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import { createActivationLedger } from "../src/daemon/activation-ledger.js";
import {
  advanceStage,
  extendStage
} from "../src/daemon/activation-stage-actions.js";
import { createThreadStore } from "../src/daemon/thread-store.js";
import { createWorkspaceStore } from "../src/daemon/workspace-store.js";
import {
  AUTHORIZED_CYCLES,
  CLOCK_ISO,
  clock,
  policyFor,
  stateHarness,
  type StateHarness
} from "./daemon-thread-state-fixtures.js";

const SCOPE = { workspaceId: "ws-1", threadId: "thread-a" };

async function workspaceIn(dataDir: string): Promise<WorkspaceInfo> {
  const rootPath = path.join(dataDir, "ws");
  const marcPath = path.join(rootPath, ".marc");
  await fs.mkdir(marcPath, { recursive: true });
  return { id: "ws-1", name: "ws", rootPath, marcPath };
}

/** A fresh daemon over the same data folder: nothing is kept in memory between the two. */
function restarted(dataDir: string) {
  const deps = { now: clock, writeAtomic: writeFileAtomically };
  return createActivationLedger(
    {
      threads: createThreadStore(dataDir, deps),
      workspaces: createWorkspaceStore(dataDir, deps)
    },
    clock
  );
}

async function withHarness(
  run: (h: StateHarness) => Promise<void>
): Promise<void> {
  const h = await stateHarness();
  try {
    await run(h);
  } finally {
    await h.cleanup();
  }
}

type PinRow = {
  name: string;
  policy: PolicyView;
  cycles: CyclesState;
  status: string;
};

const PIN_ROWS: PinRow[] = [
  {
    name: "a pinned policy with an authorized setting is ready",
    policy: { status: "ready", policy: policyFor("rev-1") },
    cycles: AUTHORIZED_CYCLES,
    status: "ready"
  },
  {
    name: "a different revision is not authorized",
    policy: { status: "ready", policy: policyFor("rev-2") },
    cycles: AUTHORIZED_CYCLES,
    status: "revision_mismatch"
  },
  {
    name: "a hand edit under the same revision is policy_tampered",
    policy: {
      status: "ready",
      policy: { ...policyFor("rev-1"), attemptCap: 3 }
    },
    cycles: AUTHORIZED_CYCLES,
    status: "policy_tampered"
  },
  {
    name: "a tampered cycles setting pauses the enabled thread",
    policy: { status: "ready", policy: policyFor("rev-1") },
    cycles: { status: "tampered", cyclesPerStage: 5 },
    status: "settings_tampered"
  },
  {
    name: "an outdated enabled policy needs a save",
    policy: { status: "outdated", enabled: true },
    cycles: AUTHORIZED_CYCLES,
    status: "policy_outdated"
  },
  {
    name: "a lost workspace file reports ledger_lost",
    policy: { status: "ready", policy: policyFor("rev-1") },
    cycles: { status: "ledger_lost" },
    status: "ledger_lost"
  }
];

for (const row of PIN_ROWS) {
  test(`pin: ${row.name}`, async () => {
    await withHarness(async (h) => {
      await h.ledger.authorize(SCOPE, policyFor("rev-1"));
      const state = await h.ledger.threadState(SCOPE, row.policy, row.cycles);
      assert.equal(state.status, row.status);
    });
  });
}

test("a disabled policy never pauses, even with a tampered setting", async () => {
  await withHarness(async (h) => {
    const state = await h.ledger.threadState(
      SCOPE,
      { status: "ready", policy: policyFor("rev-1", false) },
      { status: "tampered", cyclesPerStage: 5 }
    );
    assert.equal(isThreadPaused(state, false), false);
  });
});

test("the authorized setting survives a restart and a memory-only save", async () => {
  await withHarness(async (h) => {
    const info = await workspaceIn(h.dataDir);
    await updateWorkspaceSettingsInWorkspace(info, {
      activation: { cyclesPerStage: 3 }
    });
    await ledgerAuthorizeCycles(h, info, 3);
    await updateWorkspaceSettingsInWorkspace(info, {
      memory: { autoRebuild: false }
    });
    const after = await restarted(h.dataDir).cyclesState(info);
    assert.deepEqual(after, { status: "authorized", cyclesPerStage: 3 });
  });
});

test("a manual edit of the setting is tampered, even to a valid value", async () => {
  await withHarness(async (h) => {
    const info = await workspaceIn(h.dataDir);
    await ledgerAuthorizeCycles(h, info, 3);
    await fs.writeFile(
      path.join(info.marcPath, "marc.config.json"),
      JSON.stringify({ activation: { cyclesPerStage: 4 } })
    );
    assert.deepEqual(await h.ledger.cyclesState(info), {
      status: "tampered",
      cyclesPerStage: 3
    });
  });
});

test("a UI save re-authorizes and keeps the consumption and the grants", async () => {
  await withHarness(async (h) => {
    const input = await stagedInput(h);
    await ledgerAuthorizeCycles(h, input.workspace, 5);
    await extendStage({ ...input, expectedStage: "planning" });
    await updateWorkspaceSettingsInWorkspace(input.workspace, {
      activation: { cyclesPerStage: 3 }
    });
    await ledgerAuthorizeCycles(h, input.workspace, 3);
    assert.equal(await grantCountIn(h, "planning"), 1);
    assert.deepEqual(await h.ledger.cyclesState(input.workspace), {
      status: "authorized",
      cyclesPerStage: 3
    });
  });
});

test("an F3a stage needs the explicit mapping to planning, and its counters stay as history", async () => {
  await withHarness(async (h) => {
    await h.threads.update(SCOPE, () => ({
      value: undefined,
      file: {
        version: 1,
        generation: 0,
        slots: {},
        createdAt: CLOCK_ISO,
        activation: {
          authorizedRevision: "rev-0",
          authorizedHash: "hash-0",
          currentStage: "proposta",
          stages: { proposta: { passesUsed: 2, attempts: 1 } }
        }
      }
    }));
    const refused = await h.ledger.authorize(SCOPE, policyFor("rev-1"));
    assert.deepEqual(refused, {
      decision: "mapping_required",
      from: "proposta",
      to: "planning"
    });
    const mapped = await h.ledger.authorize(SCOPE, policyFor("rev-1"), {
      from: "proposta",
      to: "planning"
    });
    assert.deepEqual(mapped, { decision: "authorized" });
    const file = await h.threads.read(SCOPE);
    assert.equal(file.status, "ready");
    if (file.status !== "ready") return;
    assert.equal(file.file.activation?.currentStage, "planning");
    assert.deepEqual(file.file.activation?.legacyStages, {
      proposta: { passesUsed: 2, attempts: 1 }
    });
  });
});

test("extend adds the authorized cycles as a grant, and advance moves one fixed stage forward", async () => {
  await withHarness(async (h) => {
    const input = await stagedInput(h);
    const extended = await extendStage({ ...input, expectedStage: "planning" });
    assert.deepEqual(extended, { decision: "done", stage: "planning" });
    const first = await advanceStage({
      ...input,
      expectedStage: "planning",
      to: "execution"
    });
    assert.deepEqual(first, {
      decision: "done",
      stage: "execution",
      droppedHolds: 0
    });
    const second = await advanceStage({
      ...input,
      expectedStage: "execution",
      to: "review"
    });
    assert.deepEqual(second, {
      decision: "done",
      stage: "review",
      droppedHolds: 0
    });
  });
});

test("advance at review is refused, and a stale stage is refused without a move", async () => {
  await withHarness(async (h) => {
    const input = await stagedInput(h);
    const stale = await advanceStage({
      ...input,
      expectedStage: "execution",
      to: "review"
    });
    assert.deepEqual(stale, { decision: "refused", reason: "stage_changed" });
    await advanceStage({
      ...input,
      expectedStage: "planning",
      to: "execution"
    });
    await advanceStage({
      ...input,
      expectedStage: "execution",
      to: "review"
    });
    const last = await advanceStage({
      ...input,
      expectedStage: "review",
      to: "review"
    });
    assert.deepEqual(last, { decision: "refused", reason: "last_stage" });
  });
});

/** Pins the thread's policy as the UI saves it, and returns the stage-action input for that thread. */
async function stagedInput(h: StateHarness) {
  const info = await workspaceIn(h.dataDir);
  await writeThreadPolicy(info, SCOPE.threadId, policyFor("rev-1"));
  await h.ledger.authorize(SCOPE, policyFor("rev-1"));
  return { services: h, workspace: info, threadId: SCOPE.threadId, now: clock };
}

/** The number of human grants recorded for one fixed stage of the thread. */
async function grantCountIn(h: StateHarness, stage: string): Promise<number> {
  const view = await h.threads.read(SCOPE);
  if (view.status !== "ready") return -1;
  const entry = view.file.activation?.stages[stage];
  if (entry === undefined || !("extensions" in entry)) return -1;
  return entry.extensions.length;
}

/** Records a settings authorization the way the daemon does after the file is written. */
async function ledgerAuthorizeCycles(
  h: StateHarness,
  info: WorkspaceInfo,
  cycles: number
): Promise<void> {
  const outcome = await h.ledger.authorizeCycles(info, cycles);
  assert.deepEqual(outcome, { decision: "authorized" });
}
