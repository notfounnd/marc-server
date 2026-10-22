import type { CaptureFile, CapturedCase, CapturedRecord } from "./capture-types.js";
import type { EvalDataset } from "./dataset.js";
import type { ProcedureFit } from "./fit-model.js";
import { recordsById } from "./replay.js";
import type { ChoiceDecision } from "./choice-decision.js";
import {
  addContributions,
  outcomeContribution,
  SUGGESTION_LABELS,
  SUGGESTION_STRATEGIES,
  type SuggestionKind,
  type SuggestionOutcome,
  type SuggestionTotals,
  type TypedModel
} from "./suggestion.js";

/** Name of the H3 file, in the capture directory. */
export function suggestionFileName(corpus: string): string {
  return `h3-${corpus}.json`;
}

export type SuggestionCase = {
  caseId: string;
  outcomes: Record<SuggestionKind, SuggestionOutcome>;
};

/** Counts of the actions of one alternative, by style of the case. */
export type StyleActions = Record<string, { cases: number; applied: number; suggested: number }>;

/** Content of h3-<corpus>.json: the totals of each alternative, and each case's outcome. */
export type SuggestionFile = {
  schemaVersion: 1;
  corpus: string;
  captureId: string;
  modelCaptureId: string;
  /** Every case of the capture: the universe of the decisive counters (H3 and H8). */
  cases: number;
  alternatives: Partial<Record<SuggestionKind, { label: string; totals: SuggestionTotals }>>;
  perCase: SuggestionCase[];
  /**
   * Breakdown by style, not part of the criteria: on the cases WITHOUT an expected
   * interpretation, how many of them the alternative applies or suggests a correction
   * for. The totals above count those cases too, against "keep the query as typed".
   */
  unlabelledActions: Partial<Record<SuggestionKind, StyleActions>>;
};

/**
 * H3 over every case of the capture. A case with an expected interpretation is scored
 * against it. A case without one is scored against "keep the query as typed": a
 * correction it applies counts as correctionUndue, and a suggestion it shows counts as
 * suggestionUndue, in every alternative. `cheapOf` gives the cheap model of each case.
 */
export async function suggestionFileOf(input: {
  capture: CaptureFile;
  dataset: EvalDataset;
  corpus: string;
  modelCaptureId: string;
  cheapOf: (caseId: string) => ProcedureFit;
  /** Decisions of the typed choice (H8) by model and case. A model without decisions is left out. */
  typedDecisions?: Partial<Record<TypedModel, ReadonlyMap<string, ChoiceDecision>>>;
}): Promise<SuggestionFile> {
  const records: ReadonlyMap<string, CapturedRecord> = recordsById(input.capture.records);
  const kinds = (Object.keys(SUGGESTION_STRATEGIES) as SuggestionKind[]).filter(
    (kind) => isAvailable(kind, input.typedDecisions)
  );
  const totals = Object.fromEntries(kinds.map((kind) => [kind, {} as SuggestionTotals])) as Record<SuggestionKind, SuggestionTotals>;
  const unlabelledActions: Partial<Record<SuggestionKind, StyleActions>> = {};
  for (const kind of kinds) unlabelledActions[kind] = {};
  const perCase: SuggestionCase[] = [];
  for (const captured of input.capture.cases) {
    const expected = expectationOf(input.dataset, captured);
    const style = styleOf(input.dataset, captured.id);
    const context = {
      captured,
      capture: input.capture,
      records,
      cheap: input.cheapOf(captured.id),
      typed: typedOf(input.typedDecisions, captured.id)
    };
    const outcomes = {} as Record<SuggestionKind, SuggestionOutcome>;
    for (const kind of kinds) {
      const outcome = await SUGGESTION_STRATEGIES[kind](context);
      outcomes[kind] = outcome;
      totals[kind] = addContributions(totals[kind], outcomeContribution(captured, outcome, expected));
      if (isLabelled(input.dataset, captured.id)) continue;
      unlabelledActions[kind] = addActionOf(unlabelledActions[kind] ?? {}, style, outcome, captured.originalQuery);
    }
    perCase.push({ caseId: captured.id, outcomes });
  }
  return {
    schemaVersion: 1,
    corpus: input.corpus,
    captureId: input.capture.captureId,
    modelCaptureId: input.modelCaptureId,
    cases: input.capture.cases.length,
    alternatives: Object.fromEntries(
      kinds.map((kind) => [kind, { label: SUGGESTION_LABELS[kind], totals: totals[kind] }])
    ) as SuggestionFile["alternatives"],
    perCase,
    unlabelledActions
  };
}

