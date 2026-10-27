import { labelOf } from "./fit.js";
import { BAND_TARGETS, bandOf, type BandCuts } from "./fit-model.js";
import { caseFolds } from "./folds.js";
import {
  DOCUMENT_GROUP_PREFIX,
  RULES_GROUP,
  effectiveJudgments,
  type EvalCase,
  type EvalDataset
} from "./dataset.js";
import type { AuditManifest } from "./audit-sample.js";
import type { CaptureFile, CapturedCase, CapturedRecord } from "./capture-types.js";
import type { EvidenceMatch } from "./matrix-plan.js";
import { presentLayersOf, requiredLayersOf, saturatedOf } from "./required-cells.js";
import { funnelConfigOf, type FunnelVariantName } from "./funnel-variants.js";
import {
  caseInputsFor,
  decisionRowsOf,
  evaluateVariant,
  withCommonReference,
  type MetricComparison
} from "./evaluation.js";
import { caseContribution, pendingPairs, type CaseInput } from "./metrics.js";
import { replayCapture, funnelInputOf, type ReplayResult } from "./replay.js";
import {
  T2_DEPTHS,
  T2_K_GRID,
  chooseK,
  cutsOf,
  ratioIntervalOf,
  survivedOf,
  type CaseTrials,
  type CutPair,
  type DepthTrials,
  type KChoice
} from "./t2-decision.js";
import type { FunnelVariantInput, VariantResult } from "./variants.js";
import {
  runFunnel,
  type FunnelStepSummary,
  type FunnelStop
} from "../../src/core/memory/funnel-run.js";
import { MissingRerankScore } from "../../src/core/memory/funnel-admission.js";
import { groupsOf } from "../../src/core/memory/funnel-groups.js";
import type { MemorySearchDepth } from "../../src/core/memory/types.js";
import {
  PROPORTION_MARGIN,
  decisionTerm,
  pairedBootstrap,
  type FamilySums,
  type Interval
} from "./statistics.js";

/** The budget of the funnel of the E3 (plan section 4). */
export const T2_BUDGET = 232;
/** The selection mode of the funnel in the default T2 run. */
export const T2_MODE = "cosine" as const;
export type T2Mode = "cosine" | "cosine-fts";
/** The variants that every per-fold replay runs. */
export const T2_VARIANTS = [
  "DEPTH0",
  "DEPTH2",
  "FUNNEL_D2",
  "ALL_PASSAGES_D2",
  "ALL_CANDIDATES_D2",
  "ADAPTIVE",
  "ADAPTIVE_HM"
] as const;

/** The margin of the H4 recall, −0,02 (the difference of recall between the funnel and all candidates). */
const H4_RECALL_MARGIN = 0.02;
/** The exploratory K values above the grid; the largest candidate count of the corpus is added to them. */
const CURVE_KS: readonly number[] = [40, 50, 60];
/** Budget per K of the exploratory curve: 3K ≤ ⌊B / 2⌋ holds with B = 6K. */
const CURVE_BUDGET_FACTOR = 6;
/** The stop bands of the adaptive walk: the band whose admitted result triggers the stop of each reason. */
const TRIGGER_BAND: Partial<Record<FunnelStop, "high" | "medium">> = {
  "high-band": "high",
  "medium-band": "medium"
};

export type T2Input = {
  corpus: string;
  capture: CaptureFile;
  dataset: EvalDataset;
  vectors: ReadonlyMap<string, number[]>;
  /** The evidence matches of each case, read from the case files of the capture. */
  evidence: ReadonlyMap<string, readonly EvidenceMatch[]>;
  /** The audit manifest of the capture: the sampled pairs and the externals. */
  audit: AuditManifest;
  /** The selection mode of the funnel: the default run is cosine; the second run is cosine-fts. */
  mode?: T2Mode;
  /** K of each fold taken from the cosine run (with its own rule flag), for the cosine-fts run with the same K. */
  kOverride?: ReadonlyMap<number, KChoice>;
  /** Whether to compute the exploratory recall curve above the grid (the default run does). */
  curve?: boolean;
};

/** One row of a decision table, with its interval and verdict. */
export type T2Row = {
  hypothesis: string;
  criterion: string;
  /** The metric of the row. Its verdict reads a higher value as better, except the metrics of LOWER_IS_BETTER. */
  metric: string;
  scope: string;
  baseline: string;
  candidate: string;
  value: number | null;
  lower: number | null;
  upper: number | null;
  margin: number;
  term: string | null;
  nonInferior: boolean | null;
};

/** The pending reference cells of one comparison: informative, they never block the comparison. */
export type ReferencePending = {
  hypothesis: string;
  baseline: string;
  candidate: string;
  /** Whether the own completeness of either variant fails (the reference cells are not part of it). */
  blocked: boolean;
  pending: number;
  cells: Array<{ caseId: string; threadId: string; layer: number | null }>;
};

/** The diagnostic of one band cut on the training folds of its fold. */
export type CutAudit = {
  fold: number;
  band: "high" | "medium";
  cut: number | null;
  target: number;
  /** Training pairs whose score reaches the cut, and how many of them are positive. */
  trainingAbove: number;
  trainingPositives: number;
  precision: number | null;
};

export type T2Report = {
  corpus: string;
  budget: number;
  mode: T2Mode;
  kByFold: Record<number, KChoice>;
  cutsByFold: Record<number, BandCuts>;
  cutAudit: CutAudit[];
  production: { k: KChoice; cuts: BandCuts };
  decisions: T2Row[];
  survival: { population: number; survived: number; value: number | null; lower: number | null; upper: number | null };
  /** Layer and adaptive-trap cases whose evidence has no indexed passageId: they stay incomplete and are reported. */
  incompleteEvidence: string[];
  evidenceLosses: Array<{ caseId: string; groupId: string; passages: number; funnelRank: number | null; allPassagesRank: number | null }>;
  traps: { stoppedBeforeEvidence: number; adaptiveTrapCases: number; cases: TrapCase[]; top: Record<string, { top1: number; top3: number; cases: number }> };
  adaptiveDeterminism: { cases: number; divergences: number };
  admissionByGroupKind: Record<string, Record<string, number>>;
  auditPool: { sampledPairs: number; externals: number; findings: number; medianExternals: number | null };
  diagnostics: Record<string, Record<string, number | null>>;
  /** The coverage of each variant on the joined replay: its status, its pending cells, its incomplete cases. */
  coverage: Record<string, { status: string; pending: number; incompleteCases: number }>;
  commonReferencePending: ReferencePending[];
  /** The faixas of ADAPTIVE against DEPTH0, with the fold cuts, and the recuo 1 with per-depth cuts. */
  bands: BandsReport;
  /** The relevant groups with a layer gap: a layer up to depth 2 that nobody judged. */
  layerGaps: { cases: number; relevantGroups: number; groupsWithGap: number; ungradedCells: number };
  /** The relevant candidates that the K of each fold did not keep, per depth, with their fusion and dense ranks. */
  lostRelevant: LostRelevant[];
  /** The recall per depth at the K of each fold. */
  recallByDepth: Record<number, number | null>;
  /** The exploratory recall curve above the grid: K, the budget that K requires, and the recall per depth. */
  curveAboveGrid: Array<{
    k: number;
    requiredBudget: number;
    recallByDepth: Record<number, number | null>;
    /** Cases whose run needs a pair that the capture matrix does not hold, per depth: they are left out, and counted. */
    incompleteCases: Record<number, number>;
  }>;
};

export type TrapCase = {
  caseId: string;
  stoppedAt: number;
  evidenceLayer: number | undefined;
  /** The admitted result that stopped the walk: its group, grade (effective at the stop depth), score and band. */
  trigger: { groupId: string; grade: number; score: number; band: "high" | "medium" } | null;
  stoppedBeforeEvidence: boolean;
};

