import { randomUUID } from "node:crypto";
import type { ActivationThreadState } from "../core/activation-budget.js";
import {
  cyclesContentHash,
  cyclesStateOf,
  type CyclesState
} from "../core/activation-cycles.js";
import type { StageFloor } from "../core/activation-floor.js";
import { closePause, openPause } from "../core/activation-pauses.js";
import type { ActivationPolicy } from "../core/activation-policy.js";
import type { PolicyView } from "../core/activation-policy-store.js";
import { readRawActivityInWorkspace } from "../core/memory/settings.js";
import type { WorkspaceInfo } from "../core/types.js";
import {
  activityAfterSave,
  judgeActivation,
  pinOf,
  stageForSave,
  type StageMappingChoice
} from "./activation-activity.js";
import type { WorkspaceFile } from "./activation-file.js";
import { recoverIn } from "./activation-recovery.js";
import {
  turnTimeoutStateIn,
  writeTurnTimeoutAuthorization,
  type TurnTimeoutRead
} from "./activation-turn-timeout-ledger.js";
import type { ThreadScope, ThreadStore } from "./thread-store.js";
import type { WorkspaceStore } from "./workspace-store.js";

/**
 * Activation state on top of the per-thread and per-workspace files. Counters live in
 * the thread file; the pause, its history and the cycles authorization live in the
 * workspace file. Both go through the files' own queues. A lost or invalid file refuses
 * every write, a closed thread refuses every write, and nothing is recreated silently.
 */
export type LedgerReason =
  | "ledger_lost"
  | "ledger_invalid"
  | "thread_closed"
  | "nothing_to_recover"
  | "move_aside_conflict";

export type LedgerRefusal = { decision: "refused"; reason: LedgerReason };

export type WorkspaceState =
  | { status: "ready"; paused: boolean; pausedAt?: string }
  | { status: "invalid"; reason: LedgerReason };

export type RecoverReport = {
  decision: "recovered";
  threads: Array<{ threadId: string; reason: string; movedAside?: string }>;
  workspace?: { reason: string; movedAside?: string };
  conflicts: string[];
};

/** A saved policy is pinned, or the human must confirm the mapping of an F3a stage first. */
export type AuthorizeOutcome =
  | { decision: "authorized" }
  | { decision: "mapping_required"; from: string; to: "planning" }
  | LedgerRefusal;

export type ActivationLedger = {
  workspaceState(workspaceId: string): Promise<WorkspaceState>;
  setPaused(
    workspaceId: string,
    paused: boolean
  ): Promise<
    { decision: "updated"; paused: boolean; pausedAt?: string } | LedgerRefusal
  >;
  /** The cycles setting in force: the authorized value, and whether the file still matches it. */
  cyclesState(workspace: WorkspaceInfo): Promise<CyclesState>;
  /** Records the human's UI save of the cycles setting. Called after the file is written. */
  authorizeCycles(
    workspace: WorkspaceInfo,
    cyclesPerStage: number
  ): Promise<{ decision: "authorized" } | LedgerRefusal>;
  /** The time limit of a supervised turn in force: the authorized value, or tampered. */
  turnTimeoutState(workspace: WorkspaceInfo): Promise<TurnTimeoutRead>;
  /** Records the human's UI save of the time limit. Called after the file is written. */
  authorizeTurnTimeout(
    workspace: WorkspaceInfo,
    turnTimeoutMinutes: number
  ): Promise<{ decision: "authorized" } | LedgerRefusal>;
  /** Pins the revision, the content hash and the fixed stage of a saved policy, in the thread's queue. */
  authorize(
    scope: ThreadScope,
    policy: ActivationPolicy,
    confirmed?: StageMappingChoice
  ): Promise<AuthorizeOutcome>;
  /**
   * Compares the stored pin with the policy on disk and the cycles authorization. Any difference is
   * not ready. The floor is derived from the stamped messages by the caller; it defaults to none.
   */
  threadState(
    scope: ThreadScope,
    policy: PolicyView,
    cycles: CyclesState,
    floor?: StageFloor
  ): Promise<ActivationThreadState>;
  recover(workspace: WorkspaceInfo): Promise<RecoverReport | LedgerRefusal>;
};

