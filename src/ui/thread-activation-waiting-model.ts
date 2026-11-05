import type {
  ActivationHoldView,
  ActivationPermissionView,
  ActivationSupervisionCard,
  ActivationSupervisionStatus,
  ThreadActivationView
} from "./types.js";

/** The kinds of item the waiting section lists. The first four ask for an action; the rest only tell. */
export type WaitingKind =
  | "permission"
  | "start"
  | "continue"
  | "retry"
  | "stopped"
  | "running"
  | "waiting"
  | "hold";

/** The kinds that come from a card. A permission row and a hold row have their own shapes. */
export type CardKind = Exclude<WaitingKind, "permission" | "hold">;

/** One row. Its key is unique within the section, so a re-render keeps the same row. */
export type WaitingItem =
  | {
      kind: "permission";
      key: string;
      card: ActivationSupervisionCard;
      request: ActivationPermissionView;
    }
  | { kind: "hold"; key: string; hold: ActivationHoldView }
  | { kind: CardKind; key: string; card: ActivationSupervisionCard };

/** The kinds that ask for a human action. Only these count on the ⚡ button. */
const ACTIONABLE: readonly WaitingKind[] = [
  "permission",
  "start",
  "continue",
  "retry"
];

/** The order of the section: open permission requests, starts, failures with an action, turns, then waits. */
const RANK: Record<WaitingKind, number> = {
  permission: 0,
  start: 1,
  continue: 2,
  retry: 2,
  stopped: 3,
  running: 3,
  waiting: 4,
  hold: 4
};

/** Dispatch table: the kind a card shows as. A status not listed has no row in the section. */
const CARD_KIND: Partial<
  Record<
    ActivationSupervisionStatus,
    (card: ActivationSupervisionCard) => CardKind
  >
> = {
  awaiting_confirmation: () => "start",
  waiting: () => "waiting",
  starting: () => "running",
  running: () => "running",
  failed: failedKindOf
};

/** A timed-out failure offers Continue; any other failure that Retry accepts offers Retry. */
function failedKindOf(card: ActivationSupervisionCard): CardKind {
  if (card.canContinue && card.reason === "timeout") return "continue";
  if (card.canRetry && card.reason !== "timeout") return "retry";
  return "stopped";
}

function itemsOfCard(card: ActivationSupervisionCard): WaitingItem[] {
  if (card.status === "running" && card.permissions.length > 0) {
    return card.permissions.map(
      (request): WaitingItem => ({
        kind: "permission",
        key: `permission:${card.messageId}:${card.recipient}:${request.requestId}`,
        card,
        request
      })
    );
  }
  const kindOf = CARD_KIND[card.status];
  if (kindOf === undefined) return [];
  const kind = kindOf(card);
  return [{ kind, key: `${kind}:${card.messageId}:${card.recipient}`, card }];
}

function holdItemOf(hold: ActivationHoldView): WaitingItem {
  return {
    kind: "hold",
    key: `hold:${hold.messageId}:${hold.recipient}`,
    hold
  };
}

/**
 * The rows of the waiting section, in their order. A card with open permission requests lists one row per
 * request; a card without requests lists one row. Final states have no row. Holds are rows without an action.
 */
export function waitingItemsOf(
  view: Pick<ThreadActivationView, "supervision" | "holds"> | undefined
): WaitingItem[] {
  const cards = (view?.supervision ?? []).flatMap(itemsOfCard);
  const holds = (view?.holds ?? []).map(holdItemOf);
  return [...cards, ...holds].sort((a, b) => RANK[a.kind] - RANK[b.kind]);
}

/** The number on the section title and on the ⚡ button: only the rows that ask for an action. */
export function waitingCountOf(
  view: Pick<ThreadActivationView, "supervision" | "holds"> | undefined
): number {
  return waitingItemsOf(view).filter((item) => ACTIONABLE.includes(item.kind))
    .length;
}

export const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** A time span as a message key and its count: whole hours from one hour on, minutes below that. */
export type DurationText = { key: string; count: number };

