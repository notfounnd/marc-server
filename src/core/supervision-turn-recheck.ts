import { createHash } from "node:crypto";
import { canonicalJson } from "./activation-policy-hash.js";
import type {
  SupervisionRecord,
  SupervisionTurn
} from "./activation-supervision-types.js";

/**
 * The second pass before a supervised turn starts. The executor reads every fact inside the thread's
 * queue and passes them here, so the verdict is the one in force at the write. A turn that no longer
 * matches its approval is revoked. The card always states the reason as "revoked".
 */

/** A card that is still starting, under the run id the executor was given. */
export type StartingRun = SupervisionRecord & {
  runId: string;
  turn: SupervisionTurn;
};

export type RecheckFacts = {
  policyReady: boolean;
  cyclesAuthorized: boolean;
  paused: boolean;
  turnAuthorized: boolean;
  fingerprintMatches: boolean;
  ownerMatches: boolean;
  eligible: boolean;
};

export type RecheckVerdict = { status: "ok" } | { status: "revoked" };

type Rule = (facts: RecheckFacts) => boolean;

/** Every rule must hold. Each one is a fact of the approval that the second pass must still find. */
const RULES: readonly Rule[] = [
  (facts) => facts.policyReady,
  (facts) => facts.cyclesAuthorized,
  (facts) => !facts.paused,
  (facts) => facts.turnAuthorized,
  (facts) => facts.fingerprintMatches,
  (facts) => facts.ownerMatches,
  (facts) => facts.eligible
];

export function judgeRecheck(facts: RecheckFacts): RecheckVerdict {
  if (RULES.every((rule) => rule(facts))) return { status: "ok" };
  return { status: "revoked" };
}

/** True when the card is still the starting card of this run, with its launch block. */
export function isStartingRun(
  card: SupervisionRecord | undefined,
  runId: string | undefined
): card is StartingRun {
  if (card === undefined || runId === undefined) return false;
  return (
    card.status === "starting" &&
    card.runId === runId &&
    card.turn !== undefined
  );
}

/**
 * The fingerprint of the setting a turn runs under: the policy content, the cycles per stage and the
 * time limit. The approval stores it, and the second pass compares it with the value in force.
 */
export function turnFingerprintOf(input: {
  policy: unknown;
  cyclesPerStage: number;
  turnTimeoutMinutes: number;
}): string {
  return createHash("sha256")
    .update(canonicalJson(input), "utf8")
    .digest("hex");
}
