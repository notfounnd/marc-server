/**
 * The lead is the focal point of a thread: the one architect the human calls to ask what is
 * happening, and the only agent that may advance the stage while posting. It is derived from
 * CHAT.md (the first architect author) unless the human recorded a change. A change moves the
 * lead and nothing else: the budget and the stage stay as they are.
 */
export const LEAD_CHANGE_LIMIT = 50;

/** One human change of the lead. `from` is absent when the thread had no lead yet. */
export type LeadChange = {
  at: string;
  from?: string;
  to: string;
  by: "human";
};

export type LeadChangeInput = {
  /** The lead the thread shows now: the recorded change, else the derived architect. */
  current: string | undefined;
  /** The lead the human saw. Null when the thread had none. */
  expectedLead: string | null;
  agentId: string;
  architect: boolean;
};

/**
 * The lead the thread shows: a recorded human change wins over the derived architect, but only while
 * the recorded profile is still an architect in the registry. A profile that lost the role falls back
 * to the derived lead, so a change never keeps a lead the registry no longer allows.
 */
export function effectiveLeadOf(
  derived: string | undefined,
  recorded: string | undefined,
  architects: ReadonlySet<string>
): string | undefined {
  if (recorded === undefined) return derived;
  if (!architects.has(recorded)) return derived;
  return recorded;
}

/** Dispatch table of the lead change. The first failed check gives the refusal. */
const LEAD_CHECKS: ReadonlyArray<{
  reason: string;
  failed: (input: LeadChangeInput) => boolean;
}> = [
  { reason: "not_architect", failed: (input) => !input.architect },
  {
    reason: "lead_changed",
    failed: (input) => (input.current ?? null) !== input.expectedLead
  },
  { reason: "same_lead", failed: (input) => input.current === input.agentId }
];

export function leadChangeRefusal(input: LeadChangeInput): string | undefined {
  return LEAD_CHECKS.find((check) => check.failed(input))?.reason;
}

/** Appends a change and keeps the list bounded, oldest first out. */
export function appendLeadChange(
  changes: readonly LeadChange[] | undefined,
  change: LeadChange
): LeadChange[] {
  return [...(changes ?? []), change].slice(-LEAD_CHANGE_LIMIT);
}
