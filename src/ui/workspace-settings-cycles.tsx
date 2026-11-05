import * as React from "react";
import { Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Translate } from "./types.js";

export const CYCLES_MIN = 1;
export const CYCLES_MAX = 20;

/** The cycles setting as the workspace memory actions hand it over: the value in force, and the save. */
export type WorkspaceCycles = {
  value: number | undefined;
  save: (cycles: number) => Promise<void>;
};

/** A whole number from 1 to 20. Anything else is refused before it reaches the daemon. */
export function isCyclesValue(value: number): boolean {
  return Number.isInteger(value) && value >= CYCLES_MIN && value <= CYCLES_MAX;
}

/**
 * The activation section of the workspace settings, shaped like the memory rows. It saves when the
 * field loses focus or Enter is pressed, and only when the value changed and passes the 1 to 20 check,
 * the same way the batch size saves on commit. The daemon records the authorization on that save.
 */
export function CyclesPerStageField({
  cyclesPerStage,
  onSave,
  t
}: {
  cyclesPerStage: number;
  onSave: (cycles: number) => Promise<void>;
  t: Translate;
}) {
  const [value, setValue] = React.useState(String(cyclesPerStage));
  const [error, setError] = React.useState<string | undefined>();
  const inFlight = React.useRef<number | undefined>();

  React.useEffect(() => {
    setValue(String(cyclesPerStage));
  }, [cyclesPerStage]);

  function commit(): void {
    const cycles = Number(value);
    if (!isCyclesValue(cycles)) {
      setError(t("Enter a whole number from 1 to 20."));
      setValue(String(cyclesPerStage));
      return;
    }
    setError(undefined);
    if (cycles === cyclesPerStage || cycles === inFlight.current) return;
    inFlight.current = cycles;
    void onSave(cycles)
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : String(failure));
      })
      .finally(() => {
        inFlight.current = undefined;
      });
  }

  return (
    <>
      <div className="workspace-settings-head">
        <Zap size={14} />
        <span>{t("Activation")}</span>
      </div>
      <div className="workspace-settings-cycles-row">
        <div className="workspace-settings-cycles-text">
          <Label htmlFor="workspace-activation-cycles">
            {t("Cycles per stage")}
          </Label>
          <small>
            {t(
              "How many architect round trips a stage may use before mARC asks you."
            )}
          </small>
        </div>
        <Input
          id="workspace-activation-cycles"
          className="workspace-settings-cycles-input"
          type="number"
          min={CYCLES_MIN}
          max={CYCLES_MAX}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
        />
      </div>
      {error ? (
        <small className="workspace-settings-error" role="alert">
          {error}
        </small>
      ) : null}
    </>
  );
}
