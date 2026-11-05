import { Button } from "./common.js";
import { STAGE_NAME_KEYS } from "./thread-activation-draft.js";
import { dropLineOf } from "./thread-activation-status.js";
import type { ActivationStageId, Translate } from "./types.js";

/**
 * The advance choice: the stages strictly ahead, as buttons, then Cancel. When reservations wait, the
 * choice says how many the new stage drops, because they never carry over.
 */
export function ActivationAdvanceChoice({
  choices,
  waiting,
  busy,
  onAdvance,
  onCancel,
  t
}: {
  choices: ActivationStageId[];
  waiting: number;
  busy: boolean;
  onAdvance: (to: ActivationStageId) => void;
  onCancel: () => void;
  t: Translate;
}) {
  const dropLine = dropLineOf(waiting);
  return (
    <div className="activation-advance">
      <strong className="activation-advance-title">{t("Advance to")}</strong>
      <div className="activation-actions">
        {choices.map((stage, index) => (
          <Button
            key={stage}
            variant={index === 0 ? "primary" : "secondary"}
            disabled={busy}
            onClick={() => onAdvance(stage)}
          >
            {t(STAGE_NAME_KEYS[stage])}
          </Button>
        ))}
        <Button
          variant="secondary"
          className="activation-quiet"
          onClick={onCancel}
        >
          {t("Cancel")}
        </Button>
      </div>
      {dropLine ? (
        <span className="activation-note">{t(dropLine, { waiting })}</span>
      ) : null}
    </div>
  );
}
