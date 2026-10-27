import type {
  CaptureFile,
  CapturedCase,
  CapturedChannels,
  CapturedRecord
} from "./capture-types.js";
import type { EvalCase } from "./dataset.js";
import { candidateFeaturesOf } from "./candidate-pairs.js";
import { admits, type ProcedureFit } from "./fit-model.js";
import type { ChoiceDecision } from "./choice-decision.js";
import { cheapScoresOf } from "./cheap.js";
import {
  cheapSemanticOnlyVectorOf,
  cheapVectorOf,
  type ThreadFeatures
} from "./features.js";
import { interpretationContribution, type Contribution } from "./metrics.js";
import { cachedReplayProviders, channelsOfCaptured } from "./replay.js";

/**
 * H3: the interpretation alternatives. A is the captured model (the LFM). B is
 * the rule: the first correction is applied, or suggested when it is a
 * suggestion-only index. C is B gated by cheap evidence. Each alternative maps a
 * captured case to an outcome, which is scored with interpretationContribution.
 */

export type SuggestionKind =
  | "model"
  | "rule"
  | "evidence"
  | "typedKev"
  | "typedLfm";

/** The two typed-choice models of H8 (D_KEV and D_LFM). Laya left the study. */
export type TypedModel = "kev" | "lfm";

/** Labels of the alternatives in the decision tables: A, B, C and the typed D alternatives. */
export const SUGGESTION_LABELS: Readonly<Record<SuggestionKind, string>> = {
  model: "A",
  rule: "B",
  evidence: "C",
  typedKev: "D_KEV",
  typedLfm: "D_LFM"
};

export type SuggestionOutcome = {
  effective: string;
  suggested: string | undefined;
};

export type SuggestionContext = {
  captured: CapturedCase;
  capture: CaptureFile;
  records: ReadonlyMap<string, CapturedRecord>;
  /** Cheap model used by the gate of C: the fold's cheap model on marc, the production one on the other corpora. */
  cheap: ProcedureFit;
  /** Decision of each typed model for this case; absent when the case has no correction. */
  typed: Partial<Record<TypedModel, ChoiceDecision>>;
};

export type SuggestionStrategy = (context: SuggestionContext) => Promise<SuggestionOutcome>;

/** Dispatch table of the three alternatives. */
export const SUGGESTION_STRATEGIES: Readonly<Record<SuggestionKind, SuggestionStrategy>> = {
  model: async ({ captured }) => ({
    effective: captured.interpretation.effectiveQuery,
    suggested: captured.interpretation.suggestedQuery
  }),
  rule: async (context) => ruleOutcome(context.captured),
  evidence: async (context) => {
    const passes = await cheapEvidenceAdmits(context);
    if (!passes) return noAction(context.captured);
    return ruleOutcome(context.captured);
  },
  typedKev: async (context) => typedOutcome(context.captured, context.typed.kev),
  typedLfm: async (context) => typedOutcome(context.captured, context.typed.lfm)
};

/**
 * D: the typed choice's decision. "apply" takes the correction, "suggest" shows it,
 * and "none" keeps the query. A case with a correction but no decision is an error:
 * the choice pass must have covered it.
 */
export function typedOutcome(
  captured: CapturedCase,
  decision: ChoiceDecision | undefined
): SuggestionOutcome {
  const variant = captured.candidates.variants[CORRECTION_INDEX];
  if (variant === undefined || variant === captured.originalQuery) return noAction(captured);
  if (decision === undefined) {
    throw new Error(`No typed choice decision for case ${captured.id}: run memory:eval choice first.`);
  }
  if (decision === "apply") return { effective: variant, suggested: undefined };
  if (decision === "suggest") return { effective: captured.originalQuery, suggested: variant };
  return noAction(captured);
}

/** Index of the first correction in the candidate variants. */
const CORRECTION_INDEX = 1;

/** Rule B: applied when the correction is not a suggestion-only index, suggested otherwise. */
export function ruleOutcome(captured: CapturedCase): SuggestionOutcome {
  const variant = captured.candidates.variants[CORRECTION_INDEX];
  if (variant === undefined) return noAction(captured);
  const suggestionOnly = captured.candidates.suggestionOnlyIndexes.includes(
    CORRECTION_INDEX
  );
  if (suggestionOnly) {
    return { effective: captured.originalQuery, suggested: variant };
  }
  return { effective: variant, suggested: undefined };
}

function noAction(captured: CapturedCase): SuggestionOutcome {
  return { effective: captured.originalQuery, suggested: undefined };
}

/**
 * Gate of C: at least one thread of the correction's cheap search is admitted by
 * the cheap model (semanticOnly >= low cut) and has cheap p >= high cut.
 */
export async function cheapEvidenceAdmits(context: SuggestionContext): Promise<boolean> {
  const variant = context.captured.candidates.variants[CORRECTION_INDEX];
  if (variant === undefined) return false;
  const channels = channelsOf(context.captured, variant);
  const providers = cachedReplayProviders(context.captured, context.capture);
  const features = await candidateFeaturesOf(
    variant,
    channelsOfCaptured(channels, context.records),
    providers.reranker
  );
  return cheapGateOpens(features, context.cheap);
}

/**
 * The gate of C on the features of the correction's search: at least one thread
 * is admitted by the cheap model (semanticOnly >= low cut) with cheap p >= high cut.
 */
export function cheapGateOpens(
  features: readonly ThreadFeatures[],
  cheap: ProcedureFit
): boolean {
  return features.some((item) => {
    const scores = cheapScoresOf(
      cheapVectorOf(item),
      cheapSemanticOnlyVectorOf(item),
      cheap
    );
    return scores.admitted && admits(scores.p, cheap.cuts.high);
  });
}

function channelsOf(captured: CapturedCase, text: string): CapturedChannels {
  const channels = captured.channels[text];
  if (channels === undefined) {
    throw new Error(`Capture case ${captured.id} has no channels for the correction "${text}".`);
  }
  return channels;
}

/** Counts of one alternative: num and den of each interpretation metric, summed over the cases. */
export type SuggestionTotals = Record<string, Contribution>;

export function addContributions(
  totals: SuggestionTotals,
  contribution: Record<string, Contribution>
): SuggestionTotals {
  return Object.fromEntries(
    Object.entries(contribution).map(([id, value]) => {
      const current = totals[id] ?? { num: 0, den: 0 };
      return [id, { num: current.num + value.num, den: current.den + value.den }];
    })
  );
}

/** Interpretation contribution of one outcome, for the cases that have an expected interpretation. */
export function outcomeContribution(
  captured: CapturedCase,
  outcome: SuggestionOutcome,
  expected: NonNullable<EvalCase["expectedInterpretation"]>
): Record<string, Contribution> {
  return interpretationContribution(
    {
      originalQuery: captured.originalQuery,
      interpretation: {
        effectiveQuery: outcome.effective,
        suggestedQuery: outcome.suggested
      }
    },
    expected
  );
}
