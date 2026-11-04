import * as React from "react";
import { Copy } from "lucide-react";
import type {
  SessionBindingSummary,
  SessionStateName,
  ThreadSessionSlot,
  ThreadSessionsView,
  Translate
} from "./types.js";

type Tone = "online" | "attention" | "neutral" | "posted";

/** Dispatch table: session state to its dot tone, and to the reason its Copy button is blocked. */
const STATE_ROWS: Record<
  SessionStateName,
  { tone: Tone; copyBlocked?: string }
> = {
  unbound: { tone: "neutral" },
  online: { tone: "online", copyBlocked: "Session already open" },
  reserved: { tone: "attention", copyBlocked: "Session reserved" },
  ended: { tone: "neutral" },
  unknown: { tone: "attention", copyBlocked: "Session state unknown" },
  conflict: { tone: "attention", copyBlocked: "Session in conflict" }
};

/** Dispatch table: a block set by the client rather than the state, by the view's reason, to its tooltip. */
const COPY_BLOCKS: Partial<Record<string, string>> = {
  unsupported_client: "Only Claude Code sessions are supported for now."
};

/** The tooltip that disables Copy: the client block first, then the state block. */
function copyBlockOf(slot: ThreadSessionSlot): string | undefined {
  return (
    COPY_BLOCKS[slot.copyBlockedReason ?? ""] ??
    STATE_ROWS[slot.state].copyBlocked
  );
}

/** Dispatch table: daemon reason code to the short label an unknown or conflict row shows. */
const SHORT_REASONS: Partial<Record<string, string>> = {
  no_binding: "no session linked",
  other_host: "another host",
  agents_unavailable: "process list unavailable",
  two_processes: "two processes",
  reservation_active: "reservation active",
  owner_listed: "running",
  session_changed: "session changed",
  session_resumed: "resumed",
  identity_unproven: "identity unproven",
  reservation_expired: "reservation expired",
  reservation_unproven: "reservation unproven",
  released: "released",
  released_unproven: "released, not proven",
  owner_absent: "process gone",
  lease_alive_unlisted: "lease not listed",
  no_proof: "no live proof",
  recorded_conflict: "conflict recorded",
  registry_invalid: "registry invalid"
};

type ShortLabel = (slot: ThreadSessionSlot) => string;

/** Dispatch table: session state to the short label that follows the role in the sub-line. */
const SHORT_LABELS: Record<SessionStateName, ShortLabel> = {
  unbound: unboundLabel,
  online: onlineLabel,
  reserved: () => "reserved",
  ended: () => "ended",
  unknown: reasonLabel("state unknown"),
  conflict: reasonLabel("in conflict")
};

function unboundLabel(slot: ThreadSessionSlot): string {
  if (slot.profileHasMessages) return "posted here, no session linked";
  return "no session";
}

function onlineLabel(slot: ThreadSessionSlot): string {
  if (slot.details.busy) return "busy";
  if (slot.details.listening) return "listening";
  return "online";
}

function reasonLabel(fallback: string): ShortLabel {
  return (slot) => SHORT_REASONS[slot.details.reason] ?? fallback;
}

const REASON_LABELS: Record<string, string> = {
  no_binding: "No session has been linked to this thread yet.",
  other_host: "The linked session belongs to another host.",
  agents_unavailable: "The Claude Code process list is unavailable.",
  two_processes: "Two Claude Code processes share the linked session.",
  reservation_active: "A launch is reserved and waiting for its client.",
  owner_listed: "The linked session is running.",
  session_changed: "The linked process now runs a different session.",
  session_resumed: "The linked session was resumed in a new process.",
  identity_unproven: "The linked session could not be matched to a process.",
  reservation_expired: "The reservation expired before a client claimed it.",
  reservation_unproven: "The reservation cannot be confirmed yet.",
  released: "The session was released and its process is gone.",
  released_unproven:
    "The session was released, but the process list cannot confirm it ended.",
  owner_absent: "The linked process is no longer running.",
  lease_alive_unlisted:
    "A live client holds this session, but the process list does not show it.",
  no_proof: "There is no live evidence for this session.",
  recorded_conflict: "A conflicting session was recorded and is still running.",
  registry_invalid: "The session registry is invalid, so the state is unknown."
};

const UNKNOWN_REASON = "Unknown session state.";

const ORIGIN_LABELS: Record<SessionBindingSummary["origin"], string> = {
  open: "Opened with marc open",
  adopted: "Adopted from a session outside mARC"
};

/** Copies the native command of the slot. A blocked slot copies nothing, and the UI never builds a command. */
export function copySlotCommand(
  slot: ThreadSessionSlot,
  onCopy: (text: string) => void
): void {
  const text = slot.copyCommand?.text;
  if (text === undefined) return;
  if (copyBlockOf(slot) !== undefined) return;
  onCopy(text);
}

