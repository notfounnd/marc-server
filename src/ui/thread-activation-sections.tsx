import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "./common.js";
import { PanelEyebrow } from "./panel-primitives.js";
import { ActivationAdvanceChoice } from "./thread-activation-advance.js";
import { segmentsOf, STAGE_NAME_KEYS } from "./thread-activation-draft.js";
import {
  advanceChoicesOf,
  pillOf,
  stageLinesOf,
  statusNoteKeyOf,
  type Line
} from "./thread-activation-status.js";
import type {
  ActivationBudget,
  ActivationStageId,
  ThreadActivationView,
  Translate
} from "./types.js";

/** The saved state as a pill, and the switch with the note of the switch's position. */
export function ActivationStatusSection({
  view,
  enabled,
  onToggle,
  t
}: {
  view: ThreadActivationView;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  t: Translate;
}) {
  const pill = pillOf(view);
  const note = statusNoteKeyOf(enabled);
  return (
    <section className="popover-section activation-section">
      <div className="activation-status-row">
        <PanelEyebrow>{t("Status")}</PanelEyebrow>
        <Badge
          variant="neutral"
          className="activation-pill"
          data-tone={pill.tone}
        >
          {t(pill.key)}
        </Badge>
      </div>
      <label className="activation-switch">
        <span>{t("Allow mentions to activate participants")}</span>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </label>
      {note ? <span className="activation-note">{t(note)}</span> : null}
    </section>
  );
}

/** The fail-closed lines, then the recovery action when the state needs a repair. */
export function ActivationFaults({
  lines,
  recoverable,
  recoverNoteKey,
  busy,
  onRecover,
  t
}: {
  lines: Line[];
  recoverable: boolean;
  recoverNoteKey: string;
  busy: boolean;
  onRecover: () => void;
  t: Translate;
}) {
  const [confirming, setConfirming] = React.useState(false);
  if (lines.length === 0) return null;
  return (
    <section className="popover-section activation-section">
      {lines.map((line) => (
        <p className="activation-line" data-tone={line.tone} key={line.key}>
          {t(line.key)}
        </p>
      ))}
      {recoverable ? (
        <div className="activation-confirm">
          {confirming ? (
            <>
              <span className="activation-note">{t(recoverNoteKey)}</span>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  onRecover();
                }}
              >
                {t("Confirm recovery")}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                {t("Cancel")}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              {t("Recover")}
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** "N of M cycles", or the reason the counts are unknown. */
function cyclesTextOf(budget: ActivationBudget, t: Translate): string {
  if (budget.cyclesUsed === null) {
    return t("Cycles unknown until the thread state is readable.");
  }
  return t("{{used}} of {{max}} cycles", {
    used: budget.cyclesUsed,
    max: budget.max
  });
}

/**
 * The current stage as one badge, then the cycles and the segmented bar, the budget lines, and the
 * actions. Advance opens the choice of the stages ahead. The waits live in the waiting section.
 */
export function ActivationStageSection({
  view,
  budget,
  busy,
  onExtend,
  onAdvance,
  t
}: {
  view: ThreadActivationView;
  budget: ActivationBudget;
  busy: boolean;
  onExtend: () => void;
  onAdvance: (to: ActivationStageId) => void;
  t: Translate;
}) {
  const [choosing, setChoosing] = React.useState(false);
  const cycles = cyclesTextOf(budget, t);
  const exhausted = budget.warnings.includes("budget_exhausted");
  const choices = advanceChoicesOf(view);
  const waiting = view.holds ?? [];
  return (
    <section className="popover-section activation-section">
      <div className="activation-stage-head">
        <PanelEyebrow>{t("Stage")}</PanelEyebrow>
        <span className="activation-stage-label">
          {t(STAGE_NAME_KEYS[budget.currentStage])}
        </span>
      </div>
      <span className="activation-cycles">{cycles}</span>
      <div
        className="activation-bar"
        data-exhausted={exhausted}
        role="img"
        aria-label={cycles}
      >
        {segmentsOf(budget).map((used, index) => (
          <i key={index} data-used={used} />
        ))}
      </div>
      {stageLinesOf(view).map((line) => (
        <p className="activation-line" data-tone={line.tone} key={line.key}>
          {t(line.key)}
        </p>
      ))}
      {choosing ? (
        <ActivationAdvanceChoice
          choices={choices}
          waiting={waiting.length}
          busy={busy}
          t={t}
          onAdvance={(to) => {
            setChoosing(false);
            onAdvance(to);
          }}
          onCancel={() => setChoosing(false)}
        />
      ) : null}
      {choosing ? null : (
        <div className="activation-actions">
          {exhausted ? (
            <Button variant="primary" disabled={busy} onClick={onExtend}>
              {t("More {{cycles}} cycles", { cycles: budget.cyclesPerStage })}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            disabled={busy || choices.length === 0}
            title={
              choices.length === 0 ? t("Review is the last stage.") : undefined
            }
            onClick={() => setChoosing(true)}
          >
            {t("Advance stage")}
          </Button>
        </div>
      )}
    </section>
  );
}
