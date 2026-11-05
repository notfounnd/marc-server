import { belowFloor, isPending } from "./activation-supervision-records.js";
import type {
  SlotFacts,
  SupervisionFacts,
  SupervisionStatus,
  SupervisionVerdict
} from "./activation-supervision-types.js";

/**
 * Pure judgment of one supervision pass for one mention and one recipient. Rows are evaluated top
 * to bottom and the first row that answers stops the table, in the same way as judgeReservation.
 * The rows only translate: the refused and held rows receive the verdict of judgeReservation for the
 * same mention and recipient, and they do not repeat its gates. Identity only blocks a live occupant
 * (online), never an unbound slot, a first creation or a proven end. A reserved slot has no client
 * process yet, so only its host is checked. The balance never blocks a return that closes a cycle
 * already paid.
 */
type Step = (facts: SupervisionFacts) => SupervisionVerdict | undefined;

export function judgeSupervision(facts: SupervisionFacts): SupervisionVerdict {
  for (const step of STEPS) {
    const verdict = step(facts);
    if (verdict) return verdict;
  }
  return none("unmapped_slot_state");
}

/**
 * Settled, refused, listening, held, barred, busy, notListening, free, in this order. The owner's
 * waiter already reserves and shows its held mention, so a listening slot never gets a second card.
 */
const STEPS: readonly Step[] = [
  settledStep,
  refusedStep,
  listeningStep,
  heldStep,
  barredSlotStep,
  busyStep,
  notListeningStep,
  freeStep
];

/** Only a pending card is judged again. A starting, running, failed or settled card is left alone. */
function settledStep(facts: SupervisionFacts): SupervisionVerdict | undefined {
  const { existing } = facts;
  if (existing === undefined) return undefined;
  if (isPending(existing.status)) return undefined;
  return none(`already_${existing.status}`);
}

/**
 * A refused reservation creates nothing. A pending card of the same mention is superseded with the
 * refusal's reason, so its Approve does not stay on the panel until it expires.
 */
function refusedStep(facts: SupervisionFacts): SupervisionVerdict | undefined {
  const { reservation } = facts;
  if (reservation.status !== "refused") return undefined;
  const reason = reservation.reason ?? "reservation_refused";
  if (facts.existing === undefined) return none(reason);
  return { action: "update", status: "superseded", reason };
}

/**
 * A listening online slot wakes its own waiter, so no card is needed. A pending card that was made
 * earlier is superseded by that answer.
 */
function listeningStep(
  facts: SupervisionFacts
): SupervisionVerdict | undefined {
  if (!isListeningOnline(facts.slot)) return undefined;
  if (facts.existing === undefined) return none("listening");
  return { action: "update", status: "superseded", reason: "listening" };
}

/**
 * A held reservation (pause, a state that resolves in the panel, or the balance that blocks opening a
 * cycle) becomes a waiting card with its reason, and no Approve.
 */
function heldStep(facts: SupervisionFacts): SupervisionVerdict | undefined {
  const { reservation } = facts;
  if (reservation.status !== "held") return undefined;
  return settle(facts, "waiting", reservation.reason);
}

/**
 * An unknown or conflicting slot waits. So does a live occupant on another host, or an online one
 * whose identity is not verified. An unbound or ended slot is never barred here.
 */
function barredSlotStep(
  facts: SupervisionFacts
): SupervisionVerdict | undefined {
  if (!isBarred(facts.slot)) return undefined;
  return settle(facts, "waiting", barredReasonOf(facts.slot));
}

/** A busy online slot, or a reserved one, waits for its turn. SlotDetails.busy never covers reserved. */
function busyStep(facts: SupervisionFacts): SupervisionVerdict | undefined {
  if (!isBusy(facts.slot)) return undefined;
  return settle(facts, "waiting", "busy");
}

/** An online slot without a listener waits, because resuming it would fork an open session. */
function notListeningStep(
  facts: SupervisionFacts
): SupervisionVerdict | undefined {
  if (facts.slot.state !== "online") return undefined;
  return settle(facts, "waiting", "not_listening");
}

/** A free slot, unbound or ended, awaits the human's Approve. */
function freeStep(facts: SupervisionFacts): SupervisionVerdict | undefined {
  const { state } = facts.slot;
  if (state !== "unbound" && state !== "ended") return undefined;
  return settle(facts, "awaiting_confirmation");
}

/**
 * The write rule shared by the rows. An existing pending card is updated, never duplicated. A new card
 * is created only above the recipient's floor, so a pruned or settled mention is never recreated.
 */
function settle(
  facts: SupervisionFacts,
  status: SupervisionStatus,
  reason?: string
): SupervisionVerdict {
  if (facts.existing !== undefined) {
    return { action: "update", status, reason };
  }
  if (belowFloor(facts.messageAt, facts.floor)) return none("below_floor");
  return { action: "create", status, reason };
}

function none(reason: string): SupervisionVerdict {
  return { action: "none", reason };
}

function isBarred(slot: SlotFacts): boolean {
  if (slot.state === "unknown" || slot.state === "conflict") return true;
  if (slot.state === "reserved") return !slot.sameHost;
  if (slot.state === "online") return !slot.sameHost || !slot.identityVerified;
  return false;
}

function barredReasonOf(slot: SlotFacts): string {
  if (slot.state === "unknown" || slot.state === "conflict") return slot.state;
  if (!slot.sameHost) return "other_host";
  return "identity_unverified";
}

function isBusy(slot: SlotFacts): boolean {
  if (slot.state === "reserved") return true;
  return slot.state === "online" && slot.details.busy;
}

/**
 * Only a listener on this host counts: its waiter reserves here. A listener on another host is barred
 * as an occupant of another host, so no card is silently dropped for it.
 */
function isListeningOnline(slot: SlotFacts): boolean {
  return slot.state === "online" && slot.sameHost && slot.details.listening;
}