export type LostRelevant = { caseId: string; groupId: string; depth: number; grade: number; fusionRank: number | null; denseRank: number | null };

export type BandsReport = {
  /** The precision of ADAPTIVE's high band against DEPTH0's admitted precision, per case, with the fold cuts. */
  rows: T2Row[];
  /** The recuo 1: the same results re-banded with the per-depth cuts of each fold (the search is not redone). */
  recuoRows: T2Row[];
  /** The results that land in the high band, per variant, over the corpus. */
  highBandCounts: Record<string, number>;
  /** Whether a fold's high cut sits at the top of the score range (≥ 0,9999): the high band admits only the tip. */
  highCutDegenerate: boolean;
  /** The per-depth cuts of each fold (recuo 1): the cuts that re-band the results of each judged depth. */
  cutTables: Array<{ fold: number; depth: number; high: number | null; medium: number | null }>;
};

/**
 * The T2 of the E3: K and the fallback cuts chosen on the training folds, per-fold replays with those
 * parameters, the decision rows on the common reference, the evidence survival by passageId, the faixas,
 * the layer gaps, the traps, the losses of relevant groups, the cut audit and the audit pool. The production
 * rule (every fold) runs beside them and is not a confirmation.
 */
export async function runT2(input: T2Input): Promise<T2Report> {
  const mode: T2Mode = input.mode ?? T2_MODE;
  const records = new Map<string, CapturedRecord>(input.capture.records.map((record) => [record.recordId, record] as const));
  const casesById = new Map(input.dataset.cases.map((item) => [item.id, item] as const));
  const capturedById = new Map(input.capture.cases.map((item) => [item.id, item] as const));
  const folds = caseFolds(input.dataset.cases);

  const base = await replayCapture({
    capture: input.capture,
    dataset: input.dataset,
    variantIds: ["M0", "DEPTH0", "DEPTH1", "DEPTH2"],
    vectors: input.vectors
  });
  const cutPairs = cutPairsOf(base, "M0", casesById);
  const trials = trialsOf(input.dataset, capturedById, records, input.vectors, mode);

  const foldIds = [...new Set(folds.values())].sort((left, right) => left - right);
  const kByFold = new Map(
    foldIds.map((fold) => [fold, input.kOverride?.get(fold) ?? chooseK({ trials, folds, fold })] as const)
  );
  const cutsByFold = new Map(foldIds.map((fold) => [fold, cutsOf({ pairs: cutPairs, folds, fold })] as const));
  const cutsByFoldDepth = new Map(
    foldIds.map((fold) => [
      fold,
      new Map(T2_DEPTHS.map((depth) => [depth, cutsOf({ pairs: cutPairsOf(base, `DEPTH${depth}`, casesById), folds, fold })] as const))
    ] as const)
  );
  const kProduction = chooseK({ trials, folds });
  const cutsProduction = cutsOf({ pairs: cutPairs, folds });

  const perFold: ReplayResult[] = [];
  for (const fold of foldIds) {
    const caseIds = new Set(input.dataset.cases.filter((item) => folds.get(item.id) === fold).map((item) => item.id));
    const choice = kByFold.get(fold);
    const cuts = cutsByFold.get(fold);
    if (choice === undefined || cuts === undefined) throw new Error(`No parameters for fold ${fold}.`);
    perFold.push(await replayWith(input, caseIds, choice.k, cuts, mode));
  }
  const combined = combinedOf(perFold, base);
  const production = await replayWith(input, new Set(input.dataset.cases.map((item) => item.id)), kProduction.k, cutsProduction, mode);

  const decisions = decisionsOf(input.dataset, combined);
  const recall = recallRowsOf(input.dataset, trials, folds, kByFold);
  const survival = survivalOf(input, combined, folds, kByFold, records, capturedById, mode);
  const traps = trapsOf(input, combined);
  const determinism = await adaptiveDeterminism(input, kProduction.k, cutsProduction, production, mode);
  const bands = bandsOf(input.dataset, combined, folds, cutsByFold, cutsByFoldDepth);
  const losses = lostRelevantOf(input, trials, folds, kByFold, capturedById, records);
  const curve = input.curve === false ? [] : curveAboveGridOf(input, trials, capturedById, records, mode);

  return {
    corpus: input.corpus,
    budget: T2_BUDGET,
    mode,
    kByFold: Object.fromEntries(foldIds.map((fold) => [fold, kByFold.get(fold)])) as Record<number, KChoice>,
    cutsByFold: Object.fromEntries(foldIds.map((fold) => [fold, cutsByFold.get(fold)])) as Record<number, BandCuts>,
    cutAudit: cutAuditOf(cutPairs, folds, cutsByFold),
    production: { k: kProduction, cuts: cutsProduction },
    decisions: [...decisions, ...recall],
    survival: survival.summary,
    incompleteEvidence: incompleteEvidenceOf(input.dataset, input.evidence),
    evidenceLosses: survival.losses,
    traps,
    adaptiveDeterminism: determinism,
    admissionByGroupKind: admissionOf(combined),
    auditPool: auditPoolOf(input),
    diagnostics: diagnosticsOf(input.dataset, combined),
    coverage: coverageOf(input.dataset, combined),
    commonReferencePending: [
      referencePendingOf("H4", "ALL_PASSAGES_D2", "FUNNEL_D2", input.dataset, combined),
      referencePendingOf("H5", "DEPTH0", "ADAPTIVE", input.dataset, combined)
    ],
    bands,
    layerGaps: layerGapsOf(input.dataset, input.capture.records),
    lostRelevant: losses,
    recallByDepth: Object.fromEntries(
      T2_DEPTHS.map((depth) => [depth, recallAtKOf(input.dataset, trials, folds, kByFold, depth)])
    ) as Record<number, number | null>,
    curveAboveGrid: curve
  };
}

/** The labelled pairs of one variant's results: the score (eligibility) and the label of each result. */
function cutPairsOf(replay: ReplayResult, variant: string, casesById: ReadonlyMap<string, EvalCase>): CutPair[] {
  return replay.cases.flatMap((caseReplay) => {
    const evalCase = casesById.get(caseReplay.caseId);
    const output = caseReplay.variants.find((item) => item.variant === variant);
    if (evalCase === undefined || output === undefined) return [];
    return output.results.flatMap((item) => {
      const label = labelOf(evalCase, item.threadId);
      if (label === undefined) return [];
      return [{ caseId: evalCase.id, score: item.score, label }];
    });
  });
}

/** The cut audit: how many training pairs reach each cut of each fold, and their precision against the target. */
function cutAuditOf(
  pairs: readonly CutPair[],
  folds: ReadonlyMap<string, number>,
  cutsByFold: ReadonlyMap<number, BandCuts>
): CutAudit[] {
  return [...cutsByFold.entries()].flatMap(([fold, cuts]) => {
    const training = pairs.filter((pair) => folds.get(pair.caseId) !== fold);
    return (["high", "medium"] as const).map((band): CutAudit => {
      const cut = cuts[band];
      const above = cut === null ? [] : training.filter((pair) => pair.score >= cut);
      const positives = above.filter((pair) => pair.label === 1).length;
      return {
        fold,
        band,
        cut,
        target: BAND_TARGETS[band],
        trainingAbove: above.length,
        trainingPositives: positives,
        precision: above.length === 0 ? null : positives / above.length
      };
    });
  });
}

