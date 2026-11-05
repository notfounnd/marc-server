import type { ActivationHoldView, Message } from "./types.js";

export type ParticipantRow = { agentId: string; leads: boolean };

/** One row per architect profile, marked when it is the lead. */
export function participantRowsOf(
  participants: readonly string[],
  lead: string | null | undefined
): ParticipantRow[] {
  return participants.map((agentId) => ({ agentId, leads: agentId === lead }));
}

/** The body of a lead change: the architect the human picked, and the lead the panel saw. */
export type LeadBody = { agentId: string; expectedLead: string | null };

export function leadBodyOf(
  agentId: string,
  currentLead: string | null | undefined
): LeadBody {
  return { agentId, expectedLead: currentLead ?? null };
}

export type HoldOrigin = { agentId: string; timestamp: string };

/** The author and time of the message that holds a reservation or a card, read from the loaded thread. Undefined when that message is not loaded. */
export function holdOriginOf(
  hold: Pick<ActivationHoldView, "messageId">,
  messages: readonly Message[]
): HoldOrigin | undefined {
  const message = messages.find((item) => item.id === hold.messageId);
  if (!message) return undefined;
  return { agentId: message.agentId, timestamp: message.timestamp };
}
