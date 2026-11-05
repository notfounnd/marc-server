import { isCyclesPerStage } from "./activation-cycles.js";
import { isRecord } from "./activation-rules.js";
import { isTurnTimeoutMinutes } from "./activation-turn-timeout.js";

/** The activation keys a settings save may carry. An absent key means no change. */
export type ActivationSettingsInput = {
  cyclesPerStage?: number;
  turnTimeoutMinutes?: number;
};

/**
 * Parses the activation section of a settings save. Absent means no change. A present key must be
 * valid, or the whole section is invalid, so a save never writes a partial section.
 */
export function activationSettingsInputOf(
  activation: unknown
): ActivationSettingsInput | "invalid" | undefined {
  if (activation === undefined) return undefined;
  if (!isRecord(activation)) return "invalid";
  const { cyclesPerStage, turnTimeoutMinutes } = activation;
  if (!isAbsentOr(cyclesPerStage, isCyclesPerStage)) return "invalid";
  if (!isAbsentOr(turnTimeoutMinutes, isTurnTimeoutMinutes)) return "invalid";
  return presentKeysOf({ cyclesPerStage, turnTimeoutMinutes });
}

function isAbsentOr(
  value: unknown,
  check: (candidate: unknown) => boolean
): boolean {
  if (value === undefined) return true;
  return check(value);
}

/** Only the keys the save carries. Nothing present means nothing to change, so the result is undefined. */
function presentKeysOf(values: {
  cyclesPerStage: unknown;
  turnTimeoutMinutes: unknown;
}): ActivationSettingsInput | undefined {
  const input: ActivationSettingsInput = {
    ...(values.cyclesPerStage === undefined
      ? {}
      : { cyclesPerStage: values.cyclesPerStage as number }),
    ...(values.turnTimeoutMinutes === undefined
      ? {}
      : { turnTimeoutMinutes: values.turnTimeoutMinutes as number })
  };
  if (Object.keys(input).length === 0) return undefined;
  return input;
}