/** The trials of every case: at each depth, the relevant candidates and the finalists of each K. */
function trialsOf(
  dataset: EvalDataset,
  capturedById: ReadonlyMap<string, CapturedCase>,
  records: ReadonlyMap<string, CapturedRecord>,
  vectors: ReadonlyMap<string, number[]>,
  mode: T2Mode
): Map<string, CaseTrials> {
  return new Map(
    dataset.cases.map((evalCase) => {
      const captured = capturedById.get(evalCase.id);
      if (captured === undefined) throw new Error(`The capture has no case ${evalCase.id}.`);
      const funnel = funnelInputOf({ captured, records, vectors });
      if (funnel === undefined) throw new Error(`Case ${evalCase.id} has no funnel input.`);
      const depths = new Map<number, DepthTrials>(
        T2_DEPTHS.map((depth) => {
          const candidates = finalistsOf(
            runFunnel({ ...funnel, budget: T2_BUDGET, k: 30, mode }, funnelConfigOf(variantOf("ALL_CANDIDATES", depth))).steps
          );
          const effective = effectiveJudgments(evalCase, depth as MemorySearchDepth);
          const relevant = candidates.map((item) => item.groupId).filter((groupId) => (effective[groupId] ?? 0) >= 2);
          const keptByK = new Map(
            T2_K_GRID.map((k) => [
              k,
              finalistsOf(runFunnel({ ...funnel, budget: T2_BUDGET, k, mode }, funnelConfigOf(variantOf("FUNNEL", depth))).steps).map(
                (item) => item.groupId
              )
            ] as const)
          );
          return [depth, { relevant, keptByK }] as const;
        })
      );
      return [evalCase.id, depths] as const;
    })
  );
}

/** The finalists of the first step of a funnel: the explicit funnel of one depth has one step. */
function finalistsOf(steps: readonly FunnelStepSummary[]): Array<{ groupId: string; recordIds: string[] }> {
  return steps[0]?.finalists ?? [];
}

function variantOf(family: "FUNNEL" | "ALL_CANDIDATES", depth: number): FunnelVariantName {
  return `${family}_D${depth}` as FunnelVariantName;
}

/** The funnel input of a case, or undefined when the capture lacks it (no channels, vectors or scores). */
function funnelOf(
  input: T2Input,
  capturedById: ReadonlyMap<string, CapturedCase>,
  records: ReadonlyMap<string, CapturedRecord>,
  caseId: string
) {
  const captured = capturedById.get(caseId);
  if (captured === undefined) return undefined;
  return funnelInputOf({ captured, records, vectors: input.vectors });
}

/** One replay of the given cases with the parameters of a fold, or of the production rule. */
async function replayWith(input: T2Input, caseIds: ReadonlySet<string>, k: number, cuts: BandCuts, mode: T2Mode): Promise<ReplayResult> {
  const subset: EvalDataset = { ...input.dataset, cases: input.dataset.cases.filter((item) => caseIds.has(item.id)) };
  const capture: CaptureFile = { ...input.capture, cases: input.capture.cases.filter((item) => caseIds.has(item.id)) };
  return replayCapture({
    capture,
    dataset: subset,
    variantIds: [...T2_VARIANTS],
    vectors: input.vectors,
    funnelParams: { budget: T2_BUDGET, k, mode, cuts: funnelCutsOf(cuts) }
  });
}

/**
 * The band cuts the funnel reads. A cut that the training pairs never fixed (null) is a cut that no
 * eligibility reaches, so it is +∞: the band is then never reached, and the search does not stop on it.
 */
export function funnelCutsOf(cuts: BandCuts): { high: number; medium: number } {
  return {
    high: cuts.high ?? Number.POSITIVE_INFINITY,
    medium: cuts.medium ?? Number.POSITIVE_INFINITY
  };
}

/** The replays of the folds, joined into one replay of every case. */
function combinedOf(perFold: readonly ReplayResult[], base: ReplayResult): ReplayResult {
  return { ...base, variantIds: [...T2_VARIANTS], cases: perFold.flatMap((replay) => replay.cases) };
}

/** The decision rows of H4 (top-1 of the funnel against all passages) and H5 (adaptive against depth 0). */
function decisionsOf(dataset: EvalDataset, replay: ReplayResult): T2Row[] {
  const h4 = decisionRowsOf({ dataset, replay, baseline: "ALL_PASSAGES_D2", candidate: "FUNNEL_D2", metricIds: ["top1Target"] });
  const h5 = decisionRowsOf({
    dataset,
    replay,
    baseline: "DEPTH0",
    candidate: "ADAPTIVE",
    metricIds: ["top1Target", "admissionRecall", "incidentalExposure", "abstentionCorrect"]
  });
  const h5Reference = decisionRowsOf({ dataset, replay, baseline: "DEPTH0", candidate: "ADAPTIVE_HM", metricIds: ["top1Target"] });
  return [
    ...h4.map((row) => rowOf("H4", "Top-1 de FUNNEL não inferior ao de ALL_PASSAGES", "FUNNEL_D2", "ALL_PASSAGES_D2", row)),
    ...h5.map((row) => rowOf("H5", "ADAPTIVE contra DEPTH0", "ADAPTIVE", "DEPTH0", row)),
    ...h5Reference.map((row) => rowOf("H5-ref", "ADAPTIVE_HM, só referência", "ADAPTIVE_HM", "DEPTH0", row))
  ];
}

/** The metrics where a higher value is worse: the verdict reads the inverted difference (baseline minus candidate). */
const LOWER_IS_BETTER: ReadonlySet<string> = new Set(["incidentalExposure"]);

/** The value and the interval of a comparison on the scale where a higher value is better. */
function betterScaleOf(row: MetricComparison): { value: number | null; lower: number | null; upper: number | null } {
  if (!LOWER_IS_BETTER.has(row.metric)) return { value: row.difference, lower: row.lower, upper: row.upper };
  return {
    value: row.difference === null ? null : -row.difference,
    lower: row.upper === null ? null : -row.upper,
    upper: row.lower === null ? null : -row.lower
  };
}

function rowOf(hypothesis: string, criterion: string, candidate: string, baseline: string, row: MetricComparison): T2Row {
  const scale = betterScaleOf(row);
  const verdict =
    scale.lower === null || scale.upper === null
      ? null
      : decisionTerm({ lower: scale.lower, upper: scale.upper }, row.margin);
  return {
    hypothesis,
    criterion,
    metric: row.metric,
    scope: row.scope,
    baseline,
    candidate,
    value: scale.value,
    lower: scale.lower,
    upper: scale.upper,
    margin: row.margin,
    term: verdict?.term ?? null,
    nonInferior: verdict?.nonInferior ?? null
  };
}

/** The recall of relevant groups among the finalists of each fold's K, at each depth, over the cases. */
function recallAtKOf(
  dataset: EvalDataset,
  trials: ReadonlyMap<string, CaseTrials>,
  folds: ReadonlyMap<string, number>,
  kByFold: ReadonlyMap<number, KChoice>,
  depth: number
): number | null {
  let found = 0;
  let relevant = 0;
  for (const evalCase of dataset.cases) {
    const depthTrials = trials.get(evalCase.id)?.get(depth);
    const k = kByFold.get(folds.get(evalCase.id) ?? -1)?.k;
    if (depthTrials === undefined || k === undefined) continue;
    const kept = new Set(depthTrials.keptByK.get(k) ?? []);
    found += depthTrials.relevant.filter((groupId) => kept.has(groupId)).length;
    relevant += depthTrials.relevant.length;
  }
  return relevant === 0 ? null : found / relevant;
}

/**
 * The recall of relevant groups among the finalists of each fold's K, at depth 2, against all candidates.
 * The baseline recall is 1 by construction, so the difference is the recall minus 1; its margin is −0,02.
 */
