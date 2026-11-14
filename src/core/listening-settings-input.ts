import { isRecord } from "./activation-rules.js";

/** The listening key a settings save may carry. An absent key means no change. */
export type ListeningSettingsInput = { defaultOn?: boolean };

/**
 * Parses the listening section of a settings save. Absent means no change. A present section must be an
 * object, and a present defaultOn must be a boolean, or the whole section is invalid.
 */
export function listeningSettingsInputOf(
  listening: unknown
): ListeningSettingsInput | "invalid" | undefined {
  if (listening === undefined) return undefined;
  if (!isRecord(listening)) return "invalid";
  if (listening.defaultOn === undefined) return {};
  if (typeof listening.defaultOn !== "boolean") return "invalid";
  return { defaultOn: listening.defaultOn };
}
