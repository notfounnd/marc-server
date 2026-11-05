import * as React from "react";
import { PanelEyebrow } from "./panel-primitives.js";
import {
  RENDERERS,
  type RowContext,
  type WaitingAct
} from "./thread-activation-waiting-rows.js";
import {
  waitingCountOf,
  waitingItemsOf,
  type WaitingKind
} from "./thread-activation-waiting-model.js";
import type { Message, ThreadActivationView, Translate } from "./types.js";

export type { WaitingAct } from "./thread-activation-waiting-rows.js";

export type WaitingProps = {
  view: ThreadActivationView;
  messages: Message[];
  busy: boolean;
  goTo: (href: string) => void;
  onAct: (act: WaitingAct) => void;
  t: Translate;
};

/**
 * The waiting section: the starts to approve, the permission requests, the failed turns with their
 * action, the running turns, and the waits and holds that need nothing. It mounts only with a row.
 */
export function ActivationWaitingSection({
  view,
  messages,
  busy,
  goTo,
  onAct,
  t
}: WaitingProps) {
  const items = waitingItemsOf(view);
  if (items.length === 0) return null;
  const count = waitingCountOf(view);
  const context: RowContext = {
    messages,
    busy,
    goTo,
    onAct,
    t,
    now: Date.now(),
    attemptCap: view.policy?.attemptCap
  };
  return (
    <section className="popover-section activation-section">
      <div className="activation-stage-head">
        <PanelEyebrow>{t("Waiting for you")}</PanelEyebrow>
        {count > 0 ? <span className="activation-count">{count}</span> : null}
      </div>
      <ul className="panel-list">
        {items.map((item) => (
          <li
            className="activation-card"
            data-tone={TONE_OF[item.kind]}
            key={item.key}
          >
            {RENDERERS[item.kind](item, context)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Dispatch table: the tone of a row, which the stylesheet colors. */
const TONE_OF: Record<WaitingKind, string> = {
  start: "start",
  permission: "run",
  continue: "fail",
  retry: "fail",
  stopped: "fail",
  running: "run",
  waiting: "info",
  hold: "info"
};