function recallRowsOf(
  dataset: EvalDataset,
  trials: ReadonlyMap<string, CaseTrials>,
  folds: ReadonlyMap<string, number>,
  kByFold: ReadonlyMap<number, KChoice>
): T2Row[] {
  const families = dataset.cases.flatMap((evalCase): FamilySums[] => {
    const depth = trials.get(evalCase.id)?.get(2);
    const k = kByFold.get(folds.get(evalCase.id) ?? -1)?.k;
    if (depth === undefined || k === undefined || depth.relevant.length === 0) return [];
    const kept = new Set(depth.keptByK.get(k) ?? []);
    const found = depth.relevant.filter((groupId) => kept.has(groupId)).length;
    return [
      {
        family: evalCase.family,
        candidateNum: found,
        candidateDen: depth.relevant.length,
        baselineNum: depth.relevant.length,
        baselineDen: depth.relevant.length
      }
    ];
  });
  const interval: Interval | undefined = pairedBootstrap(families);
  const recall = ratioOf(families.map((item) => ({ num: item.candidateNum, den: item.candidateDen })));
  const value = recall === null ? null : recall - 1;
  const verdict = interval === undefined ? null : decisionTerm(interval, H4_RECALL_MARGIN);
  return [
    {
      hypothesis: "H4-recall",
      criterion: "Recall de grupos de grau ≥ 2 entre os finalistas, contra todos os candidatos",
      metric: "recall",
      scope: "total",
      baseline: "ALL_CANDIDATES_D2",
      candidate: "FUNNEL_D2 (K por fold)",
      value,
      lower: interval?.lower ?? null,
      upper: interval?.upper ?? null,
      margin: H4_RECALL_MARGIN,
      term: verdict?.term ?? null,
      nonInferior: verdict?.nonInferior ?? null
    }
  ];
}

function ratioOf(rows: ReadonlyArray<{ num: number; den: number }>): number | null {
  const num = rows.reduce((sum, row) => sum + row.num, 0);
  const den = rows.reduce((sum, row) => sum + row.den, 0);
  return den === 0 ? null : num / den;
}

/**
 * The evidence survival, by passageId: among the relevant groups that hold the citation of a layer or
 * adaptive-trap case and that became finalists at the fold's K, the share whose selected passages hold
 * the citation. A lost evidence group is listed with its passages and its funnel and all-passages rank.
 */
function survivalOf(
  input: T2Input,
  replay: ReplayResult,
  folds: ReadonlyMap<string, number>,
  kByFold: ReadonlyMap<number, KChoice>,
  records: ReadonlyMap<string, CapturedRecord>,
  capturedById: ReadonlyMap<string, CapturedCase>,
  mode: T2Mode
): {
  summary: { population: number; survived: number; value: number | null; lower: number | null; upper: number | null };
  losses: T2Report["evidenceLosses"];
} {
  const recordsByGroup = new Map<string, CapturedRecord[]>();
  for (const record of records.values()) {
    recordsByGroup.set(record.threadId, [...(recordsByGroup.get(record.threadId) ?? []), record]);
  }
  const rows: Array<{ family: string; num: number; den: number }> = [];
  const losses: T2Report["evidenceLosses"] = [];
  for (const evalCase of input.dataset.cases) {
    if (evalCase.style !== "layer" && evalCase.style !== "adaptive-trap") continue;
    const passageIds = (input.evidence.get(evalCase.id) ?? [])
      .filter((item) => item.status === "indexed")
      .flatMap((item) => item.passageIds);
    const k = kByFold.get(folds.get(evalCase.id) ?? -1)?.k;
    if (passageIds.length === 0 || k === undefined) continue;
    const owners = [...recordsByGroup.keys()]
      .filter((groupId) =>
        (recordsByGroup.get(groupId) ?? []).some((record) => record.passageId !== undefined && passageIds.includes(record.passageId))
      )
      .filter((groupId) => (effectiveJudgments(evalCase, 2 as MemorySearchDepth)[groupId] ?? 0) >= 2);
    const finalists = finalistsAt2(input.vectors, capturedById.get(evalCase.id), records, k, mode);
    for (const groupId of owners.filter((item) => finalists.has(item))) {
      const selected = finalists.get(groupId) ?? [];
      const passages = selected.map((recordId) => records.get(recordId)?.passageId ?? "").filter((item) => item !== "");
      const survivedHere = survivedOf(passages, passageIds);
      rows.push({ family: evalCase.family, num: survivedHere ? 1 : 0, den: 1 });
      if (survivedHere) continue;
      losses.push({
        caseId: evalCase.id,
        groupId,
        passages: (recordsByGroup.get(groupId) ?? []).filter((record) => record.kind === "passage").length,
        funnelRank: rankOf(replay, evalCase.id, "FUNNEL_D2", groupId),
        allPassagesRank: rankOf(replay, evalCase.id, "ALL_PASSAGES_D2", groupId)
      });
    }
  }
  const interval = ratioIntervalOf(rows);
  const population = rows.reduce((sum, item) => sum + item.den, 0);
  const survived = rows.reduce((sum, item) => sum + item.num, 0);
  return {
    summary: {
      population,
      survived,
      value: population === 0 ? null : survived / population,
      lower: interval?.lower ?? null,
      upper: interval?.upper ?? null
    },
    losses
  };
}

/**
 * The finalists of a case at depth 2 for a K, each with the pair record ids that it selected and used.
 * It runs the funnel of the case with the budget and the mode of the T2, so the selection is the same as in the trials.
 */
function finalistsAt2(
  vectors: ReadonlyMap<string, number[]>,
  captured: CapturedCase | undefined,
  records: ReadonlyMap<string, CapturedRecord>,
  k: number,
  mode: T2Mode
): Map<string, string[]> {
  if (captured === undefined) return new Map();
  const funnel = funnelInputOf({ captured, records, vectors });
  if (funnel === undefined) return new Map();
  const steps = runFunnel({ ...funnel, budget: T2_BUDGET, k, mode }, funnelConfigOf("FUNNEL_D2")).steps;
  return new Map(finalistsOf(steps).map((item) => [item.groupId, item.recordIds] as const));
}

function rankOf(replay: ReplayResult, caseId: string, variant: string, groupId: string): number | null {
  const output = replay.cases.find((item) => item.caseId === caseId)?.variants.find((item) => item.variant === variant);
  const index = output?.results.filter((item) => item.admitted).findIndex((item) => item.threadId === groupId) ?? -1;
  return index < 0 ? null : index + 1;
}

/** The layer of the passage that holds the evidence citation, from the capture records. */
function evidenceLayerOf(input: T2Input, caseId: string): number | undefined {
  const passageIds = (input.evidence.get(caseId) ?? [])
    .filter((item) => item.status === "indexed")
    .flatMap((item) => item.passageIds);
  const record = input.capture.records.find((item) => item.passageId !== undefined && passageIds.includes(item.passageId));
  return record?.layer;
}

/**
 * The admitted result that stopped the adaptive walk: the first admitted group of the band that the stop reason
 * names. Null when the walk ran to the deepest layer or the budget, so no band stopped it.
 */
function triggerOf(results: readonly VariantResult[]): { groupId: string; score: number; band: "high" | "medium" } | null {
  const admitted = results.filter((item) => item.admitted);
  const stopReason = admitted[0]?.funnel?.stopReason;
  const band = stopReason === undefined ? undefined : TRIGGER_BAND[stopReason];
  if (band === undefined) return null;
  const trigger = admitted.find((item) => item.band === band);
  if (trigger === undefined) return null;
  return { groupId: trigger.threadId, score: trigger.score, band };
}