export type LedgerStores = { threads: ThreadStore; workspaces: WorkspaceStore };

export function createActivationLedger(
  stores: LedgerStores,
  now: () => string
): ActivationLedger {
  return {
    workspaceState: (workspaceId) => workspaceStateIn(stores, workspaceId),
    setPaused: (workspaceId, paused) =>
      setPausedIn(stores, now, workspaceId, paused),
    cyclesState: (workspace) => cyclesStateIn(stores, workspace),
    authorizeCycles: (workspace, cyclesPerStage) =>
      authorizeCyclesIn(stores, now, workspace, cyclesPerStage),
    turnTimeoutState: (workspace) =>
      turnTimeoutStateIn(stores.workspaces, workspace),
    authorizeTurnTimeout: (workspace, minutes) =>
      authorizeTurnTimeoutIn(stores, now, workspace, minutes),
    authorize: (scope, policy, confirmed) =>
      authorizeIn(stores.threads, scope, policy, confirmed),
    threadState: (scope, policy, cycles, floor) =>
      threadStateIn(stores.threads, scope, policy, cycles, floor),
    recover: (workspace) => recoverIn(stores, now, workspace)
  };
}

/** A lost file and an invalid file both refuse writes; the reason tells them apart for the operator. */
export function reasonOf(reason: string): LedgerReason {
  if (reason === "registry_lost" || reason === "workspace_lost")
    return "ledger_lost";
  return "ledger_invalid";
}

function stateOf(reason: string): ActivationThreadState {
  if (reason === "registry_lost" || reason === "workspace_lost") {
    return { status: "ledger_lost" };
  }
  return { status: "ledger_invalid" };
}

async function workspaceStateIn(
  stores: LedgerStores,
  workspaceId: string
): Promise<WorkspaceState> {
  const view = await stores.workspaces.read(workspaceId);
  if (view.status === "invalid")
    return { status: "invalid", reason: reasonOf(view.reason) };
  return {
    status: "ready",
    paused: view.file.paused,
    ...optionalField("pausedAt", view.file.pausedAt)
  };
}

/** Absent values are omitted, not sent as undefined, so the result reads the same as the stored file. */
export function optionalField<K extends string>(
  key: K,
  value: string | undefined
): Partial<Record<K, string>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
}

type PauseOutcome = { decision: "updated"; paused: boolean; pausedAt?: string };

/** Pausing an already paused workspace changes nothing; so does resuming one that runs. */
function pausedFile(file: WorkspaceFile, at: string): WorkspaceFile {
  if (file.paused) return file;
  const history = openPause(
    {
      intervals: file.pauseHistory ?? [],
      completeSince: file.historyCompleteSince
    },
    at
  );
  return {
    ...file,
    paused: true,
    pausedAt: at,
    pauseHistory: history.intervals,
    historyCompleteSince: history.completeSince
  };
}

function resumedFile(file: WorkspaceFile, at: string): WorkspaceFile {
  if (!file.paused) return file;
  const history = closePause(
    {
      intervals: file.pauseHistory ?? [],
      completeSince: file.historyCompleteSince
    },
    at
  );
  return {
    ...file,
    paused: false,
    pausedAt: undefined,
    pauseHistory: history.intervals,
    historyCompleteSince: history.completeSince
  };
}

const PAUSE_TRANSITIONS: Record<
  string,
  (file: WorkspaceFile, at: string) => WorkspaceFile
> = {
  true: pausedFile,
  false: resumedFile
};

