import type { WorkspaceInfo } from "../core/types.js";
import { slotKey } from "../core/session-slots.js";
import { waiterIdentityVerified } from "../core/waiter-identity.js";
import { processesOf } from "./process-table-os.js";
import type { SessionServices } from "./session-views.js";
import type { ThreadFile } from "./thread-store.js";

/**
 * The waiter's identity as one step of the thread's queue: it receives the file the step writes, so the
 * binding it reads is the binding of that same snapshot. It answers whether the waiter descends from the
 * client that owns the slot.
 */
export type WaiterIdentity = (file: ThreadFile) => Promise<boolean>;

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

/** Builds the identity step of one reservation. Without a pid, or without a binding, nothing is read at all. */
export function waiterIdentityOf(
  sessions: SessionServices,
  call: WaiterCall
): WaiterIdentity {
  return async (file) => {
    if (call.pid === undefined) return false;
    const key = slotKey({
      workspaceId: call.workspace.id,
      threadId: call.threadId,
      profile: call.recipient
    });
    const binding = file.slots[key];
    if (binding === undefined) return false;
    const table = await processesOf(sessions.processes).list();
    return waiterIdentityVerified({
      pid: call.pid,
      holder: call.holder,
      binding,
      table,
      agents: await sessions.presence.agents()
    });
  };
}