/**
 * The traps (adaptive-trap cases): for each one, the layer where ADAPTIVE stopped, the admitted result that
 * triggered the stop (group, grade, score, band), and the layer of the evidence citation. Top-1 and Top-3
 * of ADAPTIVE and DEPTH2 summed over the traps.
 */
function trapsOf(input: T2Input, replay: ReplayResult): T2Report["traps"] {
  const adaptiveInputs = new Map(caseInputsFor(input.dataset, replay, "ADAPTIVE").map((item) => [item.caseId, item] as const));
  const depthInputs = new Map(caseInputsFor(input.dataset, replay, "DEPTH2").map((item) => [item.caseId, item] as const));
  const traps = input.dataset.cases.filter((item) => item.style === "adaptive-trap");
  const cases: TrapCase[] = traps.map((evalCase) => {
    const output = replay.cases.find((item) => item.caseId === evalCase.id)?.variants.find((item) => item.variant === "ADAPTIVE");
    const stoppedAt = output?.judgedDepth ?? 0;
    const evidenceLayer = evidenceLayerOf(input, evalCase.id);
    const judgments = adaptiveInputs.get(evalCase.id)?.judgments ?? {};
    const found = triggerOf(output?.results ?? []);
    const trigger = found === null ? null : { ...found, grade: judgments[found.groupId] ?? 0 };
    return {
      caseId: evalCase.id,
      stoppedAt,
      evidenceLayer,
      trigger,
      stoppedBeforeEvidence: evidenceLayer !== undefined && stoppedAt < evidenceLayer
    };
  });
  const sum = (inputs: ReadonlyMap<string, CaseInput>, pick: (item: ReturnType<typeof caseContribution>) => number): number =>
    traps.reduce((total, evalCase) => {
      const item = inputs.get(evalCase.id);
      return item === undefined ? total : total + pick(caseContribution(item));
    }, 0);
  return {
    stoppedBeforeEvidence: cases.filter((item) => item.stoppedBeforeEvidence).length,
    adaptiveTrapCases: traps.length,
    cases,
    top: {
      ADAPTIVE: {
        top1: sum(adaptiveInputs, (item) => item.top1Target.num),
        top3: sum(adaptiveInputs, (item) => item.top3Target.num),
        cases: traps.length
      },
      DEPTH2: {
        top1: sum(depthInputs, (item) => item.top1Target.num),
        top3: sum(depthInputs, (item) => item.top3Target.num),
        cases: traps.length
      }
    }
  };
}

/** The divergences of ADAPTIVE between two runs of the same production parameters: the judged depth must match. */
async function adaptiveDeterminism(
  input: T2Input,
  k: number,
  cuts: BandCuts,
  first: ReplayResult,
  mode: T2Mode
): Promise<{ cases: number; divergences: number }> {
  const second = await replayWith(input, new Set(input.dataset.cases.map((item) => item.id)), k, cuts, mode);
  let divergences = 0;
  for (const caseReplay of first.cases) {
    const other = second.cases.find((item) => item.caseId === caseReplay.caseId);
    const a = caseReplay.variants.find((item) => item.variant === "ADAPTIVE");
    const b = other?.variants.find((item) => item.variant === "ADAPTIVE");
    if (a?.judgedDepth !== b?.judgedDepth) divergences += 1;
  }
  return { cases: first.cases.length, divergences };
}

/**
 * The faixas of ADAPTIVE against DEPTH0 (plan section 5): the precision of ADAPTIVE's high band against
 * DEPTH0's admitted precision, per case, paired by family, with the margin of the proportions. The cuts are
 * those of each fold. The recuo 1 re-bands the same results with the per-depth cuts of each fold; it does not
 * redo the search.
 */
function bandsOf(
  dataset: EvalDataset,
  replay: ReplayResult,
  folds: ReadonlyMap<string, number>,
  cutsByFold: ReadonlyMap<number, BandCuts>,
  cutsByFoldDepth: ReadonlyMap<number, ReadonlyMap<number, BandCuts>>
): BandsReport {
  const adaptive = new Map(caseInputsFor(dataset, replay, "ADAPTIVE").map((item) => [item.caseId, item] as const));
  const depth0 = new Map(caseInputsFor(dataset, replay, "DEPTH0").map((item) => [item.caseId, item] as const));
  const families = (recuo: boolean): FamilySums[] =>
    dataset.cases.flatMap((evalCase): FamilySums[] => {
      const candidate = adaptive.get(evalCase.id);
      const baseline = depth0.get(evalCase.id);
      if (candidate === undefined || baseline === undefined) return [];
      const output = replay.cases.find((item) => item.caseId === evalCase.id)?.variants.find((item) => item.variant === "ADAPTIVE");
      const fold = folds.get(evalCase.id) ?? -1;
      const cuts = recuo ? cutsByFoldDepth.get(fold)?.get(output?.judgedDepth ?? 2) : cutsByFold.get(fold);
      const high = candidate.results.filter((item) => {
        if (!item.admitted) return false;
        if (!recuo) return item.band === "high";
        return cuts !== undefined && bandOf(item.score, cuts) === "high";
      });
      const highRelevant = high.filter((item) => (candidate.judgments[item.threadId] ?? 0) >= 2).length;
      const admitted = baseline.results.filter((item) => item.admitted);
      const admittedRelevant = admitted.filter((item) => (baseline.judgments[item.threadId] ?? 0) >= 2).length;
      return [{ family: evalCase.family, candidateNum: highRelevant, candidateDen: high.length, baselineNum: admittedRelevant, baselineDen: admitted.length }];
    });
  const bandRow = (hypothesis: string, criterion: string, rows: FamilySums[]): T2Row => {
    const interval = pairedBootstrap(rows.filter((row) => row.candidateDen > 0 && row.baselineDen > 0));
    const candidateRatio = ratioOf(rows.map((row) => ({ num: row.candidateNum, den: row.candidateDen })));
    const baselineRatio = ratioOf(rows.map((row) => ({ num: row.baselineNum, den: row.baselineDen })));
    const difference = candidateRatio === null || baselineRatio === null ? null : candidateRatio - baselineRatio;
    const verdict = interval === undefined ? null : decisionTerm(interval, PROPORTION_MARGIN);
    return {
      hypothesis,
      criterion,
      metric: "precisão da faixa alta",
      scope: "total",
      baseline: "DEPTH0 (admitidos)",
      candidate: "ADAPTIVE (faixa alta)",
      value: difference,
      lower: interval?.lower ?? null,
      upper: interval?.upper ?? null,
      margin: PROPORTION_MARGIN,
      term: verdict?.term ?? null,
      nonInferior: verdict?.nonInferior ?? null
    };
  };
  const highBandCounts: Record<string, number> = {};
  for (const variant of ["ADAPTIVE", "FUNNEL_D2", "ADAPTIVE_HM"]) {
    highBandCounts[variant] = replay.cases.reduce((total, caseReplay) => {
      const output = caseReplay.variants.find((item) => item.variant === variant);
      return total + (output?.results.filter((item) => item.band === "high").length ?? 0);
    }, 0);
  }
  return {
    rows: [bandRow("F", "Precisão externa da faixa alta de ADAPTIVE não inferior à de DEPTH0 (cortes por fold)", families(false))],
    recuoRows: [bandRow("F-recuo1", "Recuo 1: cortes por profundidade, re-faixa dos mesmos resultados", families(true))],
    highBandCounts,
    highCutDegenerate: [...cutsByFold.values()].some((cuts) => (cuts.high ?? 0) >= 0.9999),
    cutTables: [...cutsByFoldDepth.entries()].flatMap(([fold, byDepth]) =>
      [...byDepth.entries()].map(([depth, cuts]) => ({ fold, depth, high: cuts.high, medium: cuts.medium }))
    )
  };
}

