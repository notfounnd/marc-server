/**
 * E3 T1g pre-study: the T1e discordance between M0 and the funnel at depth 0, with the reranker rank of the funnel in
 * the M0 semantics (admittedOf: the global position of each group's best passage among every passage scored in the
 * step). Budget 232, K in {8, 10, 12, 15, 20, 25, 30}, cosine mode; first-step allowance 116 (the first step of
 * ADAPTIVE) and depth0 allowance 232. `passage-all` is the M0 check: every group with its consolidated passages.
 * No model is loaded. Output: one JSON file under .marc/cache/memory-eval-e3/t1g/.
 *
 *   pnpm exec tsx scripts/memory-eval/t1e-discordance-prestudy.ts
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { admittedOf, MissingRerankScore, type FunnelAdmitted } from "../../src/core/memory/funnel-admission.js";
import { planStepPairs, stepPassages } from "../../src/core/memory/funnel-budget.js";
import { catalogRowsAt, groupsOf, type CatalogRow } from "../../src/core/memory/funnel-groups.js";
import { runFunnel, type FunnelCaseInput } from "../../src/core/memory/funnel-run.js";
import { selectFinalists, selectRerankPassages } from "../../src/core/memory/funnel-selection.js";
import { lexicalRanksByThread, semanticHitsForChannels } from "../../src/core/memory/hybrid-ranking.js";
import { consolidateThreads, rerankingEvidence, semanticRerankingDocument } from "../../src/core/memory/semantic-ranking.js";
import type { MemorySearchChannels } from "../../src/core/memory/types.js";
import { asSearchRecord, type CaptureFile, type CapturedCase, type CapturedRecord } from "./capture-types.js";
import type { EvalCase, EvalDataset } from "./dataset.js";
import { funnelConfigOf } from "./funnel-variants.js";
import { caseContribution, type CaseInput } from "./metrics.js";
import { rerankPairKey } from "./recording-providers.js";
import { cachedReplayProviders, channelsOfCaptured, recordsById, replayCase } from "./replay.js";
import type { VariantResult } from "./variants.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const OUTPUT_FILE = path.join(ROOT, ".marc", "cache", "memory-eval-e3", "t1g", "t1g-rank-m0.json");
const BUDGET = 232;
const K_GRID = [8, 10, 12, 15, 20, 25, 30];
const ALLOWANCES = [{ name: "first-step", allowance: Math.floor(BUDGET / 2) }, { name: "depth0", allowance: BUDGET }];
const CORPORA = [
  { corpus: "marc", captureDir: ".marc/cache/memory-eval/marc/1b68a7e3f4e6", datasetPath: "scripts/memory-eval/datasets/marc.json" },
  { corpus: "ledgerline-en", captureDir: ".marc/cache/memory-eval/ledgerline-en/5ae0f660527c", datasetPath: "scripts/memory-eval/datasets/ledgerline-en.json" }
];

type Planned = { groupId: string; recordIds: string[] };
type CompleteSide = { complete: true; top1: number; abstains: boolean; admittedIds: string[] };
type Side = CompleteSide | { complete: false; reason: string };
type CaseRow = { caseId: string; style: string; positive: boolean; m0: Side; funnel: Record<string, Side>; allPassages: Side };
type Summary = Record<string, unknown>;

/** Steps checked against runFunnel, where its budget rule holds (3K <= floor(allowance / 2)). */
const crossChecks = { passed: 0 };

function recordOf(records: ReadonlyMap<string, CapturedRecord>, recordId: string): CapturedRecord {
  const record = records.get(recordId);
  if (record === undefined) throw new Error(`Capture has no record ${recordId}.`);
  return record;
}

function depthZeroOf(input: FunnelCaseInput): MemorySearchChannels {
  const channels = input.channelsByDepth[0];
  if (channels === undefined) throw new Error("The case has no depth 0 channels.");
  return channels;
}