function evalCaseOf(dataset: EvalDataset, caseId: string) {
  return dataset.cases.find((item) => item.id === caseId);
}

function isLabelled(dataset: EvalDataset, caseId: string): boolean {
  return evalCaseOf(dataset, caseId)?.expectedInterpretation !== undefined;
}

/**
 * The expected interpretation of a case, or "keep the query as typed" when it has none.
 * A typo case must have an expected interpretation: the dataset validation requires it,
 * and a missing one here is an explicit error, not a silent keep.
 */
export function expectationOf(
  dataset: EvalDataset,
  captured: CapturedCase
): { effectiveQuery: string; suggestedQuery?: string } {
  const evalCase = evalCaseOf(dataset, captured.id);
  const expected = evalCase?.expectedInterpretation;
  if (expected !== undefined) return expected;
  if (evalCase?.style === "typo") {
    throw new Error(
      `Case ${captured.id} has style typo without expectedInterpretation; the dataset must give one.`
    );
  }
  return { effectiveQuery: captured.originalQuery };
}

function styleOf(dataset: EvalDataset, caseId: string): string {
  return evalCaseOf(dataset, caseId)?.style ?? "unknown";
}

/**
 * One case added to the counts of an alternative: applied when the effective query
 * differs from the original, suggested when a suggestion is shown.
 */
export function addActionOf(
  counts: StyleActions,
  style: string,
  outcome: SuggestionOutcome,
  originalQuery: string
): StyleActions {
  const current = counts[style] ?? { cases: 0, applied: 0, suggested: 0 };
  return {
    ...counts,
    [style]: {
      cases: current.cases + 1,
      applied: current.applied + (outcome.effective === originalQuery ? 0 : 1),
      suggested: current.suggested + (outcome.suggested === undefined ? 0 : 1)
    }
  };
}

/** A typed alternative runs only when its decisions are given; A, B and C always run. */
function isAvailable(
  kind: SuggestionKind,
  typedDecisions: Partial<Record<TypedModel, ReadonlyMap<string, ChoiceDecision>>> | undefined
): boolean {
  if (kind === "typedKev") return typedDecisions?.kev !== undefined;
  if (kind === "typedLfm") return typedDecisions?.lfm !== undefined;
  return true;
}

function typedOf(
  typedDecisions: Partial<Record<TypedModel, ReadonlyMap<string, ChoiceDecision>>> | undefined,
  caseId: string
): Partial<Record<TypedModel, ChoiceDecision>> {
  const kev = typedDecisions?.kev?.get(caseId);
  const lfm = typedDecisions?.lfm?.get(caseId);
  return {
    ...(kev === undefined ? {} : { kev }),
    ...(lfm === undefined ? {} : { lfm })
  };
}

/** Text table of the totals: num/den of each metric for each alternative. */
export function suggestionTableLines(file: SuggestionFile): string[] {
  const entries = (Object.keys(file.alternatives) as SuggestionKind[]).flatMap((kind) => {
    const entry = file.alternatives[kind];
    return entry === undefined ? [] : [entry];
  });
  const metrics = Object.keys(entries[0]?.totals ?? {});
  const header = `alternative ${metrics.join(" ")}`;
  const rows = entries.map((entry) => {
    const cells = metrics.map((metric) => {
      const total = entry.totals[metric] ?? { num: 0, den: 0 };
      return `${metric}=${total.num}/${total.den}`;
    });
    return `${entry.label} ${cells.join(" ")}`;
  });
  return [`cases=${file.cases}`, header, ...rows, ...unlabelledLinesOf(file)];
}

/** Breakdown lines: the actions on the cases without an expected interpretation, by style. */
function unlabelledLinesOf(file: SuggestionFile): string[] {
  return (Object.keys(file.unlabelledActions) as SuggestionKind[]).flatMap((kind) =>
    Object.entries(file.unlabelledActions[kind] ?? {}).map(
      ([style, counts]) =>
        `${SUGGESTION_LABELS[kind]} unlabelled ${style}: applied=${counts.applied}/${counts.cases} suggested=${counts.suggested}/${counts.cases}`
    )
  );
}