/**
 * The relevant candidates that the fold's K did not keep, at each depth: the case, the group, its grade, and its
 * fusion rank and best dense rank among the groups of the depth.
 */
function lostRelevantOf(
  input: T2Input,
  trials: ReadonlyMap<string, CaseTrials>,
  folds: ReadonlyMap<string, number>,
  kByFold: ReadonlyMap<number, KChoice>,
  capturedById: ReadonlyMap<string, CapturedCase>,
  records: ReadonlyMap<string, CapturedRecord>
): LostRelevant[] {
  return input.dataset.cases.flatMap((evalCase) => {
    const funnel = funnelOf(input, capturedById, records, evalCase.id);
    const k = kByFold.get(folds.get(evalCase.id) ?? -1)?.k;
    const caseTrials = trials.get(evalCase.id);
    if (funnel === undefined || k === undefined || caseTrials === undefined) return [];
    return T2_DEPTHS.flatMap((depth) => {
      const depthTrials = caseTrials.get(depth);
      const channels = funnel.channelsByDepth[depth as MemorySearchDepth];
      if (depthTrials === undefined || channels === undefined) return [];
      const kept = new Set(depthTrials.keptByK.get(k) ?? []);
      const lost = depthTrials.relevant.filter((groupId) => !kept.has(groupId));
      if (lost.length === 0) return [];
      const groups = groupsOf(channels, funnel.vectors);
      const byFusion = [...groups].sort((left, right) => right.fusion - left.fusion || (left.groupId < right.groupId ? -1 : 1));
      const byDense = groups
        .filter((group) => group.bestPassageRank !== undefined)
        .sort((left, right) => (left.bestPassageRank ?? 0) - (right.bestPassageRank ?? 0));
      const effective = effectiveJudgments(evalCase, depth as MemorySearchDepth);
      return lost.map((groupId): LostRelevant => {
        const fusionIndex = byFusion.findIndex((group) => group.groupId === groupId);
        const denseIndex = byDense.findIndex((group) => group.groupId === groupId);
        return {
          caseId: evalCase.id,
          groupId,
          depth,
          grade: effective[groupId] ?? 0,
          fusionRank: fusionIndex < 0 ? null : fusionIndex + 1,
          denseRank: denseIndex < 0 ? null : denseIndex + 1
        };
      });
    });
  });
}

/**
 * The exploratory recall curve above the grid: K = 40, 50, 60 and the largest candidate count of the corpus at
 * depth 2, each with the budget that it requires by 3K ≤ ⌊B / 2⌋ (B = 6K). It is information only: it chooses nothing.
 */
function curveAboveGridOf(
  input: T2Input,
  trials: ReadonlyMap<string, CaseTrials>,
  capturedById: ReadonlyMap<string, CapturedCase>,
  records: ReadonlyMap<string, CapturedRecord>,
  mode: T2Mode
): T2Report["curveAboveGrid"] {
  const candidateCounts = input.dataset.cases.map((evalCase) => {
    const funnel = funnelOf(input, capturedById, records, evalCase.id);
    const channels = funnel?.channelsByDepth[2];
    return funnel === undefined || channels === undefined ? 0 : groupsOf(channels, funnel.vectors).length;
  });
  const allK = Math.max(1, ...candidateCounts);
  return [...CURVE_KS, allK].map((k) => {
    const budget = CURVE_BUDGET_FACTOR * k;
    const recallByDepth: Record<number, number | null> = {};
    const incompleteCases: Record<number, number> = {};
    for (const depth of T2_DEPTHS) {
      let found = 0;
      let relevant = 0;
      incompleteCases[depth] = 0;
      for (const evalCase of input.dataset.cases) {
        const depthTrials = trials.get(evalCase.id)?.get(depth);
        const funnel = funnelOf(input, capturedById, records, evalCase.id);
        if (depthTrials === undefined || funnel === undefined) continue;
        const kept = finalistsWithinMatrix(funnel, budget, k, mode, depth);
        if (kept === undefined) {
          incompleteCases[depth] = (incompleteCases[depth] ?? 0) + 1;
          continue;
        }
        found += depthTrials.relevant.filter((groupId) => kept.has(groupId)).length;
        relevant += depthTrials.relevant.length;
      }
      recallByDepth[depth] = incompleteCases[depth] === 0 && relevant > 0 ? found / relevant : null;
    }
    return { k, requiredBudget: budget, recallByDepth, incompleteCases };
  });
}

/**
 * The finalists of one depth's funnel run at a budget, or undefined when the run needs a pair that the capture
 * matrix does not hold. Such a case is incomplete: it is counted, never read as a zero.
 */
function finalistsWithinMatrix(
  funnel: FunnelVariantInput,
  budget: number,
  k: number,
  mode: T2Mode,
  depth: number
): Set<string> | undefined {
  try {
    const steps = runFunnel({ ...funnel, budget, k, mode }, funnelConfigOf(variantOf("FUNNEL", depth))).steps;
    return new Set(finalistsOf(steps).map((item) => item.groupId));
  } catch (error) {
    if (error instanceof MissingRerankScore) return undefined;
    throw error;
  }
}

/** The layer gaps: a relevant group (judged grade ≥ 2 in some layer) with a layer up to depth 2 that nobody judged. */
function layerGapsOf(dataset: EvalDataset, captureRecords: readonly CapturedRecord[]): T2Report["layerGaps"] {
  const present = presentLayersOf(captureRecords);
  let relevantGroups = 0;
  let groupsWithGap = 0;
  let ungradedCells = 0;
  let cases = 0;
  for (const evalCase of dataset.cases) {
    const groups = new Set<string>([
      ...Object.keys(evalCase.judgments),
      ...Object.keys(evalCase.layerJudgments?.[1] ?? {}),
      ...Object.keys(evalCase.layerJudgments?.[2] ?? {})
    ]);
    let caseHasGap = false;
    for (const groupId of groups) {
      const grades = [evalCase.judgments[groupId], evalCase.layerJudgments?.[1]?.[groupId], evalCase.layerJudgments?.[2]?.[groupId]];
      const maxGrade = Math.max(0, ...grades.map((grade) => grade ?? 0));
      if (maxGrade < 2) continue;
      relevantGroups += 1;
      const saturated = saturatedOf(evalCase.judgments, groupId);
      const required = requiredLayersOf(groupId, 2, new Set(present[groupId] ?? [0]), saturated);
      const ungraded = required.filter((layer) =>
        (layer === 0 ? evalCase.judgments[groupId] : evalCase.layerJudgments?.[layer]?.[groupId]) === undefined
      );
      if (ungraded.length === 0) continue;
      groupsWithGap += 1;
      ungradedCells += ungraded.length;
      caseHasGap = true;
    }
    if (caseHasGap) cases += 1;
  }
  return { cases, relevantGroups, groupsWithGap, ungradedCells };
}

/**
 * The reference cells of a comparison that are not judged: the cells the common reference would read up to its
 * depth, with the admitted reach. They are informative only: a layer cell that nobody judged neither blocks the
 * comparison nor counts as zero (plan revision 8). `blocked` reads the variants' own completeness alone.
 */
