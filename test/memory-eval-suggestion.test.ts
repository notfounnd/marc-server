import assert from "node:assert/strict";
import test from "node:test";
import type { CapturedCase } from "../scripts/memory-eval/capture-types.js";
import type { ProcedureFit } from "../scripts/memory-eval/fit-model.js";
import {
  addContributions,
  cheapGateOpens,
  outcomeContribution,
  ruleOutcome,
  type SuggestionOutcome
} from "../scripts/memory-eval/suggestion.js";
import { type ThreadFeatures } from "../src/core/memory/scoring/features.js";

/** A captured case with the candidate variants and the suggestion-only indexes declared. */
function capturedOf(
  variants: string[],
  suggestionOnlyIndexes: number[]
): CapturedCase {
  return {
    id: "C1",
    queryMode: "auto",
    originalQuery: variants[0] ?? "",
    interpretation: {
      originalQuery: variants[0] ?? "",
      effectiveQuery: variants[0] ?? "",
      mode: "auto",
      correctionApplied: false
    },
    candidates: { variants, suggestionOnlyIndexes },
    interpretationTrace: [],
    queryVectors: {},
    channels: {},
    rerankScores: {},
    productionRecall: {
      effectiveQuery: variants[0] ?? "",
      limit: 5,
      results: []
    }
  };
}

test("rule B applies the first correction when it is not suggestion-only", () => {
  const outcome = ruleOutcome(capturedOf(["settngs", "settings"], []));
  assert.deepEqual(outcome, { effective: "settings", suggested: undefined });
});

test("rule B only suggests the first correction when it is suggestion-only", () => {
  const outcome = ruleOutcome(capturedOf(["settngs", "settings"], [1]));
  assert.deepEqual(outcome, { effective: "settngs", suggested: "settings" });
});

test("rule B takes no action without a first correction", () => {
  const outcome = ruleOutcome(capturedOf(["settngs"], []));
  assert.deepEqual(outcome, { effective: "settngs", suggested: undefined });
});

const CHEAP: ProcedureFit = {
  lambda: 0.1,
  lambdaAtLowerEdge: false,
  intercept: -4,
  weights: [6, 6, 6, 6],
  cuts: { high: 0.9, medium: 0.6, low: 0.3 },
  innerLogLoss: {},
  convergence: {
    iterations: 2000,
    projectedGradientNorm: 0,
    lossChangeLastWindow: 0,
    lossRangeLastWindow: 0
  }
};

function thread(
  threadId: string,
  identity: number,
  passage: number,
  title = 0,
  content = 0
): ThreadFeatures {
  return {
    threadId,
    identityCosine: identity,
    bestPassageCosine: passage,
    bestRerankerScore: 0,
    secondRerankerScore: 0,
    identityRerankerScore: 0,
    lexicalTitleMatch: title,
    lexicalContentMatch: content
  };
}

test("the gate of C opens only for a thread admitted by the cheap model with p at the high cut", () => {
  // Strong: semanticOnly = sigmoid(-4 + 6 * 0.95 * 2) is about 0.999, so it is admitted and p is at the high cut.
  const strong = thread("S", 0.95, 0.95);
  const weak = thread("W", 0.2, 0.2);
  assert.equal(cheapGateOpens([strong], CHEAP), true);
  assert.equal(cheapGateOpens([weak], CHEAP), false);
  assert.equal(cheapGateOpens([], CHEAP), false);
});

test("the gate of C stays closed when the high cut is unreachable, even for a strong thread", () => {
  const unreachable: ProcedureFit = {
    ...CHEAP,
    cuts: { high: null, medium: 0.6, low: 0.3 }
  };
  assert.equal(cheapGateOpens([thread("S", 0.95, 0.95)], unreachable), false);
});

test("the gate of C ignores lexical evidence, which the cheap semanticOnly leaves out", () => {
  // The lexical thread has a high p (its lexical weights are 6) but a semanticOnly of about 0.06, below the low cut.
  const lexicalThread = thread("L", 0.1, 0.1, 1, 1);
  assert.equal(cheapGateOpens([lexicalThread], CHEAP), false);
});

test("outcome contributions score the effective and suggested queries against the expected ones", () => {
  const captured = capturedOf(["settngs", "settings"], []);
  const expected = { effectiveQuery: "settings" };
  const corrected: SuggestionOutcome = {
    effective: "settings",
    suggested: undefined
  };
  const contribution = outcomeContribution(captured, corrected, expected);
  assert.deepEqual(contribution.correctionCorrect, { num: 1, den: 1 });
  assert.deepEqual(contribution.correctionUndue, { num: 0, den: 0 });
  assert.deepEqual(contribution.suggestionUndue, { num: 0, den: 1 });
  const untouched: SuggestionOutcome = {
    effective: "settngs",
    suggested: undefined
  };
  const missed = outcomeContribution(captured, untouched, expected);
  assert.deepEqual(missed.correctionCorrect, { num: 0, den: 1 });
});

test("counts add up per metric across the cases", () => {
  const first = {
    correctionCorrect: { num: 1, den: 1 },
    suggestionUndue: { num: 0, den: 1 }
  };
  const second = {
    correctionCorrect: { num: 0, den: 1 },
    suggestionUndue: { num: 1, den: 1 }
  };
  const totals = addContributions(addContributions({}, first), second);
  assert.deepEqual(totals.correctionCorrect, { num: 1, den: 2 });
  assert.deepEqual(totals.suggestionUndue, { num: 1, den: 2 });
});
