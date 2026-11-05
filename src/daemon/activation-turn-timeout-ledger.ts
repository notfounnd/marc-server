import {
  turnTimeoutContentHash,
  turnTimeoutStateOf,
  type TurnTimeoutState
} from "../core/activation-turn-timeout.js";
import { readRawActivityInWorkspace } from "../core/memory/settings.js";
import type { WorkspaceInfo } from "../core/types.js";
import type { WorkspaceStore } from "./workspace-store.js";

/** The turn time limit as the daemon trusts it, or the workspace file that cannot be read. */
export type TurnTimeoutRead =
  | TurnTimeoutState
  | { status: "invalid"; reason: string };

export type TurnTimeoutWrite =
  | { status: "done" }
  | { status: "invalid"; reason: string };

/**
 * The time limit of a turn as the daemon trusts it. The file is read every time, so a manual edit shows
 * at once, and only the recorded authorization decides which value counts.
 */
export async function turnTimeoutStateIn(
  workspaces: WorkspaceStore,
  workspace: WorkspaceInfo
): Promise<TurnTimeoutRead> {
  const view = await workspaces.read(workspace.id);
  if (view.status === "invalid")
    return { status: "invalid", reason: view.reason };
  const raw = await readRawActivityInWorkspace(workspace);
  return turnTimeoutStateOf(raw, view.file.turnTimeoutAuthorization);
}

/**
 * Records the human's UI save of the time limit. The caller writes the settings file first, so a crash
 * in between leaves the value tampered, which is the fail-closed side.
 */
export async function writeTurnTimeoutAuthorization(
  workspaces: WorkspaceStore,
  now: () => string,
  workspace: WorkspaceInfo,
  turnTimeoutMinutes: number
): Promise<TurnTimeoutWrite> {
  const at = now();
  const result = await workspaces.update<{ status: "done" }>(
    workspace.id,
    (file) => ({
      value: { status: "done" },
      file: {
        ...file,
        turnTimeoutAuthorization: {
          turnTimeoutMinutes,
          hash: turnTimeoutContentHash(turnTimeoutMinutes),
          at
        }
      }
    })
  );
  if (result.status === "invalid") {
    return { status: "invalid", reason: result.reason };
  }
  return result.value;
}
