import { isRecord } from "./activation-rules.js";

/**
 * A policy written by F3a (version 1), with its own stage list. It is read so the thread
 * does not fail, but it never authorizes anything: an enabled one reads as policy_outdated
 * until the human saves it again. Nothing here writes. The save normalizes the file in the
 * thread's queue, and legacy counters stay as history.
 */
export type LegacyPolicy = { version: 1; enabled: boolean };

export function isLegacyPolicy(value: unknown): value is LegacyPolicy {
  return (
    isRecord(value) && value.version === 1 && typeof value.enabled === "boolean"
  );
}
