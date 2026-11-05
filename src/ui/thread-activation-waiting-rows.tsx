import * as React from "react";
import { Button } from "./common.js";
import { GoToButton } from "./go-to-button.js";
import { STAGE_NAME_KEYS } from "./thread-activation-draft.js";
import { HoldRow } from "./thread-activation-holds.js";
import { holdOriginOf } from "./thread-activation-people.js";
import {
  durationOf,
  failureTitleKeyOf,
  waitTextOf,
  type CardAction,
  type PermissionDecision,
  type WaitingItem,
  type WaitingKind
} from "./thread-activation-waiting-model.js";
import type { ActivationSupervisionCard, Message, Translate } from "./types.js";

/** What a row asks the panel to do: a card action, or the decision on one open request. */
export type WaitingAct =
  | { kind: "card"; action: CardAction; card: ActivationSupervisionCard }
  | { kind: "permission"; requestId: string; decision: PermissionDecision };

/** What every row reads: the messages, the busy state, the go-to, the act, the clock and the policy cap. */
export type RowContext = {
  messages: Message[];
  busy: boolean;
  goTo: (href: string) => void;
  onAct: (act: WaitingAct) => void;
  t: Translate;
  now: number;
  attemptCap: number | undefined;
};

type RowRenderer = (item: WaitingItem, context: RowContext) => React.ReactNode;

/** Dispatch table: the row each kind shows. Each row checks its own shape first. */
export const RENDERERS: Record<WaitingKind, RowRenderer> = {
  permission: permissionRow,
  start: startRow,
  continue: failureRow,
  retry: failureRow,
  stopped: failureRow,
  running: runningRow,
  waiting: waitingRow,
  hold: holdRow
};

function permissionRow(item: WaitingItem, context: RowContext) {
  if (item.kind !== "permission") return null;
  const { t, busy, onAct, now, goTo } = context;
  const { card, request } = item;
  return (
    <>
      <span className="activation-detail">
        {t("{{agent}} is running", { agent: card.recipient })}
        {timeLeftText(t, card.deadlineAt, now)}
      </span>
      <div className="activation-perm">
        <strong>{t("Allow {{tool}}?", { tool: request.toolName })}</strong>
        <code>{request.summary}</code>
        <span className="activation-detail">
          {t("Asked {{time}} ago", {
            time: timeText(t, now - Date.parse(request.createdAt))
          })}
          {" · "}
          {t("denied in {{time}} without an answer", {
            time: timeText(t, Date.parse(request.expiresAt) - now)
          })}
        </span>
        <div className="activation-actions">
          <Button
            variant="primary"
            disabled={busy}
            onClick={() =>
              onAct({
                kind: "permission",
                requestId: request.requestId,
                decision: "allow"
              })
            }
          >
            {t("Allow")}
          </Button>
          <Button
            variant="secondary"
            className="activation-danger"
            disabled={busy}
            onClick={() =>
              onAct({
                kind: "permission",
                requestId: request.requestId,
                decision: "deny"
              })
            }
          >
            {t("Deny")}
          </Button>
          <GoTo card={card} goTo={goTo} t={t} />
        </div>
      </div>
    </>
  );
}

function startRow(item: WaitingItem, context: RowContext) {
  if (item.kind !== "start") return null;
  const { t, busy, onAct, now, messages, goTo } = context;
  const { card } = item;
  const origin = holdOriginOf(card, messages);
  return (
    <>
      <strong>{t("Start {{agent}}?", { agent: card.recipient })}</strong>
      <span className="activation-detail">
        {joinParts([
          origin
            ? t("Mentioned by {{agent}}", { agent: origin.agentId })
            : t("Mentioned in the thread"),
          t(STAGE_NAME_KEYS[card.stage]),
          t("expires in {{time}}", {
            time: timeText(t, Date.parse(card.expiresAt) - now)
          })
        ])}
      </span>
      <div className="activation-actions">
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => onAct({ kind: "card", action: "approve", card })}
        >
          {t("Approve")}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => onAct({ kind: "card", action: "decline", card })}
        >
          {t("Decline")}
        </Button>
        <GoTo card={card} goTo={goTo} t={t} />
      </div>
    </>
  );
}

/** Dispatch table: the one action a failed row offers. A stopped row offers none. */
const FAILURE_ACTION: Partial<Record<WaitingKind, "continue" | "retry">> = {
  continue: "continue",
  retry: "retry"
};

