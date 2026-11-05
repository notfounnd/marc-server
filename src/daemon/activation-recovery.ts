import {
  highestStampedStage,
  stampedFloorOf
} from "../core/activation-floor.js";
import { messagesOfThreadInWorkspace } from "../core/threads.js";
import type { WorkspaceInfo } from "../core/types.js";
import { raisedActivity } from "./activation-floor.js";
import type {
  LedgerRefusal,
  LedgerStores,
  RecoverReport
} from "./activation-ledger.js";
import type { ThreadScope, ThreadStore } from "./thread-store.js";

/**
 * The human's recovery action. It recreates lost or invalid files, as before, and it raises
 * each thread's stored counters to the cycles the messages already stamped in CHAT.md. It
 * never lowers a counter and never clears a floor.
 */
export async function recoverIn(
  stores: LedgerStores,
  now: () => string,
  workspace: WorkspaceInfo
): Promise<RecoverReport | LedgerRefusal> {
  const at = now();
  const threads: RecoverReport["threads"] = [];
  const conflicts: string[] = [];
  for (const scope of await stores.threads.scopes(workspace.id)) {
    const outcome = await stores.threads.recover(scope);
    if (outcome.kind === "conflict") conflicts.push(scope.threadId);
    if (outcome.kind === "recovered") {
      threads.push({
        threadId: scope.threadId,
        reason: outcome.reason,
        movedAside: outcome.movedAside
      });
    }
    const raised = await raiseFloor(stores.threads, workspace, scope);
    if (outcome.kind !== "recovered" && raised) {
      threads.push({ threadId: scope.threadId, reason: "floor_raised" });
    }
  }
  const workspaceOutcome = await stores.workspaces.recover(workspace.id, at);
  const workspaceReport =
    workspaceOutcome.kind === "recovered"
      ? {
          reason: workspaceOutcome.reason,
          movedAside: workspaceOutcome.movedAside
        }
      : undefined;
  if (workspaceOutcome.kind === "conflict") conflicts.push("workspace");
  return reportOf(threads, workspaceReport, conflicts);
}

/** Writes the floor into one thread, inside its queue. False when nothing had to move. */
async function raiseFloor(
  threads: ThreadStore,
  workspace: WorkspaceInfo,
  scope: ThreadScope
): Promise<boolean> {
  const messages = await messagesOfThreadInWorkspace(workspace, scope.threadId);
  const floor = stampedFloorOf(messages);
  const fallback = highestStampedStage(messages) ?? "planning";
  const outcome = await threads.update(scope, (file) => {
    const activation = raisedActivity(file.activation, floor, fallback);
    if (activation === undefined) return { value: false };
    return { value: true, file: { ...file, activation } };
  });
  return outcome.status === "done" && outcome.value;
}

/** Nothing recovered is a refusal. Conflicts without any recovery say why nothing moved. */
function reportOf(
  threads: RecoverReport["threads"],
  workspace: RecoverReport["workspace"],
  conflicts: string[]
): RecoverReport | LedgerRefusal {
  const recovered = threads.length > 0 || workspace !== undefined;
  if (recovered) {
    return { decision: "recovered", threads, workspace, conflicts };
  }
  if (conflicts.length > 0)
    return { decision: "refused", reason: "move_aside_conflict" };
  return { decision: "refused", reason: "nothing_to_recover" };
}