function referencePendingOf(
  hypothesis: string,
  baseline: string,
  candidate: string,
  dataset: EvalDataset,
  replay: ReplayResult
): ReferencePending {
  const own = {
    baseline: caseInputsFor(dataset, replay, baseline),
    candidate: caseInputsFor(dataset, replay, candidate)
  };
  const referenced = withCommonReference(dataset, own.baseline, own.candidate);
  const blocked = [evaluateVariant(baseline, own.baseline), evaluateVariant(candidate, own.candidate)].some(
    (item) => item.status !== "complete"
  );
  const atReference = [...referenced.baseline, ...referenced.candidate].map((item) => ({
    ...item,
    judgedDepth: item.referenceDepth ?? item.judgedDepth
  }));
  const cells = pendingPairs(atReference, true).map((cell) => ({
    caseId: cell.caseId,
    threadId: cell.threadId,
    layer: cell.layer ?? null
  }));
  const unique = [...new Map(cells.map((cell) => [`${cell.caseId}|${cell.threadId}|${cell.layer ?? "-"}`, cell] as const)).values()];
  return { hypothesis, baseline, candidate, blocked, pending: unique.length, cells: unique };
}

/** The incomplete evidence: layer and adaptive-trap cases without an indexed passage. */
function incompleteEvidenceOf(dataset: EvalDataset, evidence: ReadonlyMap<string, readonly EvidenceMatch[]>): string[] {
  return dataset.cases
    .filter((evalCase) => evalCase.style === "layer" || evalCase.style === "adaptive-trap")
    .filter((evalCase) => (evidence.get(evalCase.id) ?? []).filter((item) => item.status === "indexed").flatMap((item) => item.passageIds).length === 0)
    .map((evalCase) => evalCase.id);
}

/** The admitted groups of ADAPTIVE and FUNNEL_D2, by kind: threads, the rules of the layer-1 sources, and documents. */
function admissionOf(replay: ReplayResult): Record<string, Record<string, number>> {
  const kindOf = (groupId: string): string => {
    if (groupId === RULES_GROUP) return "rules";
    if (groupId.startsWith(DOCUMENT_GROUP_PREFIX)) return "document";
    return "thread";
  };
  const count = (variant: string): Record<string, number> => {
    const counts: Record<string, number> = { thread: 0, rules: 0, document: 0 };
    for (const caseReplay of replay.cases) {
      const output = caseReplay.variants.find((item) => item.variant === variant);
      for (const item of output?.results.filter((result) => result.admitted) ?? []) {
        counts[kindOf(item.threadId)] = (counts[kindOf(item.threadId)] ?? 0) + 1;
      }
    }
    return counts;
  };
  return { ADAPTIVE: count("ADAPTIVE"), FUNNEL_D2: count("FUNNEL_D2") };
}

/**
 * The audit pool: the sampled pairs, their externals, and the sampled pairs with a consensual grade ≥ 2 in any
 * layer up to the reference depth.
 */
function auditPoolOf(input: T2Input): { sampledPairs: number; externals: number; findings: number; medianExternals: number | null } {
  const sampled = input.audit.cases.flatMap((item) => item.sampled.map((groupId) => ({ caseId: item.caseId, groupId })));
  const findings = sampled.filter((pair) => {
    const evalCase = input.dataset.cases.find((item) => item.id === pair.caseId);
    if (evalCase === undefined) return false;
    return (effectiveJudgments(evalCase, 2 as MemorySearchDepth)[pair.groupId] ?? 0) >= 2;
  }).length;
  const externals = input.audit.cases.reduce((sum, item) => sum + item.externalCount, 0);
  const counts = input.audit.cases.map((item) => item.externalCount).sort((left, right) => left - right);
  const middle = Math.floor(counts.length / 2);
  const median =
    counts.length === 0
      ? null
      : counts.length % 2 === 1
        ? (counts[middle] ?? null)
        : ((counts[middle - 1] ?? 0) + (counts[middle] ?? 0)) / 2;
  return { sampledPairs: sampled.length, externals, findings, medianExternals: median };
}

/** The coverage of each variant that the decision uses: its status and its pending and incomplete parts. */
function coverageOf(dataset: EvalDataset, replay: ReplayResult): Record<string, { status: string; pending: number; incompleteCases: number }> {
  const variants = ["DEPTH0", "DEPTH2", "FUNNEL_D2", "ALL_PASSAGES_D2", "ALL_CANDIDATES_D2", "ADAPTIVE", "ADAPTIVE_HM"];
  return Object.fromEntries(
    variants.map((variant) => {
      const evaluation = evaluateVariant(variant, caseInputsFor(dataset, replay, variant));
      return [variant, { status: evaluation.status, pending: evaluation.pending.length, incompleteCases: evaluation.incompleteCaseIds.length }] as const;
    })
  );
}

/** Diagnostics: the full-list metrics per variant, with null (not calculable) when the denominator is zero. */
function diagnosticsOf(dataset: EvalDataset, replay: ReplayResult): Record<string, Record<string, number | null>> {
  const variants = ["DEPTH0", "DEPTH2", "FUNNEL_D2", "ALL_PASSAGES_D2", "ADAPTIVE", "ADAPTIVE_HM"];
  return Object.fromEntries(
    variants.map((variant) => {
      const evaluation = evaluateVariant(variant, caseInputsFor(dataset, replay, variant));
      const total = evaluation.scopes["total"] ?? {};
      return [variant, { fullRecall10: total["fullRecall10"] ?? null, fullMrr10: total["fullMrr10"] ?? null }] as const;
    })
  );
}

