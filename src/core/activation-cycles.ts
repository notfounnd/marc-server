import { createHash } from "node:crypto";
import { canonicalJson } from "./activation-policy-hash.js";
import { isRecord } from "./activation-rules.js";

/**
 * Cycles per stage is a workspace setting in marc.config.json (activation.cyclesPerStage).
 * The file is only trusted through the authorization the daemon records when the human
 * saves the setting in the UI. A hash inside the JSON is not authorization.
 */
export const DEFAULT_CYCLES_PER_STAGE = 5;
export const MIN_CYCLES_PER_STAGE = 1;
export const MAX_CYCLES_PER_STAGE = 20;

export type CyclesAuthorization = {
  revision: string;
  cyclesPerStage: number;
  /** Content pin of the effective activation section, as cyclesContentHash computes it. */
  hash: string;
  at: string;
};

/** The activation section as the file holds it. Unreadable JSON is reported, never guessed. */
export type RawActivity =
  | { status: "readable"; activation: unknown }
  | { status: "unreadable" };

export type CyclesState =
  | { status: "authorized" | "tampered"; cyclesPerStage: number }
  | { status: "ledger_lost" | "ledger_invalid" };

export function isCyclesPerStage(value: unknown): value is number {
  if (!Number.isInteger(value)) return false;
  return (
    (value as number) >= MIN_CYCLES_PER_STAGE &&
    (value as number) <= MAX_CYCLES_PER_STAGE
  );
}

/** The content pin of the setting: the effective value, with the default applied when the key is absent. */
export function cyclesContentHash(cyclesPerStage: unknown): string {
  return createHash("sha256")
    .update(canonicalJson({ cyclesPerStage }), "utf8")
    .digest("hex");
}

/** Absent section or absent key means the default. Anything else is taken as written, so a hand edit changes the pin. */
export function effectiveCyclesOf(activation: unknown): unknown {
  if (activation === undefined) return DEFAULT_CYCLES_PER_STAGE;
  if (!isRecord(activation)) return activation;
  if (!("cyclesPerStage" in activation)) return DEFAULT_CYCLES_PER_STAGE;
  return activation.cyclesPerStage;
}

/**
 * Authorized when the effective content matches the recorded pin, or the default pin when
 * nothing was recorded. The authorized value is the recorded one, never the file's value.
 */
export function cyclesStateOf(
  raw: RawActivity,
  authorization: CyclesAuthorization | undefined
): { status: "authorized" | "tampered"; cyclesPerStage: number } {
  const cyclesPerStage =
    authorization?.cyclesPerStage ?? DEFAULT_CYCLES_PER_STAGE;
  const matches = matchesPin(raw, authorization);
  return { status: matches ? "authorized" : "tampered", cyclesPerStage };
}

/** The authorized value, or the default when the state is unknown. Only enabled threads consult it, and they require a readable state. */
export function cyclesValueOf(cycles: CyclesState): number {
  if ("cyclesPerStage" in cycles) return cycles.cyclesPerStage;
  return DEFAULT_CYCLES_PER_STAGE;
}

function matchesPin(
  raw: RawActivity,
  authorization: CyclesAuthorization | undefined
): boolean {
  if (raw.status === "unreadable") return false;
  const pin =
    authorization?.hash ?? cyclesContentHash(DEFAULT_CYCLES_PER_STAGE);
  return cyclesContentHash(effectiveCyclesOf(raw.activation)) === pin;
}
