/**
 * The bounds of the supervised turn time limit, in whole minutes. This module has no Node import, so the
 * panel can read the same bounds the daemon checks. The rules that use them stay in
 * activation-turn-timeout.ts, which re-exports these names.
 */
export const DEFAULT_TURN_TIMEOUT_MINUTES = 60;
export const MIN_TURN_TIMEOUT_MINUTES = 15;
export const MAX_TURN_TIMEOUT_MINUTES = 480;

export function isTurnTimeoutMinutes(value: unknown): value is number {
  if (!Number.isInteger(value)) return false;
  return (
    (value as number) >= MIN_TURN_TIMEOUT_MINUTES &&
    (value as number) <= MAX_TURN_TIMEOUT_MINUTES
  );
}