export function durationOf(ms: number): DurationText {
  if (ms >= HOUR_MS)
    return { key: "{{count}} h", count: Math.floor(ms / HOUR_MS) };
  return {
    key: "{{count}} min",
    count: Math.max(0, Math.ceil(ms / MINUTE_MS))
  };
}

/** The en-US title of a failed card, by the reason the turn recorded. Unknown reasons read as a plain failure. */
const FAILURE_TITLE: Partial<Record<string, string>> = {
  timeout: "{{agent}} stopped at the time limit",
  crashed: "{{agent}} stopped unexpectedly",
  invalid_output: "The client's result could not be read",
  session_not_found: "The linked session no longer exists",
  auth: "The client is not signed in",
  client_missing: "The client is not installed on this machine",
  revoked: "The start was revoked before the turn began",
  error: "The turn failed"
};

export function failureTitleKeyOf(reason: string | undefined): string {
  return FAILURE_TITLE[reason ?? ""] ?? "The turn failed";
}

export type WaitText = { title: string; detail: string };

/** The en-US text of a wait, by the reason the daemon recorded. Unknown reasons read as a plain wait. */
const WAIT_TEXT: Partial<Record<string, WaitText>> = {
  busy: {
    title: "{{agent}} is busy",
    detail: "It will be checked again when the turn ends"
  },
  not_listening: {
    title: "{{agent}} is open but not listening",
    detail: "Wake it in its terminal, or close it to start it from here"
  },
  checking_sessions: {
    title: "Checking sessions",
    detail: "The daemon just started · this takes up to 45 s"
  },
  other_host: {
    title: "{{agent}} is open on another machine",
    detail: "Only that machine can wake it"
  },
  identity_unverified: {
    title: "{{agent}}'s session could not be verified",
    detail:
      "mARC will not start a second session while the open one is unverified"
  },
  unknown: {
    title: "{{agent}}'s session state is unclear",
    detail: "Check its sessions in the sessions menu, then mention it again"
  },
  conflict: {
    title: "{{agent}} has conflicting sessions",
    detail: "Check its sessions in the sessions menu, then mention it again"
  },
  budget_exhausted: {
    title: "This stage used all its cycles",
    detail: "Add cycles or advance the stage"
  },
  workspace_paused: {
    title: "Activations are paused in this workspace",
    detail: "Resume them in the workspace pause control"
  },
  ledger_lost: {
    title: "The thread state file is missing",
    detail: "Recover the state in the activation panel"
  },
  ledger_invalid: {
    title: "The thread state file cannot be read",
    detail: "Recover the state in the activation panel"
  }
};

const WAIT_FALLBACK: WaitText = {
  title: "{{agent}} is waiting",
  detail: "Nothing to do until the cause clears"
};

export function waitTextOf(reason: string | undefined): WaitText {
  return WAIT_TEXT[reason ?? ""] ?? WAIT_FALLBACK;
}

/** The card actions the daemon names, and the permission decisions the panel sends. */
export type CardAction = "approve" | "decline" | "retry" | "continue";
export type PermissionDecision = "allow" | "deny";

export function supervisionPathOf(
  workspaceId: string,
  threadId: string,
  action: CardAction
): string {
  return `${threadBase(workspaceId, threadId)}/activation/supervision/${action}`;
}

export function permissionPathOf(
  workspaceId: string,
  threadId: string,
  requestId: string
): string {
  const path = `${threadBase(workspaceId, threadId)}/activation/supervision/permissions`;
  return `${path}/${encodeURIComponent(requestId)}`;
}

function threadBase(workspaceId: string, threadId: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/threads/${encodeURIComponent(threadId)}`;
}

/** Every key of this module, for the catalog test. Table keys are not literal t() calls. */
export const WAITING_LABEL_KEYS: string[] = [
  "Waiting for you",
  "{{count}} h",
  "{{count}} min",
  ...Object.values(FAILURE_TITLE).filter(
    (text): text is string => text !== undefined
  ),
  "The turn failed",
  ...Object.values(WAIT_TEXT).flatMap((text) =>
    text === undefined ? [] : [text.title, text.detail]
  ),
  WAIT_FALLBACK.title,
  WAIT_FALLBACK.detail
];