function toneOf(slot: ThreadSessionSlot): Tone {
  if (slot.state === "unbound" && slot.profileHasMessages) return "posted";
  return STATE_ROWS[slot.state].tone;
}

/** One compact line per profile, with the reason and the binding in its title tooltip. */
export function ThreadSessionRow({
  slot,
  t,
  onCopy
}: {
  slot: ThreadSessionSlot;
  t: Translate;
  onCopy: (text: string) => void;
}) {
  const blocked = copyBlockOf(slot);
  return (
    <li
      className="sessions-row"
      data-state={slot.state}
      title={rowTitle(slot, t)}
    >
      <span
        className="sessions-dot"
        data-tone={toneOf(slot)}
        aria-hidden="true"
      />
      <span className="sessions-name">
        <strong className="sessions-profile">{slot.profile}</strong>
        <span className="sessions-sub">{subLine(slot, t)}</span>
      </span>
      <button
        type="button"
        className="sessions-copy"
        aria-label={t("Copy command")}
        title={t(blocked ?? "Copy command")}
        disabled={blocked !== undefined}
        onClick={() => copySlotCommand(slot, onCopy)}
      >
        <Copy size={14} aria-hidden="true" />
      </button>
    </li>
  );
}

function subLine(slot: ThreadSessionSlot, t: Translate): string {
  const state = t(SHORT_LABELS[slot.state](slot));
  return [slot.role, state]
    .filter((part): part is string => part !== undefined)
    .join(" · ");
}

/** The full reason, then the origin, generation and bound time of the binding. */
function rowTitle(slot: ThreadSessionSlot, t: Translate): string {
  const reason = REASON_LABELS[slot.details.reason] ?? UNKNOWN_REASON;
  return [t(reason), ...bindingLines(slot.binding, t)].join("\n");
}

function bindingLines(
  binding: SessionBindingSummary | null,
  t: Translate
): string[] {
  if (binding === null) return [];
  return [
    `${t("Origin")}: ${t(ORIGIN_LABELS[binding.origin])}`,
    `${t("Generation")}: ${binding.generation}`,
    `${t("Bound at")}: ${new Date(binding.boundAt).toLocaleString()}`
  ];
}

const AGENTS_NOTICE =
  "Claude Code session list unavailable. States may show as unknown.";
const REGISTRY_NOTICE =
  "Session registry unreadable. Opening sessions is blocked until it is recovered.";
const REGISTRY_LOST_NOTICE =
  "Session registry unreadable. Opening sessions is blocked until it is recovered. See Sessions and ownership in the docs.";

/** Dispatch table: registry reason to its notice; other invalid reasons use the generic notice. */
const REGISTRY_NOTICES: Partial<Record<string, string>> = {
  registry_lost: REGISTRY_LOST_NOTICE
};

/**
 * The one plain line for a degraded source, or none when both sources are healthy.
 * A registry problem outranks the agents list, because every slot is unknown then.
 */
export function degradedNotice(view: ThreadSessionsView): string | undefined {
  if (view.registry.status === "invalid") {
    return REGISTRY_NOTICES[view.registry.reason ?? ""] ?? REGISTRY_NOTICE;
  }
  if (view.sources.agents === "unavailable") return AGENTS_NOTICE;
  return undefined;
}

/** Renders nothing while every source is healthy, so a healthy menu shows no source text. */
export function DegradedNotice({
  view,
  t
}: {
  view: ThreadSessionsView;
  t: Translate;
}) {
  const notice = degradedNotice(view);
  if (!notice) return null;
  return <p className="sessions-notice">{t(notice)}</p>;
}

/** Every label key the row can show, for the catalog test. Table keys are not literal t() calls. */
export const ROW_LABEL_KEYS: string[] = [
  "Session already open",
  "Session reserved",
  "Session state unknown",
  "Session in conflict",
  "no session",
  "posted here, no session linked",
  "busy",
  "listening",
  "online",
  "reserved",
  "ended",
  "state unknown",
  "in conflict",
  ...Object.values(SHORT_REASONS).filter(
    (label): label is string => label !== undefined
  ),
  ...Object.values(REASON_LABELS),
  UNKNOWN_REASON,
  ...Object.values(ORIGIN_LABELS),
  "Origin",
  "Generation",
  "Bound at",
  "Copy command",
  ...Object.values(COPY_BLOCKS).filter(
    (label): label is string => label !== undefined
  ),
  AGENTS_NOTICE,
  REGISTRY_NOTICE,
  REGISTRY_LOST_NOTICE
];
