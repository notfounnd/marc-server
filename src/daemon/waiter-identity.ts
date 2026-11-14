import type { WorkspaceInfo } from "../core/types.js";
import { slotKey, type SlotState } from "../core/session-slots.js";
import {
  waiterIdentityCheck,
  type IdentityCheck
} from "../core/waiter-identity.js";
import { processesOf } from "./process-table-os.js";
import { probeFor, type SessionServices } from "./session-views.js";
import type { ThreadFile } from "./thread-store.js";

/**
 * The waiter's identity as one step of the thread's queue: it receives the file the step writes, so the
 * binding it reads is the binding of that same snapshot. It answers the check that failed, or `verified`.
 */
export type WaiterIdentity = (file: ThreadFile) => Promise<IdentityCheck>;

export type WaiterCall = {
  workspace: WorkspaceInfo;
  threadId: string;
  /** The profile the mention wakes, which names the slot. */
  recipient: string;
  /** The waiter's session, which must be the slot's native session. */
  holder: string;
  /** The waiter's own pid. Without it the identity cannot be verified. */
  pid: number | undefined;
};

/** Builds the identity step of one reservation. Without a pid, or without a binding, nothing else is read. */
export function waiterIdentityOf(
  sessions: SessionServices,
  call: WaiterCall
): WaiterIdentity {
  return async (file) => {
    if (call.pid === undefined) return "no_pid";
    const key = slotKey({
      workspaceId: call.workspace.id,
      threadId: call.threadId,
      profile: call.recipient
    });
    const binding = file.slots[key];
    if (binding === undefined) return "no_binding";
    const table = await processesOf(sessions.processes).list();
    const state = await probeFor(sessions, call.workspace)(binding);
    return waiterIdentityCheck({
      pid: call.pid,
      holder: call.holder,
      binding,
      table,
      agents: await sessions.presence.agents(),
      resumedBy: resumedByOf(state, call.holder)
    });
  };
}

/**
 * The process that resumed the holder's session, when the slot reads session_resumed for that holder. Any
 * other state answers undefined, so the recorded owner stays the client.
 */
function resumedByOf(
  state: SlotState,
  holder: string
): { pid: number; startedAt: number } | undefined {
  if (state.details.reason !== "session_resumed") return undefined;
  const resumed = state.resumedBy;
  if (resumed === undefined || resumed.sessionId !== holder) return undefined;
  return { pid: resumed.pid, startedAt: resumed.startedAt };
}
