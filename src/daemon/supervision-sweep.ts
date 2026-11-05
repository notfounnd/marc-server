import {
  advanceFloor,
  expireDue,
  pruneSupervision
} from "../core/activation-supervision-records.js";
import type { SupervisionState } from "../core/activation-supervision-types.js";
import type { ActivationServices } from "./activation-views.js";
import type { ThreadScope } from "./thread-store.js";
import type { PassOutcome } from "./supervision-pass.js";
import { supervisionOf } from "./supervision-pass.js";

/**
 * Expires the cards whose deadline has passed. Only waiting, awaiting and failed cards can expire, so a
 * running turn is never cut by the clock. An expired card moves its recipient's floor, so it is never
 * recreated, and the pruning keeps the records bounded.
 */
export function expireState(
  state: SupervisionState,
  now: string
): SupervisionState {
  const records = state.records.map((record) => expireDue(record, now));
  const changed = records.filter(
    (record, index) => record !== state.records[index]
  );
  if (changed.length === 0) return state;
  const floors = changed.reduce(
    (current, record) => advanceFloor(current, record),
    state.floors
  );
  return pruneSupervision({ records, floors });
}

/** One thread's expiry sweep, inside its queue. A thread without supervision state is left unchanged. */
export async function sweepThreadIn(
  services: ActivationServices,
  scope: ThreadScope,
  now: string
): Promise<PassOutcome> {
  const result = await services.threads.update<boolean>(scope, (file) => {
    const current = supervisionOf(file);
    if (current.records.length === 0) return { value: false };
    const next = expireState(current, now);
    if (next === current) return { value: false };
    return { value: true, file: { ...file, supervision: next } };
  });
  if (result.status !== "done") return "unchanged";
  return result.value ? "changed" : "unchanged";
}
