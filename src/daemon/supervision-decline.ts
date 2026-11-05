import {
  advanceFloor,
  findRecord,
  pruneSupervision,
  transitionRecord,
  upsertRecord
} from "../core/activation-supervision-records.js";
import type { WorkspaceInfo } from "../core/types.js";
import type { ActivationServices } from "./activation-views.js";
import { scopeOf } from "./activation-views.js";
import type { ThreadStep } from "./thread-store.js";
import { refusedWith, type Refused } from "./supervision-facts.js";
import { supervisionOf } from "./supervision-pass.js";
import type { CardRef } from "./supervision-start.js";

export type DeclineResponse = { decision: "declined" } | Refused;

/**
 * Declines an awaiting card. Only an awaiting card can be declined: a waiting card leaves by expiry or
 * when its state resolves. The decline moves the recipient's floor, so the card is not recreated.
 */
export async function declineIn(
  services: ActivationServices,
  workspace: WorkspaceInfo,
  threadId: string,
  card: CardRef
): Promise<DeclineResponse> {
  const result = await services.threads.update<DeclineResponse>(
    scopeOf(workspace, threadId),
    (file): ThreadStep<DeclineResponse> => {
      const state = supervisionOf(file);
      const record = findRecord(state.records, card.messageId, card.recipient);
      if (record === undefined) return { value: refusedWith("not_found") };
      if (record.status !== "awaiting_confirmation") {
        return { value: refusedWith("not_awaiting", record.status) };
      }
      const declined = transitionRecord(record, "declined");
      if (declined === undefined) {
        return { value: refusedWith("not_declinable", record.status) };
      }
      return {
        value: { decision: "declined" },
        file: {
          ...file,
          supervision: pruneSupervision({
            records: upsertRecord(state.records, declined),
            floors: advanceFloor(state.floors, declined)
          })
        }
      };
    }
  );
  if (result.status === "closed") return refusedWith("thread_closed");
  if (result.status === "invalid") return refusedWith(result.reason);
  return result.value;
}