async function setPausedIn(
  stores: LedgerStores,
  now: () => string,
  workspaceId: string,
  paused: boolean
): Promise<PauseOutcome | LedgerRefusal> {
  const at = now();
  const result = await stores.workspaces.update<PauseOutcome>(
    workspaceId,
    (file) => {
      const next = PAUSE_TRANSITIONS[String(paused)](file, at);
      return {
        value: { decision: "updated", paused, pausedAt: next.pausedAt },
        file: next
      };
    }
  );
  if (result.status === "invalid") return refusal(reasonOf(result.reason));
  return result.value;
}

/**
 * The cycles setting as the daemon trusts it. The file is read every time, so a manual edit
 * shows at once, and only the recorded authorization decides what counts.
 */
async function cyclesStateIn(
  stores: LedgerStores,
  workspace: WorkspaceInfo
): Promise<CyclesState> {
  const view = await stores.workspaces.read(workspace.id);
  if (view.status === "invalid") {
    const lost = reasonOf(view.reason) === "ledger_lost";
    return { status: lost ? "ledger_lost" : "ledger_invalid" };
  }
  const raw = await readRawActivityInWorkspace(workspace);
  return cyclesStateOf(raw, view.file.cyclesAuthorization);
}

/** Written after the settings file, so a crash in between leaves the setting tampered: fail closed. */
async function authorizeCyclesIn(
  stores: LedgerStores,
  now: () => string,
  workspace: WorkspaceInfo,
  cyclesPerStage: number
): Promise<{ decision: "authorized" } | LedgerRefusal> {
  const at = now();
  const result = await stores.workspaces.update<{ decision: "authorized" }>(
    workspace.id,
    (file) => ({
      value: { decision: "authorized" },
      file: {
        ...file,
        cyclesAuthorization: {
          revision: randomUUID(),
          cyclesPerStage,
          hash: cyclesContentHash(cyclesPerStage),
          at
        }
      }
    })
  );
  if (result.status === "invalid") return refusal(reasonOf(result.reason));
  return result.value;
}

async function authorizeTurnTimeoutIn(
  stores: LedgerStores,
  now: () => string,
  workspace: WorkspaceInfo,
  turnTimeoutMinutes: number
): Promise<{ decision: "authorized" } | LedgerRefusal> {
  const result = await writeTurnTimeoutAuthorization(
    stores.workspaces,
    now,
    workspace,
    turnTimeoutMinutes
  );
  if (result.status === "invalid") return refusal(reasonOf(result.reason));
  return { decision: "authorized" };
}

async function authorizeIn(
  threads: ThreadStore,
  scope: ThreadScope,
  policy: ActivationPolicy,
  confirmed: StageMappingChoice | undefined
): Promise<AuthorizeOutcome> {
  const pin = pinOf(policy);
  const result = await threads.update<AuthorizeOutcome>(scope, (file) => {
    const decision = stageForSave(file.activation, confirmed);
    if (decision.decision === "mapping_required") return { value: decision };
    return {
      value: { decision: "authorized" },
      file: {
        ...file,
        activation: activityAfterSave(file.activation, pin, decision.stage)
      }
    };
  });
  if (result.status === "invalid") return refusal(reasonOf(result.reason));
  if (result.status === "closed") return refusal("thread_closed");
  return result.value;
}

/**
 * A lost or invalid thread file, or a lost or invalid workspace file, is reported as such.
 * Otherwise the policy pin and the cycles authorization are judged together.
 */
async function threadStateIn(
  threads: ThreadStore,
  scope: ThreadScope,
  policy: PolicyView,
  cycles: CyclesState,
  floor: StageFloor | undefined
): Promise<ActivationThreadState> {
  const view = await threads.read(scope);
  if (view.status === "invalid") return stateOf(view.reason);
  if (cycles.status === "ledger_lost") return { status: "ledger_lost" };
  if (cycles.status === "ledger_invalid") return { status: "ledger_invalid" };
  const settings = cycles.status === "authorized" ? "authorized" : "tampered";
  return judgeActivation(policy, view.file.activation, settings, floor);
}

function refusal(reason: LedgerReason): LedgerRefusal {
  return { decision: "refused", reason };
}