/** The funnel input of a case from its depth 0 channels, with the channel score as the query cosine (see the approximations). */
function funnelInputOf(captured: CapturedCase, records: ReadonlyMap<string, CapturedRecord>): FunnelCaseInput {
  const query = captured.interpretation.effectiveQuery;
  const raw = captured.channels[query];
  if (raw === undefined) throw new Error(`Capture case ${captured.id} has no channels for its effective query.`);
  const channels = channelsOfCaptured(raw, records);
  const channelScores = new Map(semanticHitsForChannels(channels).map((hit) => [hit.record.recordId, hit.score] as const));
  const members = [...channelScores].map(([recordId, score]): CatalogRow & { threadId: string } => {
    const record = recordOf(records, recordId);
    const value = Math.max(-1, Math.min(1, score));
    const kind = record.kind === "identity" ? "identity" : "passage";
    return { recordId, threadId: record.threadId, kind, layer: record.layer ?? 0, vector: [value, Math.sqrt(1 - value * value)] };
  });
  const catalog = new Map<string, CatalogRow[]>();
  for (const { threadId, ...row } of members) catalog.set(threadId, [...(catalog.get(threadId) ?? []), row]);
  const scores = new Map<string, number>();
  for (const member of members) {
    const key = rerankPairKey(query, semanticRerankingDocument(asSearchRecord(recordOf(records, member.recordId))));
    const score: number | undefined = captured.rerankScores[key];
    if (score !== undefined) scores.set(member.recordId, score);
  }
  const vectors = new Map(members.map((member) => [member.recordId, member.vector] as const));
  const ftsRecordIds = new Set(channels.lexical.map((hit) => hit.record.recordId));
  return { queryVector: [1, 0], channelsByDepth: { 0: channels }, vectors, catalog, scores, ftsRecordIds, budget: BUDGET, k: 0, mode: "cosine" };
}

/** The planned passages of a funnel step: the K finalists, with the passages that the budget and the cosine keep and that are usable. */
function plannedOf(input: FunnelCaseInput, allowance: number): Planned[] {
  const groups = groupsOf(depthZeroOf(input), input.vectors);
  const finalists = selectFinalists(groups, input.k).map((groupId) => ({
    groupId,
    recordIds: selectRerankPassages(input.queryVector, catalogRowsAt(input.catalog, groupId, 0), stepPassages(allowance, input.k), input.mode, input.ftsRecordIds)
  }));
  const plan = planStepPairs({ finalists, cached: new Set<string>(), allowance });
  const usable = new Set([...plan.scored, ...plan.cached]);
  return finalists
    .filter((finalist) => plan.keptFinalists.includes(finalist.groupId))
    .map((finalist) => ({ groupId: finalist.groupId, recordIds: finalist.recordIds.filter((id) => usable.has(id)) }));
}

/** M0 as a plan: every group with the evidence that M0 reranks for it (its consolidated passages, or its identity alone). */
function consolidatedPlanOf(input: FunnelCaseInput): Planned[] {
  return groupsOf(depthZeroOf(input), input.vectors).map((group) => ({
    groupId: group.groupId,
    recordIds: consolidateThreads(group.identity === undefined ? group.passages : [group.identity, ...group.passages]).flatMap((candidate) =>
      rerankingEvidence(candidate).map((item) => item.record.recordId)
    )
  }));
}

/** The admitted groups of a planned step: the production admission, admittedOf. */
function admittedOfStep(input: FunnelCaseInput, planned: readonly Planned[]): FunnelAdmitted[] {
  const channels = depthZeroOf(input);
  const byId = new Map(groupsOf(channels, input.vectors).map((group) => [group.groupId, group] as const));
  return admittedOf(planned, byId, input.scores, lexicalRanksByThread(channels));
}

function keyOf(list: readonly FunnelAdmitted[]): string {
  return JSON.stringify(list.map((item) => [item.groupId, item.eligibility, item.hybridScore, item.chosenPassages]));
}

