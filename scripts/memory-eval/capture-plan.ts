import type { MemoryQueryCandidateSet } from "../../src/core/memory/query-candidates.js";
import {
  buildMemoryQueryCandidates,
  interpretMemoryQuery
} from "../../src/core/memory/query-interpretation.js";
import type {
  MemoryQueryInterpretation,
  MemorySearchChannels,
  MemorySearchDepth,
  MemoryVectorRow
} from "../../src/core/memory/types.js";
import { INTERPRETATION_LAYERS } from "../../src/core/memory/search-depth.js";
import { searchChannelsByDepth } from "./capture-layers.js";
import {
  E3_K_MAX,
  evidenceGroupIdsOf,
  knownGroupIdsOf,
  scopeRecordIdsOf
} from "./capture-scope.js";
import type { CapturedIncomplete, CaptureContext } from "./capture-types.js";
import type { EvalCase } from "./dataset.js";
import { evidenceMatchesOf } from "./evidence-match.js";
import type { EvidenceMatch, EvidencePassage } from "./matrix-plan.js";
import {
  RecordingQueryInterpreter,
  type InterpretationTrace
} from "./recording-providers.js";

/**
 * Everything of a case that is known before any pair is scored: the interpretation, the live
 * channels of each depth for the effective query, the closed matrix scope and the evidence.
 */
export type CasePlan = {
  evalCase: EvalCase;
  interpretation: MemoryQueryInterpretation;
  candidates: MemoryQueryCandidateSet;
  interpretationTrace: InterpretationTrace[];
  effectiveQuery: string;
  queryVector: number[];
  channelsByDepth: Partial<Record<MemorySearchDepth, MemorySearchChannels>>;
  /** Records of the matrix, sorted by recordId. Each one is scored once for the effective query. */
  scopeRecordIds: string[];
  evidence: EvidenceMatch[];
  incomplete?: CapturedIncomplete;
};

/** Plans every case, in dataset order, without scoring a pair. */
export async function planCases(
  context: CaptureContext,
  cases: readonly EvalCase[]
): Promise<CasePlan[]> {
  const plans: CasePlan[] = [];
  for (const evalCase of cases) plans.push(await planCase(context, evalCase));
  return plans;
}

export async function planCase(context: CaptureContext, evalCase: EvalCase): Promise<CasePlan> {
  const interpreter = new RecordingQueryInterpreter(context.providers.interpreter);
  const candidates = buildMemoryQueryCandidates(
    evalCase.query,
    await interpretationRowsOf(context)
  );
  const interpretation = await interpretMemoryQuery({
    mode: evalCase.queryMode,
    originalQuery: evalCase.query,
    provider: interpreter,
    ...candidates
  });
  const effectiveQuery = interpretation.effectiveQuery;
  const queryVector = [...(await context.providers.embedding.embedQuery(effectiveQuery))];
  const channelsByDepth = await searchChannelsByDepth(context, effectiveQuery, queryVector);
  const scopeRecordIds = scopeRecordIdsOf({
    channelsByDepth,
    rows: context.rows,
    knownGroupIds: knownGroupIdsOf(evalCase),
    evidenceGroupIds: evidenceGroupIdsOf(evalCase),
    kMax: E3_K_MAX
  });
  const evidence = evidenceMatchesOf({
    evidence: evalCase.evidence ?? [],
    passages: passagesOf(context),
    sourceTexts: context.sourceTexts ?? new Map()
  });
  return {
    evalCase,
    interpretation,
    candidates,
    interpretationTrace: interpreter.trace,
    effectiveQuery,
    queryVector,
    channelsByDepth,
    scopeRecordIds,
    evidence,
    incomplete: incompleteOf(evidence)
  };
}

/**
 * The passages of the index, with the source path in corpus form. The index stores paths from the
 * workspace root (`.marc/threads/...`), and the corpus and the evidence quotes use paths inside `.marc`.
 */
function passagesOf(context: CaptureContext): EvidencePassage[] {
  return context.rows
    .filter((row) => row.kind === "passage")
    .map((row) => ({ passageId: row.passageId, sourcePath: corpusPathOf(row.sourcePath), text: row.text }));
}

const MARC_PREFIX = ".marc/";

function corpusPathOf(sourcePath: string): string {
  if (!sourcePath.startsWith(MARC_PREFIX)) return sourcePath;
  return sourcePath.slice(MARC_PREFIX.length);
}

/**
 * The rows that the query interpretation reads: the layers of INTERPRETATION_LAYERS, read through the
 * store exactly as the core does (recall-support.ts). A term that exists only in a deeper layer is not a candidate.
 */
export async function interpretationRowsOf(context: CaptureContext): Promise<MemoryVectorRow[]> {
  return context.store.readRows(context.info, context.generation, {
    layers: INTERPRETATION_LAYERS
  });
}

/** A case with a quote that is not indexed as a whole stays incomplete, with the reason. */
function incompleteOf(matches: readonly EvidenceMatch[]): CapturedIncomplete | undefined {
  const missing = matches.find((match) => match.status !== "indexed");
  if (missing === undefined) return undefined;
  if (missing.status === "evidence_unindexable") return { reason: "evidence_unindexable" };
  return { reason: "evidence_missing" };
}