/** The failed turn: its title by reason, its facts, and the one action the start rule accepts. */
function failureRow(item: WaitingItem, context: RowContext) {
  if (item.kind === "permission" || item.kind === "hold") return null;
  if (item.kind === "start" || item.kind === "running") return null;
  if (item.kind === "waiting") return null;
  const { t, busy, onAct, goTo, attemptCap } = context;
  const { card } = item;
  const action = FAILURE_ACTION[item.kind];
  return (
    <>
      <strong>
        {t(failureTitleKeyOf(card.reason), { agent: card.recipient })}
      </strong>
      <span className="activation-detail">
        {joinParts([
          card.turnMinutes === undefined
            ? null
            : t("Turn of {{minutes}} min", { minutes: card.turnMinutes }),
          attemptCap === undefined
            ? t("attempt {{attempt}}", { attempt: card.attempt })
            : t("attempt {{attempt}} of {{max}}", {
                attempt: card.attempt,
                max: attemptCap
              }),
          card.costUsd === undefined
            ? null
            : t("{{cost}} estimated", { cost: `$${card.costUsd.toFixed(3)}` })
        ])}
      </span>
      <div className="activation-actions">
        {action === undefined ? null : (
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => onAct({ kind: "card", action, card })}
          >
            {action === "continue" ? t("Continue") : t("Retry")}
          </Button>
        )}
        <GoTo card={card} goTo={goTo} t={t} />
      </div>
    </>
  );
}

/** Dispatch table: the title of a running row by its status. */
const RUNNING_TITLE: Record<"starting" | "running", string> = {
  starting: "{{agent}} is starting",
  running: "{{agent}} is running"
};

function runningRow(item: WaitingItem, context: RowContext) {
  if (item.kind !== "running") return null;
  const { t, now, goTo } = context;
  const { card } = item;
  const title =
    RUNNING_TITLE[card.status === "starting" ? "starting" : "running"];
  return (
    <>
      <strong>{t(title, { agent: card.recipient })}</strong>
      {card.deadlineAt === undefined ? null : (
        <span className="activation-detail">
          {t("{{time}} left", {
            time: timeText(t, Date.parse(card.deadlineAt) - now)
          })}
        </span>
      )}
      <div className="activation-actions">
        <GoTo card={card} goTo={goTo} t={t} />
      </div>
    </>
  );
}

function waitingRow(item: WaitingItem, context: RowContext) {
  if (item.kind !== "waiting") return null;
  const { t, goTo } = context;
  const { card } = item;
  const text = waitTextOf(card.reason);
  return (
    <>
      <strong>{t(text.title, { agent: card.recipient })}</strong>
      <span className="activation-detail">{t(text.detail)}</span>
      <div className="activation-actions">
        <GoTo card={card} goTo={goTo} t={t} />
      </div>
    </>
  );
}

function holdRow(item: WaitingItem, context: RowContext) {
  if (item.kind !== "hold") return null;
  return (
    <HoldRow
      hold={item.hold}
      messages={context.messages}
      goTo={context.goTo}
      t={context.t}
    />
  );
}

/** The go-to button of a row: the message that mentioned the recipient, as a marc:// reference. */
function GoTo({
  card,
  goTo,
  t
}: {
  card: ActivationSupervisionCard;
  goTo: (href: string) => void;
  t: Translate;
}) {
  return (
    <GoToButton
      reference={`marc://#${card.messageId}`}
      label={t("Go to the message")}
      onOpenLink={goTo}
    />
  );
}

/** A span of time as its text: "23 h" or "42 min", translated through its key. */
function timeText(t: Translate, ms: number): string {
  const duration = durationOf(ms);
  return t(duration.key, { count: duration.count });
}

/** " · 42 min left" when the turn has a deadline, nothing otherwise. */
function timeLeftText(
  t: Translate,
  deadlineAt: string | undefined,
  now: number
): string {
  if (deadlineAt === undefined) return "";
  return ` · ${t("{{time}} left", { time: timeText(t, Date.parse(deadlineAt) - now) })}`;
}

/** The non-empty parts of a line, joined with the middle dot the panel uses everywhere. */
function joinParts(parts: Array<string | null>): string {
  return parts.filter((part): part is string => part !== null).join(" · ");
}