/** One funnel step with its allowance, checked against runFunnel wherever its budget rule holds. */
function funnelAdmitted(input: FunnelCaseInput, allowance: number): FunnelAdmitted[] {
  const admitted = admittedOfStep(input, plannedOf(input, allowance));
  if (3 * input.k > Math.floor(allowance / 2)) return admitted;
  const whole = runFunnel({ ...input, budget: allowance }, funnelConfigOf("FUNNEL_D0")).admitted;
  if (keyOf(admitted) !== keyOf(whole)) throw new Error(`The step differs from runFunnel at K = ${input.k}.`);
  crossChecks.passed += 1;
  return admitted;
}

function sideOf(evalCase: EvalCase, results: VariantResult[]): CompleteSide {
  const input: CaseInput = { caseId: evalCase.id, family: evalCase.family, style: evalCase.style, judgments: evalCase.judgments, results };
  const contribution = caseContribution(input);
  return {
    complete: true,
    top1: contribution.top1Target.num,
    abstains: contribution.abstentionCorrect.num === 1,
    admittedIds: results.filter((item) => item.admitted).map((item) => item.threadId)
  };
}

/** A missing score makes the case incomplete for this step; any other error is raised. */
function funnelSideOf(evalCase: EvalCase, run: () => FunnelAdmitted[]): Side {
  try {
    const admitted = run();
    return sideOf(evalCase, admitted.map((item) => ({ threadId: item.groupId, score: item.hybridScore, admitted: true })));
  } catch (error) {
    if (error instanceof MissingRerankScore) return { complete: false, reason: "missing-score" };
    throw error;
  }
}

async function m0SideOf(captured: CapturedCase, evalCase: EvalCase, capture: CaptureFile, records: ReadonlyMap<string, CapturedRecord>): Promise<Side> {
  if (captured.incomplete !== undefined) return { complete: false, reason: captured.incomplete.reason };
  const replay = await replayCase({ captured, judgments: evalCase.judgments, records, providers: cachedReplayProviders(captured, capture), variantIds: ["M0"] });
  const output = replay.variants[0];
  if (output === undefined) throw new Error(`The replay of ${captured.id} has no M0 output.`);
  if (output.incomplete !== undefined) return { complete: false, reason: output.incomplete.reason };
  return sideOf(evalCase, output.results);
}

async function caseRowOf(captured: CapturedCase, evalCase: EvalCase, capture: CaptureFile, records: ReadonlyMap<string, CapturedRecord>): Promise<CaseRow> {
  const incomplete: Side = { complete: false, reason: captured.incomplete?.reason ?? "unknown" };
  const input = captured.incomplete === undefined ? funnelInputOf(captured, records) : undefined;
  const funnel: Record<string, Side> = {};
  for (const allowance of ALLOWANCES) {
    for (const k of K_GRID) {
      funnel[`${allowance.name}@${k}`] = input === undefined ? incomplete : funnelSideOf(evalCase, () => funnelAdmitted({ ...input, k }, allowance.allowance));
    }
  }
  const allPassages: Side = input === undefined ? incomplete : funnelSideOf(evalCase, () => admittedOfStep(input, consolidatedPlanOf(input)));
  return { caseId: captured.id, style: evalCase.style, positive: evalCase.style !== "negative", m0: await m0SideOf(captured, evalCase, capture, records), funnel, allPassages };
}

/** What a case changes between M0 and the funnel: the top-1 target (positives), the abstention (negatives), the admitted set. */
function changesOf(positive: boolean, m0: CompleteSide, funnel: CompleteSide): string[] {
  const changes: string[] = [];
  if (positive && m0.top1 !== funnel.top1) changes.push(m0.top1 === 1 ? "top1-b" : "top1-c");
  if (!positive && m0.abstains !== funnel.abstains) changes.push(m0.abstains ? "abstention-lost" : "abstention-gained");
  if ([...m0.admittedIds].sort().join("|") !== [...funnel.admittedIds].sort().join("|")) changes.push("admitted-set");
  return changes;
}

