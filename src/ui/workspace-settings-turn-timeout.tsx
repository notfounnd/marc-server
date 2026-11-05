import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isTurnTimeoutMinutes,
  MAX_TURN_TIMEOUT_MINUTES,
  MIN_TURN_TIMEOUT_MINUTES
} from "../core/activation-turn-timeout-limits.js";
import type { Translate } from "./types.js";

/** The turn time limit as the workspace memory actions hand it over: the value in force, and the save. */
export type WorkspaceTurnTimeout = {
  value: number | undefined;
  save: (minutes: number) => Promise<void>;
};

/**
 * The supervised turn time limit, a row beside the cycles setting. It saves when the field loses focus or
 * Enter is pressed, and only when the value changed and passes the daemon's own bounds. The daemon records
 * the authorization on that save, so a value edited by hand stays unauthorized until it is saved here.
 */
export function TurnTimeoutField({
  turnTimeoutMinutes,
  onSave,
  t
}: {
  turnTimeoutMinutes: number;
  onSave: (minutes: number) => Promise<void>;
  t: Translate;
}) {
  const [value, setValue] = React.useState(String(turnTimeoutMinutes));
  const [error, setError] = React.useState<string | undefined>();
  const inFlight = React.useRef<number | undefined>();

  React.useEffect(() => {
    setValue(String(turnTimeoutMinutes));
  }, [turnTimeoutMinutes]);

  function commit(): void {
    const minutes = Number(value);
    if (!isTurnTimeoutMinutes(minutes)) {
      setError(
        t("Enter a whole number from {{min}} to {{max}}.", {
          min: MIN_TURN_TIMEOUT_MINUTES,
          max: MAX_TURN_TIMEOUT_MINUTES
        })
      );
      setValue(String(turnTimeoutMinutes));
      return;
    }
    setError(undefined);
    if (minutes === turnTimeoutMinutes || minutes === inFlight.current) return;
    inFlight.current = minutes;
    void onSave(minutes)
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : String(failure));
      })
      .finally(() => {
        inFlight.current = undefined;
      });
  }

  return (
    <>
      <div className="workspace-settings-cycles-row">
        <div className="workspace-settings-cycles-text">
          <Label htmlFor="workspace-activation-turn-timeout">
            {t("Supervised turn time limit (minutes)")}
          </Label>
          <small>
            {t(
              "A turn the daemon starts is warned in its last 10 minutes and stopped 2 minutes after the limit. Sessions you open yourself are never stopped. Between {{min}} and {{max}}.",
              { min: MIN_TURN_TIMEOUT_MINUTES, max: MAX_TURN_TIMEOUT_MINUTES }
            )}
          </small>
        </div>
        <Input
          id="workspace-activation-turn-timeout"
          className="workspace-settings-cycles-input"
          type="number"
          min={MIN_TURN_TIMEOUT_MINUTES}
          max={MAX_TURN_TIMEOUT_MINUTES}
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
