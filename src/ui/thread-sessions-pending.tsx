import * as React from "react";
import { SquareArrowOutUpRight } from "lucide-react";
import type {
  MarkdownLinkHandler,
  ThreadSessionWarning,
  Translate
} from "./types.js";

type WarningKind = ThreadSessionWarning["kind"];
type WarningOf<K extends WarningKind> = Extract<
  ThreadSessionWarning,
  { kind: K }
>;

/** The two lines of a pending item, each with its own tooltip, and the label of its go-to button. */
export type PendingLines = { head: string; detail: string; goLabel: string };

/** Dispatch table: pending kind to its two lines and the label of its go-to button. */
const PENDING_LINES: {
  [K in WarningKind]: (t: Translate, warning: WarningOf<K>) => PendingLines;
} = {
  pending_mention: (t, warning) => ({
    head: warning.profile,
    detail: t("Was mentioned and has not replied yet"),
    goLabel: t("Go to the message")
  }),
  chain_limit: (t, warning) => ({
    head: t("Architect exchange"),
    detail: t(
      "Waiting for a human message after {{count}} architect messages",
      { count: warning.length }
    ),
    goLabel: t("Go to the latest message")
  }),
  awaiting_human: (t, warning) => ({
    head: warning.profile,
    detail: t("{{askedBy}} asked you something", { askedBy: warning.askedBy }),
    goLabel: t("Go to the question")
  })
};

/** The lines of one pending item, in the translated text it shows. */
export function pendingLines(
  t: Translate,
  warning: ThreadSessionWarning
): PendingLines {
  const build = PENDING_LINES[warning.kind] as (
    t: Translate,
    warning: ThreadSessionWarning
  ) => PendingLines;
  return build(t, warning);
}

/** The go-to target: the last message of the warning, as a marc:// message reference. */
export function goReference(warning: ThreadSessionWarning): string | undefined {
  const last = warning.messageIds.at(-1);
  if (last === undefined) return undefined;
  return `marc://#${last}`;
}

/** The pending items, one per warning. Each shows two single-line texts and one go-to button. */
export function PendingList({
  warnings,
  t,
  onOpenLink
}: {
  warnings: ThreadSessionWarning[];
  t: Translate;
  onOpenLink: MarkdownLinkHandler;
}) {
  return (
    <section className="sessions-section">
      <span className="sessions-eyebrow">{t("Pending")}</span>
      <ul className="sessions-pending-list">
        {warnings.map((warning, index) => (
          <PendingItem
            key={`${warning.kind}-${index}`}
            warning={warning}
            t={t}
            onOpenLink={onOpenLink}
          />
        ))}
      </ul>
    </section>
  );
}

function PendingItem({
  warning,
  t,
  onOpenLink
}: {
  warning: ThreadSessionWarning;
  t: Translate;
  onOpenLink: MarkdownLinkHandler;
}) {
  const lines = pendingLines(t, warning);
  return (
    <li className="sessions-pending-item">
      <span className="sessions-two-line">
        <span className="sessions-line-head" title={lines.head}>
          {lines.head}
        </span>
        <span className="sessions-line-detail" title={lines.detail}>
          {lines.detail}
        </span>
      </span>
      <GoButton
        reference={goReference(warning)}
        label={lines.goLabel}
        onOpenLink={onOpenLink}
      />
    </li>
  );
}

function GoButton({
  reference,
  label,
  onOpenLink
}: {
  reference: string | undefined;
  label: string;
  onOpenLink: MarkdownLinkHandler;
}) {
  if (reference === undefined) return null;
  return (
    <button
      type="button"
      className="sessions-go"
      title={label}
      aria-label={label}
      data-reference={reference}
      onClick={() => void onOpenLink(reference)}
    >
      <SquareArrowOutUpRight size={14} aria-hidden="true" />
    </button>
  );
}

/** The pending list while its panel is open, and nothing while it is collapsed or nothing waits. */
export function PendingPanel({
  warnings,
  open,
  t,
  onOpenLink
}: {
  warnings: ThreadSessionWarning[];
  open: boolean;
  t: Translate;
  onOpenLink: MarkdownLinkHandler;
}) {
  if (!open || warnings.length === 0) return null;
  return <PendingList warnings={warnings} t={t} onOpenLink={onOpenLink} />;
}

/** Every label key the pending list can show, for the catalog test. Table keys are not literal t() calls. */
export const PENDING_LABEL_KEYS: string[] = [
  "Pending",
  "Architect exchange",
  "Was mentioned and has not replied yet",
  "Waiting for a human message after {{count}} architect messages",
  "{{askedBy}} asked you something",
  "Go to the message",
  "Go to the latest message",
  "Go to the question"
];