/** The Markdown of the T2 report: the decision tables, the folds, the cut audit, the faixas, the traps, the losses. */
export function renderT2Markdown(report: T2Report): string {
  const lines: string[] = [
    `# T2 da E3: ${report.corpus} (modo ${report.mode})`,
    "",
    `Orçamento B = ${report.budget}. Folds externos por família; K e cortes escolhidos só nos folds de treino.`,
    "",
    "## Seleção por fold",
    "",
    "| Fold | K | Regra atendida | Corte high | Corte medium |",
    "|---|---|---|---|---|"
  ];
  for (const fold of Object.keys(report.kByFold)) {
    const choice = report.kByFold[Number(fold)];
    const cuts = report.cutsByFold[Number(fold)];
    lines.push(`| ${fold} | ${choice?.k ?? "—"} | ${choice?.met ? "sim" : "não (K_max)"} | ${fmt(cuts?.high)} | ${fmt(cuts?.medium)} |`);
  }
  lines.push(
    `| produção | ${report.production.k.k} | ${report.production.k.met ? "sim" : "não (K_max)"} | ${fmt(report.production.cuts.high)} | ${fmt(report.production.cuts.medium)} |`,
    "",
    "## Diagnóstico dos cortes (treino de cada fold)",
    "",
    "| Fold | Banda | Corte | Meta de precisão | Pares de treino ≥ corte | Positivos | Precisão no corte |",
    "|---|---|---|---|---|---|---|",
    ...report.cutAudit.map(
      (row) => `| ${row.fold} | ${row.band} | ${fmt(row.cut)} | ${row.target} | ${row.trainingAbove} | ${row.trainingPositives} | ${fmt(row.precision)} |`
    ),
    "",
    "## Tabela de decisão",
    "",
    "Exposição incidental: a métrica é de dano (1 quando o caso positivo admite grau ≤ 1). Na tabela, a diferença e o veredito são lidos com o sinal invertido (base − candidato): positivo = ADAPTIVE expõe menos.",
    "",
    "| Hipótese | Critério | Métrica | Escopo | Base | Candidato | Diferença | IC inferior | IC superior | Margem | Termo | Não inferior |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|"
  );
  for (const row of [...report.decisions, ...report.bands.rows, ...report.bands.recuoRows]) {
    lines.push(
      `| ${row.hypothesis} | ${row.criterion} | ${row.metric} | ${row.scope} | ${row.baseline} | ${row.candidate} | ${fmt(row.value)} | ${fmt(row.lower)} | ${fmt(row.upper)} | ${row.margin} | ${row.term ?? "—"} | ${row.nonInferior ?? "—"} |`
    );
  }
  lines.push(
    "",
    "## Faixas: resultados na faixa alta por variante",
    "",
    `Corte high no topo da escala (≥ 0,9999 em algum fold): ${report.bands.highCutDegenerate ? "sim" : "não"}.`,
    "",
    "Cortes por profundidade (recuo 1), por fold:",
    "",
    "| Fold | Profundidade | Corte high | Corte medium |",
    "|---|---|---|---|",
    ...report.bands.cutTables.map((row) => `| ${row.fold} | ${row.depth} | ${fmt(row.high)} | ${fmt(row.medium)} |`),
    "",
    "| Variante | Resultados na faixa alta |",
    "|---|---|",
    ...Object.keys(report.bands.highBandCounts).map((variant) => `| ${variant} | ${report.bands.highBandCounts[variant]} |`),
    "",
    "## Sobrevivência da evidência (por passageId)",
    "",
    `População: ${report.survival.population}; sobreviveu: ${report.survival.survived}; valor: ${fmt(report.survival.value)} (IC ${fmt(report.survival.lower)} a ${fmt(report.survival.upper)}).`,
    `Casos sem passageId indexado (incompletos): ${report.incompleteEvidence.length}.`,
    "",
    "## Armadilhas (adaptive-trap)",
    "",
    `Paradas antes da camada da evidência: ${report.traps.stoppedBeforeEvidence} de ${report.traps.adaptiveTrapCases}.`,
    `ADAPTIVE: Top-1 ${report.traps.top["ADAPTIVE"]?.top1 ?? "—"}, Top-3 ${report.traps.top["ADAPTIVE"]?.top3 ?? "—"}; DEPTH2: Top-1 ${report.traps.top["DEPTH2"]?.top1 ?? "—"}, Top-3 ${report.traps.top["DEPTH2"]?.top3 ?? "—"} (de ${report.traps.adaptiveTrapCases} casos).`,
    "",
    "| Caso | Parou na camada | Camada da evidência | Parou antes | Resultado que disparou (grupo, grau, score, faixa) |",
    "|---|---|---|---|---|",
    ...report.traps.cases.map(
      (item) =>
        `| ${item.caseId} | ${item.stoppedAt} | ${item.evidenceLayer ?? "—"} | ${item.stoppedBeforeEvidence ? "sim" : "não"} | ${item.trigger ? `${item.trigger.groupId}, ${item.trigger.grade}, ${item.trigger.score.toFixed(5)}, ${item.trigger.band}` : "—"} |`
    ),
    "",
    "## Referencial comum (células pendentes, não bloqueiam)",
    "",
    "| Hipótese | Base | Candidato | Células pendentes | Bloqueia |",
    "|---|---|---|---|---|",
    ...report.commonReferencePending.map(
      (item) => `| ${item.hypothesis} | ${item.baseline} | ${item.candidate} | ${item.pending} | ${item.blocked ? "sim" : "não"} |`
    ),
    "",
    "## Lacunas de camada (diagnóstico, não bloqueia)",
    "",
    `Casos com lacuna: ${report.layerGaps.cases}; grupos relevantes: ${report.layerGaps.relevantGroups}; com lacuna de camada: ${report.layerGaps.groupsWithGap}; células sem julgamento: ${report.layerGaps.ungradedCells}.`,
    "",
    "## Recall por profundidade no K de cada fold",
    "",
    "| Profundidade | Recall |",
    "|---|---|",
    ...Object.keys(report.recallByDepth).map((depth) => `| ${depth} | ${fmt(report.recallByDepth[Number(depth)])} |`),
    "",
    "## Relevantes perdidos no K de cada fold",
    "",
    "| Caso | Grupo | Profundidade | Grau | Rank pela fusão | Rank pelo denso |",
    "|---|---|---|---|---|---|",
    ...report.lostRelevant.map(
      (item) => `| ${item.caseId} | ${item.groupId} | ${item.depth} | ${item.grade} | ${item.fusionRank ?? "—"} | ${item.denseRank ?? "—"} |`
    ),
    "",
    "## Curva exploratória acima da grade (só informação)",
    "",
    "Recall só é reportado quando nenhum caso da profundidade ficou incompleto; caso contrário, \"—\" e a contagem mostra quantos casos precisam de pares fora da matriz da captura.",
    "",
    ...(report.curveAboveGrid.length === 0 ? ["Curva não executada nesta corrida (só a corrida cosseno a calcula)."] : []),
    "| K | B exigido (3K ≤ ⌊B/2⌋) | Recall D0 | Recall D1 | Recall D2 | Incompletos D0/D1/D2 |",
    "|---|---|---|---|---|---|",
    ...report.curveAboveGrid.map(
      (item) =>
        `| ${item.k} | ${item.requiredBudget} | ${fmt(item.recallByDepth[0])} | ${fmt(item.recallByDepth[1])} | ${fmt(item.recallByDepth[2])} | ${item.incompleteCases[0] ?? 0}/${item.incompleteCases[1] ?? 0}/${item.incompleteCases[2] ?? 0} |`
    ),
    "",
    "## Perdas de evidência",
    "",
    "| Caso | Grupo | Passagens | Posição em FUNNEL_D2 | Posição em ALL_PASSAGES_D2 |",
    "|---|---|---|---|---|"
  );
  for (const loss of report.evidenceLosses) {
    lines.push(`| ${loss.caseId} | ${loss.groupId} | ${loss.passages} | ${loss.funnelRank ?? "—"} | ${loss.allPassagesRank ?? "—"} |`);
  }
  lines.push(
    "",
    "## Determinismo",
    "",
    `Divergências de profundidade julgada (ADAPTIVE, duas execuções): ${report.adaptiveDeterminism.divergences} de ${report.adaptiveDeterminism.cases} casos.`,
    "",
    "## Admissão por tipo de grupo",
    "",
    "| Variante | Thread | Rules | Document |",
    "|---|---|---|---|"
  );
  for (const variant of Object.keys(report.admissionByGroupKind)) {
    const counts = report.admissionByGroupKind[variant] ?? {};
    lines.push(`| ${variant} | ${counts["thread"] ?? 0} | ${counts["rules"] ?? 0} | ${counts["document"] ?? 0} |`);
  }
  lines.push(
    "",
    "## Cobertura das variantes da decisão",
    "",
    "| Variante | Status | Células pendentes | Casos incompletos |",
    "|---|---|---|---|",
    ...Object.keys(report.coverage).map(
      (variant) => `| ${variant} | ${report.coverage[variant]?.status ?? "—"} | ${report.coverage[variant]?.pending ?? "—"} | ${report.coverage[variant]?.incompleteCases ?? "—"} |`
    ),
    "",
    "## Pool da auditoria",
    "",
    `Pares sorteados: ${report.auditPool.sampledPairs}; externos: ${report.auditPool.externals}; mediana de externos por caso: ${fmt(report.auditPool.medianExternals)}; achados (grau consensual ≥ 2 em alguma camada): ${report.auditPool.findings}.`,
    "",
    "## Diagnóstico (lista cheia; \"não calculável\" quando não há denominador)",
    "",
    "| Variante | fullRecall10 | fullMrr10 |",
    "|---|---|---|"
  );
  for (const variant of Object.keys(report.diagnostics)) {
    const values = report.diagnostics[variant] ?? {};
    lines.push(`| ${variant} | ${fmtOrNotCalculable(values["fullRecall10"])} | ${fmtOrNotCalculable(values["fullMrr10"])} |`);
  }
  return `${lines.join("\n")}\n`;
}

function fmt(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toFixed(4);
}

function fmtOrNotCalculable(value: number | null | undefined): string {
  return value === null || value === undefined ? "não calculável" : value.toFixed(4);
}