function summaryOf(rows: CaseRow[], allowance: { name: string; allowance: number }, k: number): Summary {
  const key = `${allowance.name}@${k}`;
  const pairs = rows.flatMap((row) => {
    const funnel = row.funnel[key];
    return funnel === undefined || !row.m0.complete || !funnel.complete ? [] : [{ row, m0: row.m0, funnel }];
  });
  const changes = pairs.map((pair) => ({ caseId: pair.row.caseId, style: pair.row.style, changes: changesOf(pair.row.positive, pair.m0, pair.funnel) }));
  const count = (kind: string): number => changes.filter((item) => item.changes.includes(kind)).length;
  const positives = pairs.filter((pair) => pair.row.positive);
  const completeOf = (positive: boolean): number => rows.filter((row) => row.positive === positive && row.funnel[key]?.complete === true).length;
  return {
    allocation: allowance.name,
    allowance: allowance.allowance,
    k,
    P: stepPassages(allowance.allowance, k),
    funnelComplete: { positives: completeOf(true), negatives: completeOf(false) },
    bothComplete: { positives: positives.length, negatives: pairs.length - positives.length },
    top1: { b: count("top1-b"), c: count("top1-c"), bPlusC: count("top1-b") + count("top1-c"), m0Hits: positives.filter((pair) => pair.m0.top1 === 1).length, funnelHits: positives.filter((pair) => pair.funnel.top1 === 1).length },
    abstention: { lost: count("abstention-lost"), gained: count("abstention-gained") },
    admittedSetChanged: count("admitted-set"),
    discordant: changes.filter((item) => item.changes.length > 0)
  };
}

/** The M0 check: the funnel step over every group with its consolidated passages, against the M0 of each case. */
function validationOf(rows: CaseRow[]): Summary {
  const pairs = rows.flatMap((row) => (!row.m0.complete || !row.allPassages.complete ? [] : [{ m0: row.m0, all: row.allPassages }]));
  const sameSet = pairs.filter((pair) => [...pair.m0.admittedIds].sort().join("|") === [...pair.all.admittedIds].sort().join("|")).length;
  const sameTop1 = pairs.filter((pair) => pair.m0.admittedIds[0] === pair.all.admittedIds[0]).length;
  return { cases: pairs.length, sameAdmittedSet: sameSet, sameTop1 };
}

async function runCorpus(spec: (typeof CORPORA)[number]): Promise<Summary> {
  const capture = JSON.parse(await fs.readFile(path.join(ROOT, spec.captureDir, "capture.json"), "utf8")) as CaptureFile;
  const dataset = JSON.parse(await fs.readFile(path.join(ROOT, spec.datasetPath), "utf8")) as EvalDataset;
  const records = recordsById(capture.records);
  const byId = new Map(dataset.cases.map((item) => [item.id, item] as const));
  const rows: CaseRow[] = [];
  for (const captured of capture.cases) {
    const evalCase = byId.get(captured.id);
    if (evalCase === undefined) throw new Error(`The dataset has no case ${captured.id}.`);
    rows.push(await caseRowOf(captured, evalCase, capture, records));
  }
  return {
    corpus: spec.corpus,
    captureId: capture.captureId,
    cases: rows.length,
    validation: validationOf(rows),
    configs: ALLOWANCES.flatMap((allowance) => K_GRID.map((k) => summaryOf(rows, allowance, k)))
  };
}

async function main(): Promise<void> {
  const corpora: Summary[] = [];
  for (const spec of CORPORA) corpora.push(await runCorpus(spec));
  const output = { budget: BUDGET, kGrid: K_GRID, groupCrossChecks: crossChecks.passed, corpora };
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
  console.error(`results written to ${OUTPUT_FILE}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
