/**
 * E3 T0 pre-study of the funnel budget. Four commands, each writing one JSON file under
 * .marc/cache/memory-eval-e3/t0/. Nothing is written inside the capture folder, and the
 * production manifest is only read.
 *
 *   throughput  reranker pairs per second, original order and size order, production model
 *   latency     live M0 on the current code: 30 cases by id, 1 warm-up and 3 timed recalls,
 *               with the reranker time, the pairs and the query interpretation timed inside
 *               each recall
 *   curve       exploratory recall of relevant groups by K, replayed without models
 *   assemble    f_passo, B, the viable K grid and K_max from the files above
 *
 * Run them one at a time, in the order above: the measurements share the CPU and the
 * reranker worker, so they must not overlap.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkspaceInfo } from "../../src/core/types.js";
import { DEFAULT_RERANK_BATCH_SIZE } from "../../src/core/memory/model-config.js";
import { LocalEmbeddingProvider } from "../../src/core/memory/local-provider.js";
import { LocalQueryInterpretationProvider } from "../../src/core/memory/local-query-interpreter.js";
import { LocalRerankingProvider } from "../../src/core/memory/local-reranker.js";
import {
  fusionWithoutRerankerScore,
  lexicalRanksByThread,
  lexicalScoreOfRanks,
  rankHybridMemoryCandidates,
  semanticHitsForChannels,
  type LexicalRanks
} from "../../src/core/memory/hybrid-ranking.js";
import { recallMemoryInWorkspace } from "../../src/core/memory/operations.js";
import {
  consolidateThreads,
  denseRanksByKind,
  rerankerFusionScore,
  semanticRerankingDocument,
  SEMANTIC_ELIGIBILITY_THRESHOLD,
  type RankedMemoryThread,
  type ThreadCandidate
} from "../../src/core/memory/semantic-ranking.js";
import type { MemoryLayer } from "../../src/core/memory/sources/contract.js";
import { INDEXED_LAYERS } from "../../src/core/memory/sources/index.js";
import type { RerankOrder } from "../../src/core/memory/rerank-order.js";
import type {
  MemorySearchChannels,
  MemorySearchDepth
} from "../../src/core/memory/types.js";
import { getWorkspaceInfo } from "../../src/core/workspace.js";
import { BASELINE_DEPTH as CAPTURE_DEPTH } from "./capture-channels.js";
import { CachedRerankingProvider } from "./cached-providers.js";
import {
  computeCaptureFingerprint,
  disposeProviders,
  openCaptureContext
} from "./capture.js";
import { E2_CAPTURE_CHANNELS } from "./capture-fingerprint.js";
import type {
  CapturedCase,
  CapturedRecord,
  CaptureContext,
  CaptureFile,
  CaptureProviders
} from "./capture-types.js";
import {
  configuredDocumentsOf,
  corpusContentDigest,
  withTemporaryWorkspace,
  type CorpusSource
} from "./corpus.js";
import type { EvalCase, EvalDataset } from "./dataset.js";
import { medianOf } from "./calibration.js";
import { latencySummary } from "./metrics.js";
import { channelsOfCaptured } from "./replay.js";
import {
  adoptedOrderingOf,
  bestIndexOf,
  curveFinalists,
  gainPercentOf,
  impliedPairsPerSecond,
  maxAbsoluteDifference,
  maxViableK,
  PAIR_ORDERINGS,
  passSecondsOf,
  recallCountOf,
  rerankBudgetOf,
  sameSequence,
  scoresInOriginalOrder,
  T0_K_GRID,
  viableKs,
  type CurveGroup,
  type OrderingMode,
  type RecallCount
} from "./t0-funnel-math.js";

const MEMORY_EVAL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(MEMORY_EVAL_DIR, "..", "..");
const CAPTURE_ID = "1b68a7e3f4e6";
const CAPTURE_PATH = path.join(
  REPOSITORY_ROOT,
  ".marc",
  "cache",
  "memory-eval",
  "marc",
  CAPTURE_ID,
  "capture.json"
);
const OUTPUT_DIR = path.join(
  REPOSITORY_ROOT,
  ".marc",
  "cache",
  "memory-eval-e3",
  "t0"
);
const DATASET_PATH = path.join(MEMORY_EVAL_DIR, "datasets", "marc.json");
const PINNED_PATH = path.join(MEMORY_EVAL_DIR, "datasets", "marc.corpus.json");
const PRODUCTION_MANIFEST_PATH = path.join(
  REPOSITORY_ROOT,
  ".marc",
  "memory",
  "manifest.json"
);
const THREADS_ROOT = path.join(REPOSITORY_ROOT, ".marc", "threads");
const RULES_PATH = path.join(REPOSITORY_ROOT, ".marc", "RULES.md");

/** Cases of the throughput sample: the first ones by id, whose pairs are the real M0 pairs. */
const THROUGHPUT_CASE_COUNT = 8;
/** Cases of the live latency subset: the first ones by id. */
const LATENCY_CASE_COUNT = 30;
/** Timed recalls per case, after one warm-up recall. */
const TIMED_RECALLS_PER_CASE = 3;
/** Result limit of the recall, the same as measureLatency in capture-channels.ts. */
const LATENCY_RECALL_LIMIT = 5;
/** Grade from which a group counts as relevant for the K curve. */
const RELEVANT_GRADE = 2;
/** Original, size, size, original: each mode is measured twice, the second time in reverse. */
const THROUGHPUT_PASSES: readonly OrderingMode[] = [
  "original",
  "bySize",
  "bySize",
  "original"
];

type Inputs = {
  capture: CaptureFile;
  dataset: EvalDataset;
  threadIds: string[];
};

type ProductionReplay = {
  caseId: string;
  effectiveQuery: string;
  channels: MemorySearchChannels;
  ranked: RankedMemoryThread[];
  /** Documents of the one reranker call that M0 makes for the case, in production order. */
  documents: string[];
};

type PassResult = {
  mode: OrderingMode;
  pairs: number;
  seconds: number;
  scoresByCase: number[][];
};

/** What the probe of one live recall records while the recall runs. */
type RecallProbe = {
  startedAt: number;
  embedAt?: number;
  rerankMs: number;
  rerankCalls: number;
  rerankPairs: number;
  interpretMs: number;
};

export type ProbeHolder = { current?: RecallProbe };

/** One timed live recall. */
export type RecallSample = {
  e2eMs: number;
  /** From the start of the recall to the query embedding: status, manifest and interpretation. */
  preEmbedMs: number;
  rerankMs: number;
  pairs: number;
  /** Time spent in the LFM interpreter alone, for information. */
  interpretMs: number;
};

type LiveCase = {
  id: string;
  pairsReplay: number;
  pairsMatch: boolean;
  warmup: RecallSample;
  samples: RecallSample[];
};

type ThroughputFile = {
  pairsPerSecond: { original: number; bySize: number };
  gainPercent: number;
};

type LiveLatencyFile = {
  cases: LiveCase[];
};

type CurveFile = {
  perCase: Array<{ id: string; pairs: number }>;
};

/** Reranker of the captured scores that keeps the documents of every call, for the replay. */
class RecordingCachedReranker extends CachedRerankingProvider {
  readonly calls: Array<{ query: string; documents: string[] }> = [];

  override rerank(
    query: string,
    documents: string[],
    batchSize: number
  ): Promise<number[]> {
    this.calls.push({ query, documents: [...documents] });
    return super.rerank(query, documents, batchSize);
  }
}

function sortedCases(cases: readonly EvalCase[]): EvalCase[] {
  return [...cases].sort((left, right) =>
    left.id < right.id ? -1 : Number(left.id > right.id)
  );
}

async function readInputs(): Promise<Inputs> {
  const capture = JSON.parse(
    await fs.readFile(CAPTURE_PATH, "utf8")
  ) as CaptureFile;
  const dataset = JSON.parse(
    await fs.readFile(DATASET_PATH, "utf8")
  ) as EvalDataset;
  const pinned = JSON.parse(await fs.readFile(PINNED_PATH, "utf8")) as {
    threadIds: string[];
  };
  if (capture.captureId !== CAPTURE_ID)
    throw new Error(
      `${CAPTURE_PATH} belongs to captureId ${capture.captureId}, not ${CAPTURE_ID}.`
    );
  return { capture, dataset, threadIds: pinned.threadIds };
}

function recordsOf(capture: CaptureFile): Map<string, CapturedRecord> {
  return new Map(
    capture.records.map((record) => [record.recordId, record] as const)
  );
}

function capturedCaseOf(capture: CaptureFile, caseId: string): CapturedCase {
  const found = capture.cases.find((item) => item.id === caseId);
  if (found === undefined)
    throw new Error(`The capture has no case ${caseId}.`);
  return found;
}

/**
 * Replays one case through the production ranking with the captured reranker scores. No
 * model runs. The documents of the reranker call are the exact M0 input of the case.
 */
async function replayCase(
  capture: CaptureFile,
  captured: CapturedCase,
  records: ReadonlyMap<string, CapturedRecord>
): Promise<ProductionReplay> {
  const effectiveQuery = captured.interpretation.effectiveQuery;
  const capturedChannels = captured.channels[effectiveQuery];
  if (capturedChannels === undefined)
    throw new Error(`Case ${captured.id} has no channels for its effective query.`);
  const channels = channelsOfCaptured(capturedChannels, records);
  const reranker = new RecordingCachedReranker(
    capture.providers.reranker,
    new Map(Object.entries(captured.rerankScores))
  );
  const ranked = await rankHybridMemoryCandidates(
    effectiveQuery,
    channels,
    reranker
  );
  if (reranker.calls.length > 1)
    throw new Error(
      `Case ${captured.id} made ${reranker.calls.length} reranker calls; M0 makes one.`
    );
  const call = reranker.calls[0];
  if (call !== undefined && call.query !== effectiveQuery)
    throw new Error(`Case ${captured.id} reranked a different query.`);
  return {
    caseId: captured.id,
    effectiveQuery,
    channels,
    ranked,
    documents: call?.documents ?? []
  };
}

/** The records that M0 sends to the reranker for one candidate: its passages, or its identity. */
function rerankingRecordsOf(candidate: ThreadCandidate) {
  if (candidate.passages.length > 0) return candidate.passages;
  if (candidate.identity === undefined) return [];
  return [candidate.identity];
}

function groupOf(
  candidate: ThreadCandidate,
  lexicalRanks: LexicalRanks
): CurveGroup {
  const representative = candidate.identity ?? candidate.passages[0];
  if (representative === undefined)
    throw new Error("A candidate group has no evidence.");
  const groupId = representative.record.threadId;
  const bestPassageRank =
    candidate.passages.length > 0
      ? Math.min(...candidate.passages.map((passage) => passage.denseRank))
      : undefined;
  return {
    groupId,
    recordId: representative.record.recordId,
    fusion: fusionWithoutRerankerScore(
      candidate.identity?.denseRank,
      bestPassageRank,
      lexicalRanks.get(groupId)
    ),
    bestPassageRank
  };
}

type CaseGroups = {
  groups: CurveGroup[];
  lexicalRanks: LexicalRanks;
  /** Documents rebuilt with the real semanticHitsForChannels, denseRanksByKind and consolidateThreads. */
  reconstructedDocuments: string[];
};

function caseGroupsOf(channels: MemorySearchChannels): CaseGroups {
  const candidates = consolidateThreads(
    denseRanksByKind(semanticHitsForChannels(channels))
  );
  const lexicalRanks = lexicalRanksByThread(channels);
  return {
    groups: candidates.map((candidate) => groupOf(candidate, lexicalRanks)),
    lexicalRanks,
    reconstructedDocuments: candidates.flatMap((candidate) =>
      rerankingRecordsOf(candidate).map((evidence) =>
        semanticRerankingDocument(evidence.record)
      )
    )
  };
}

type OrderCheck = { eligible: number; matches: boolean };

/**
 * The eligible threads of production, in production order, against the order that the shared
 * functions give: fusionWithoutRerankerScore plus rerankerFusionScore, with the production
 * tie rules. The order is the same only when the shared functions match production.
 */
function orderCheckOf(
  ranked: readonly RankedMemoryThread[],
  lexicalRanks: LexicalRanks
): OrderCheck {
  const eligible = ranked.filter(
    (thread) => thread.semanticEligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD
  );
  const production = eligible.map((thread) => thread.evidence.record.threadId);
  const shared = eligible
    .map((thread) => {
      const threadId = thread.evidence.record.threadId;
      const lexical = lexicalRanks.get(threadId);
      const fusion = fusionWithoutRerankerScore(
        thread.identityRank,
        thread.passageRank,
        lexical
      );
      return {
        threadId,
        hybrid: fusion + rerankerFusionScore(thread.rerankerRank),
        lexical: lexicalScoreOfRanks(lexical)
      };
    })
    .sort(
      (left, right) =>
        right.hybrid - left.hybrid ||
        right.lexical - left.lexical ||
        compareText(left.threadId, right.threadId)
    )
    .map((item) => item.threadId);
  return { eligible: eligible.length, matches: sameSequence(production, shared) };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : Number(left > right);
}

async function writeJson(name: string, value: unknown): Promise<string> {
  const target = path.join(OUTPUT_DIR, name);
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
}

async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(
    await fs.readFile(path.join(OUTPUT_DIR, name), "utf8")
  ) as T;
}

export function providersOf(modelInfo: WorkspaceInfo): CaptureProviders {
  return {
    embedding: new LocalEmbeddingProvider(modelInfo),
    reranker: new LocalRerankingProvider(modelInfo),
    interpreter: new LocalQueryInterpretationProvider(modelInfo)
  };
}

/** Throughput of a set of passes: total pairs over total seconds. */
function throughputOf(passes: readonly PassResult[]): number {
  const pairs = passes.reduce((total, pass) => total + pass.pairs, 0);
  const seconds = passes.reduce((total, pass) => total + pass.seconds, 0);
  return pairs / seconds;
}

async function timedPass(
  reranker: LocalRerankingProvider,
  replays: readonly ProductionReplay[],
  mode: OrderingMode
): Promise<PassResult> {
  const order = PAIR_ORDERINGS[mode];
  const scoresByCase: number[][] = [];
  let seconds = 0;
  let pairs = 0;
  for (const replay of replays) {
    const sendOrder = order(replay.documents);
    const sent = sendOrder.map((index) => replay.documents[index] ?? "");
    const started = performance.now();
    const scores = await reranker.rerank(
      replay.effectiveQuery,
      sent,
      DEFAULT_RERANK_BATCH_SIZE
    );
    seconds += (performance.now() - started) / 1000;
    pairs += sent.length;
    scoresByCase.push(scoresInOriginalOrder(sendOrder, scores));
  }
  console.error(`pass ${mode}: ${pairs} pairs in ${seconds.toFixed(1)} s`);
  return { mode, pairs, seconds, scoresByCase };
}

/** Largest per-case difference between two passes, and the cases whose best document agrees. */
function scoreAgreementOf(left: PassResult, right: PassResult) {
  const maxAbsoluteDelta = left.scoresByCase.reduce(
    (max, scores, index) =>
      Math.max(
        max,
        maxAbsoluteDifference(scores, right.scoresByCase[index] ?? [])
      ),
    0
  );
  const bestIndexAgreement = left.scoresByCase.filter(
    (scores, index) =>
      bestIndexOf(scores) === bestIndexOf(right.scoresByCase[index] ?? [])
  ).length;
  return {
    maxAbsoluteDelta,
    bestIndexAgreement,
    cases: left.scoresByCase.length
  };
}

async function runThroughput(): Promise<void> {
  const { capture, dataset } = await readInputs();
  const records = recordsOf(capture);
  const selected = sortedCases(dataset.cases).slice(0, THROUGHPUT_CASE_COUNT);
  const replays: ProductionReplay[] = [];
  for (const evalCase of selected) {
    replays.push(
      await replayCase(capture, capturedCaseOf(capture, evalCase.id), records)
    );
  }
  const emptyReplay = replays.find((replay) => replay.documents.length === 0);
  if (emptyReplay !== undefined)
    throw new Error(`Case ${emptyReplay.caseId} sends no pairs to the reranker.`);
  const modelInfo = await getWorkspaceInfo(REPOSITORY_ROOT);
  const reranker = new LocalRerankingProvider(modelInfo);
  const measuredAt = new Date().toISOString();
  const freeMemStartBytes = os.freemem();
  await reranker.prepare();
  const warmup = replays[0];
  if (warmup === undefined) throw new Error("The throughput sample is empty.");
  await reranker.rerank(
    warmup.effectiveQuery,
    warmup.documents,
    DEFAULT_RERANK_BATCH_SIZE
  );
  const passes: PassResult[] = [];
  for (const mode of THROUGHPUT_PASSES) {
    passes.push(await timedPass(reranker, replays, mode));
  }
  await reranker.dispose();
  const originalPasses = passes.filter((pass) => pass.mode === "original");
  const sizePasses = passes.filter((pass) => pass.mode === "bySize");
  const original = throughputOf(originalPasses);
  const bySize = throughputOf(sizePasses);
  const gainPercent = gainPercentOf(original, bySize);
  const firstOriginal = originalPasses[0];
  const firstSize = sizePasses[0];
  if (firstOriginal === undefined || firstSize === undefined)
    throw new Error("Both orderings need a pass.");
  const target = await writeJson("throughput-t0.json", {
    schemaVersion: 1,
    captureId: CAPTURE_ID,
    measuredAt,
    batchSize: DEFAULT_RERANK_BATCH_SIZE,
    cases: replays.map((replay) => ({
      id: replay.caseId,
      pairs: replay.documents.length
    })),
    passes: passes.map((pass) => ({
      mode: pass.mode,
      pairs: pass.pairs,
      seconds: pass.seconds,
      pairsPerSecond: pass.pairs / pass.seconds
    })),
    pairsPerSecond: { original, bySize },
    gainPercent,
    adoptedOrdering: adoptedOrderingOf(gainPercent),
    scoreAgreement: scoreAgreementOf(firstOriginal, firstSize),
    memory: {
      freeMemStartBytes,
      freeMemEndBytes: os.freemem(),
      totalMemBytes: os.totalmem()
    },
    host: {
      cpuModel: os.cpus()[0]?.model ?? "unknown",
      cpuCount: os.cpus().length
    }
  });
  console.error(`throughput written to ${target}`);
}

function markEmbed(probe: RecallProbe | undefined): void {
  if (probe === undefined || probe.embedAt !== undefined) return;
  probe.embedAt = performance.now();
}

function addRerank(
  probe: RecallProbe | undefined,
  milliseconds: number,
  pairs: number
): void {
  if (probe === undefined) return;
  probe.rerankMs += milliseconds;
  probe.rerankCalls += 1;
  probe.rerankPairs += pairs;
}

function addInterpretation(
  probe: RecallProbe | undefined,
  milliseconds: number
): void {
  if (probe === undefined) return;
  probe.interpretMs += milliseconds;
}

/** A provider that inherits every method of the base and overrides only the timed ones. */
function overriding<T extends object>(base: T, overrides: Partial<T>): T {
  return Object.assign(Object.create(base) as T, overrides);
}

/**
 * The production providers with timing overrides. Each override forwards to the base
 * provider, so the work is the production work; only the clock and the counters are added.
 */
export function instrumentedProviders(
  base: CaptureProviders,
  holder: ProbeHolder,
  order?: RerankOrder
): CaptureProviders {
  return {
    embedding: overriding(base.embedding, {
      embedQuery: async (text: string) => {
        markEmbed(holder.current);
        return base.embedding.embedQuery(text);
      }
    }),
    reranker: overriding(base.reranker, {
      rerank: async (
        query: string,
        documents: string[],
        batchSize?: number
      ) => {
        const started = performance.now();
        // An undefined order keeps the production default (length); M0 reference passes "input".
        const scores = await base.reranker.rerank(
          query,
          documents,
          batchSize ?? DEFAULT_RERANK_BATCH_SIZE,
          order
        );
        addRerank(holder.current, performance.now() - started, documents.length);
        return scores;
      }
    }),
    interpreter: overriding(base.interpreter, {
      selectVariant: async (input) => {
        const started = performance.now();
        const selected = await base.interpreter.selectVariant(input);
        addInterpretation(holder.current, performance.now() - started);
        return selected;
      }
    })
  };
}

/** One live recall, timed the way measureLatency times it, with its probe. */
export async function probedRecall(
  context: CaptureContext,
  providers: CaptureProviders,
  holder: ProbeHolder,
  evalCase: EvalCase,
  depth: MemorySearchDepth = CAPTURE_DEPTH
): Promise<RecallSample> {
  return probedCall(holder, evalCase.id, () =>
    recallMemoryInWorkspace(context.info, {
      query: evalCase.query,
      queryMode: evalCase.queryMode,
      limit: LATENCY_RECALL_LIMIT,
      depth,
      provider: providers.embedding,
      reranker: providers.reranker,
      interpreter: providers.interpreter,
      store: context.store
    })
  );
}

/**
 * Times one call that goes through instrumented providers, with the probe of the recall: the end-to-end time,
 * the time to the query embedding, the rerank time and the pairs. The label names the call in the error.
 */
export async function probedCall(
  holder: ProbeHolder,
  label: string,
  run: () => Promise<unknown>
): Promise<RecallSample> {
  const probe: RecallProbe = {
    startedAt: performance.now(),
    rerankMs: 0,
    rerankCalls: 0,
    rerankPairs: 0,
    interpretMs: 0
  };
  holder.current = probe;
  await run();
  const e2eMs = performance.now() - probe.startedAt;
  holder.current = undefined;
  if (probe.embedAt === undefined)
    throw new Error(`The recall of ${label} never embedded the query.`);
  return {
    e2eMs,
    preEmbedMs: probe.embedAt - probe.startedAt,
    rerankMs: probe.rerankMs,
    pairs: probe.rerankPairs,
    interpretMs: probe.interpretMs
  };
}

async function readReplayPairs(): Promise<Map<string, number>> {
  const curve = await readJson<CurveFile>("curve-t0.json");
  return new Map(curve.perCase.map((item) => [item.id, item.pairs] as const));
}

/** The three paths of the T5 latency measurement, interleaved per case. */
type E2EPath = "ui" | "m0" | "mcp2";

type E2EPathSpec = {
  name: E2EPath;
  context: CaptureContext;
  depth: MemorySearchDepth;
  providers: CaptureProviders;
};

/** The layers of the M0 reference copy: the order before E3 indexed layer 0 only. */
export const REFERENCE_LAYERS: readonly MemoryLayer[] = [0];

/**
 * The M0 reference of E3: a temporary copy that holds layer 0 only, with no production check. The M0 path of the
 * latency measurements opens its copy here, so that the preparation is the one the E3 measurement used.
 */
export async function openReferenceContext(
  info: WorkspaceInfo,
  providers: CaptureProviders,
  threadIds: readonly string[]
): Promise<CaptureContext> {
  return openCaptureContext({ info, providers, threadIds, layers: REFERENCE_LAYERS });
}

/**
 * The end-to-end latency after the activation of the layers, in one execution. Two temporary copies of the
 * pinned corpus: the reference copy holds layer 0 only and serves the M0 path (depth 0, input order, the order
 * before E3); the indexed copy holds INDEXED_LAYERS, the production default, and serves the UI path (depth 0,
 * length order) and the MCP path (depth 2, reported only). Per case: one warm-up of each path, then three
 * rounds in which each path runs once, so load falls on all three.
 */
async function runLatencyE2e(): Promise<void> {
  const { dataset, threadIds } = await readInputs();
  const source: CorpusSource = {
    threadsRoot: THREADS_ROOT,
    threadIds,
    rulesPath: RULES_PATH,
    documents: await configuredDocumentsOf({
      repositoryRoot: REPOSITORY_ROOT
    })
  };
  const corpusDigest = await corpusContentDigest(source);
  const replayPairs = await readReplayPairs();
  const selected = sortedCases(dataset.cases).slice(0, LATENCY_CASE_COUNT);
  const modelInfo = await getWorkspaceInfo(REPOSITORY_ROOT);
  const startedAt = new Date().toISOString();
  const freeMemStartBytes = os.freemem();
  const base = providersOf(modelInfo);
  const holder: ProbeHolder = {};
  const lengthProviders = instrumentedProviders(base, holder);
  const inputProviders = instrumentedProviders(base, holder, "input");
  const cases = await withTemporaryWorkspace(source, (referenceInfo) =>
    withTemporaryWorkspace(source, async (indexedInfo) => {
      // The M0 copy holds layer 0 only, so the production check (which compares the whole production
      // manifest) is not applied to it; the indexed copy is checked against production.
      const reference = await openReferenceContext(referenceInfo, base, threadIds);
      const indexed = await openCaptureContext({
        info: indexedInfo,
        providers: base,
        productionManifestPath: PRODUCTION_MANIFEST_PATH,
        threadIds,
        layers: INDEXED_LAYERS
      });
      const paths: E2EPathSpec[] = [
        { name: "ui", context: indexed, depth: 0, providers: lengthProviders },
        { name: "m0", context: reference, depth: 0, providers: inputProviders },
        { name: "mcp2", context: indexed, depth: 2, providers: lengthProviders }
      ];
      const results: E2ECase[] = [];
      for (const evalCase of selected) {
        const expected = replayPairs.get(evalCase.id);
        if (expected === undefined)
          throw new Error(`The curve has no pair count for ${evalCase.id}.`);
        const warmupSamples: Record<E2EPath, RecallSample | undefined> = {
          ui: undefined,
          m0: undefined,
          mcp2: undefined
        };
        for (const path of paths) {
          warmupSamples[path.name] = await probedRecall(
            path.context,
            path.providers,
            holder,
            evalCase,
            path.depth
          );
        }
        const samples: Record<E2EPath, RecallSample[]> = { ui: [], m0: [], mcp2: [] };
        for (let run = 0; run < TIMED_RECALLS_PER_CASE; run += 1) {
          for (const path of paths) {
            samples[path.name].push(
              await probedRecall(path.context, path.providers, holder, evalCase, path.depth)
            );
          }
        }
        results.push({
          id: evalCase.id,
          pairsReplay: expected,
          pairsMatch: {
            ui: [warmupSamples.ui, ...samples.ui].every((item) => item?.pairs === expected),
            m0: [warmupSamples.m0, ...samples.m0].every((item) => item?.pairs === expected)
          },
          warmup: warmupSamples,
          samples
        });
        console.error(
          `[${results.length}/${selected.length}] ${evalCase.id} median ui ${medianOf(samples.ui.map((item) => item.e2eMs)).toFixed(0)} ms, m0 ${medianOf(samples.m0.map((item) => item.e2eMs)).toFixed(0)} ms, mcp2 ${medianOf(samples.mcp2.map((item) => item.e2eMs)).toFixed(0)} ms`
        );
      }
      return results;
    })
  );
  await disposeProviders(base);
  const summaryOf = (name: E2EPath) =>
    latencySummary(cases.flatMap((item) => item.samples[name].map((sample) => sample.e2eMs)));
  const ui = summaryOf("ui");
  const m0 = summaryOf("m0");
  const mcp2 = summaryOf("mcp2");
  const ratio = ui.medianMs === null || m0.medianMs === null ? null : ui.medianMs / m0.medianMs;
  const target = await writeJson("latency-e2e-activation.json", {
    schemaVersion: 1,
    mode: "activation-end-to-end",
    note: "Layers 0, 1 and 2 activated. UI path and MCP depth-2 path on one copy indexed with INDEXED_LAYERS and checked against production; M0 reference on a copy indexed with layer 0 only, input order, not checked against production. One execution, interleaved per case.",
    corpusDigest,
    startedAt,
    finishedAt: new Date().toISOString(),
    subset: {
      rule: `first ${LATENCY_CASE_COUNT} cases by id, of ${dataset.cases.length}`,
      ids: selected.map((item) => item.id),
      totalCases: dataset.cases.length
    },
    protocol: {
      warmupPerPath: 1,
      timedPerPath: TIMED_RECALLS_PER_CASE,
      interleaving: "per case: warm-up ui, m0, mcp2; then three rounds of ui, m0, mcp2",
      limit: LATENCY_RECALL_LIMIT,
      paths: {
        ui: { depth: 0, rerankOrder: "length", layers: [...INDEXED_LAYERS] },
        m0: { depth: 0, rerankOrder: "input", layers: [...REFERENCE_LAYERS] },
        mcp2: { depth: 2, rerankOrder: "length", layers: [...INDEXED_LAYERS] }
      },
      copies: {
        indexed: { layers: [...INDEXED_LAYERS], productionCheck: "applied" },
        reference: { layers: [...REFERENCE_LAYERS], productionCheck: "not applied" }
      }
    },
    summary: {
      ui: { medianMs: ui.medianMs, p95Ms: ui.p95Ms, timedSamples: ui.samples },
      m0: { medianMs: m0.medianMs, p95Ms: m0.p95Ms, timedSamples: m0.samples },
      mcp2: { medianMs: mcp2.medianMs, p95Ms: mcp2.p95Ms, timedSamples: mcp2.samples },
      uiOverM0: ratio,
      gateUiOverM0: 1.2,
      gatePassed: ratio === null ? null : ratio <= 1.2,
      referenceP95Ms: 5000,
      pairsMismatchCases: {
        ui: cases.filter((item) => !item.pairsMatch.ui).map((item) => item.id),
        m0: cases.filter((item) => !item.pairsMatch.m0).map((item) => item.id)
      }
    },
    cases,
    memory: {
      totalMemBytes: os.totalmem(),
      freeMemStartBytes,
      freeMemEndBytes: os.freemem()
    }
  });
  console.error(`latency written to ${target}`);
}

type E2ECase = {
  id: string;
  pairsReplay: number;
  pairsMatch: { ui: boolean; m0: boolean };
  warmup: Record<E2EPath, RecallSample | undefined>;
  samples: Record<E2EPath, RecallSample[]>;
};

async function runLatency(): Promise<void> {
  if (process.argv[3] === "e2e") return runLatencyE2e();
  const { capture, dataset, threadIds } = await readInputs();
  const source: CorpusSource = {
    threadsRoot: THREADS_ROOT,
    threadIds,
    rulesPath: RULES_PATH,
    documents: await configuredDocumentsOf({
      repositoryRoot: REPOSITORY_ROOT
    })
  };
  const corpusDigest = await corpusContentDigest(source);
  const fingerprint = await computeCaptureFingerprint(
    dataset,
    REPOSITORY_ROOT,
    corpusDigest,
    undefined,
    E2_CAPTURE_CHANNELS
  );
  const replayPairs = await readReplayPairs();
  const selected = sortedCases(dataset.cases).slice(0, LATENCY_CASE_COUNT);
  const modelInfo = await getWorkspaceInfo(REPOSITORY_ROOT);
  const startedAt = new Date().toISOString();
  const freeMemStartBytes = os.freemem();
  const cases = await withTemporaryWorkspace(source, async (info) => {
    const base = providersOf(modelInfo);
    const holder: ProbeHolder = {};
    const providers = instrumentedProviders(base, holder);
    try {
      const context = await openCaptureContext({
        info,
        providers: base,
        productionManifestPath: PRODUCTION_MANIFEST_PATH,
        threadIds
      });
      const results: LiveCase[] = [];
      for (const evalCase of selected) {
        const expected = replayPairs.get(evalCase.id);
        if (expected === undefined)
          throw new Error(`The curve has no pair count for ${evalCase.id}.`);
        const warmup = await probedRecall(context, providers, holder, evalCase);
        const samples: RecallSample[] = [];
        for (let run = 0; run < TIMED_RECALLS_PER_CASE; run += 1) {
          samples.push(await probedRecall(context, providers, holder, evalCase));
        }
        const recalls = [warmup, ...samples];
        results.push({
          id: evalCase.id,
          pairsReplay: expected,
          pairsMatch: recalls.every((recall) => recall.pairs === expected),
          warmup,
          samples
        });
        console.error(
          `[${results.length}/${selected.length}] ${evalCase.id} median ${medianOf(samples.map((item) => item.e2eMs)).toFixed(0)} ms, pairs ${recalls.map((item) => item.pairs).join("/")} vs replay ${expected}`
        );
      }
      return results;
    } finally {
      await disposeProviders(base);
    }
  });
  const timed = cases.flatMap((item) => item.samples);
  const m0 = latencySummary(timed.map((sample) => sample.e2eMs));
  const target = await writeJson("latency-live-t0.json", {
    schemaVersion: 2,
    mode: "live-current-code",
    note: "M0 measured on the current code with the corpus pinned in marc.corpus.json. The captured records are not used here; the pairs of each recall are counted live and compared with the replay.",
    captureId: CAPTURE_ID,
    currentCaptureId: fingerprint.captureId,
    sameCaptureId: fingerprint.captureId === CAPTURE_ID,
    corpusDigest,
    startedAt,
    finishedAt: new Date().toISOString(),
    subset: {
      rule: `first ${LATENCY_CASE_COUNT} cases by id, of ${dataset.cases.length}`,
      ids: selected.map((item) => item.id),
      totalCases: dataset.cases.length
    },
    protocol: {
      warmupPerCase: 1,
      timedPerCase: TIMED_RECALLS_PER_CASE,
      limit: LATENCY_RECALL_LIMIT,
      depth: CAPTURE_DEPTH
    },
    summary: {
      m0MedianMs: m0.medianMs,
      m0P95Ms: m0.p95Ms,
      timedSamples: m0.samples,
      pairsMatchCases: cases.filter((item) => item.pairsMatch).length,
      pairsMismatchCases: cases
        .filter((item) => !item.pairsMatch)
        .map((item) => item.id)
    },
    cases,
    memory: {
      totalMemBytes: os.totalmem(),
      freeMemStartBytes,
      freeMemEndBytes: os.freemem()
    }
  });
  console.error(`latency written to ${target}`);
}

type CurveCase = {
  id: string;
  pairs: number;
  reconstructionMatches: boolean;
  candidates: number;
  relevantCandidates: number;
  order: OrderCheck;
  counts: RecallCount[];
};

async function runCurve(): Promise<void> {
  const { capture, dataset } = await readInputs();
  const records = recordsOf(capture);
  const perCase: CurveCase[] = [];
  for (const evalCase of sortedCases(dataset.cases)) {
    const replay = await replayCase(
      capture,
      capturedCaseOf(capture, evalCase.id),
      records
    );
    const groups = caseGroupsOf(replay.channels);
    const relevant = new Set(
      Object.entries(evalCase.judgments)
        .filter(([, grade]) => grade >= RELEVANT_GRADE)
        .map(([threadId]) => threadId)
    );
    const candidateIds = groups.groups.map((group) => group.groupId);
    perCase.push({
      id: evalCase.id,
      pairs: replay.documents.length,
      reconstructionMatches: sameSequence(
        replay.documents,
        groups.reconstructedDocuments
      ),
      candidates: candidateIds.length,
      relevantCandidates: recallCountOf(relevant, [], candidateIds).relevantTotal,
      order: orderCheckOf(replay.ranked, groups.lexicalRanks),
      counts: T0_K_GRID.map((k) =>
        recallCountOf(relevant, curveFinalists(groups.groups, k), candidateIds)
      )
    });
  }
  const curve = T0_K_GRID.map((k, index) => {
    const relevantFound = perCase.reduce(
      (total, item) => total + (item.counts[index]?.relevantFound ?? 0),
      0
    );
    const relevantTotal = perCase.reduce(
      (total, item) => total + (item.counts[index]?.relevantTotal ?? 0),
      0
    );
    return {
      k,
      relevantFound,
      relevantTotal,
      recall: relevantTotal === 0 ? null : relevantFound / relevantTotal
    };
  });
  const pairs = perCase.map((item) => item.pairs).sort((left, right) => left - right);
  // The output name is optional: the approved curve-t0.json stays untouched when another
  // name is given, so a re-run with the shared functions can be compared with it.
  const outputName = process.argv[3] ?? "curve-t0.json";
  const target = await writeJson(outputName, {
    schemaVersion: 3,
    captureId: CAPTURE_ID,
    depth: 0,
    note: "Exploratory curve: it does not choose K. Finalists use fusionWithoutRerankerScore from hybrid-ranking.ts.",
    curve,
    pairs: {
      median: medianOf(pairs),
      min: pairs[0],
      max: pairs[pairs.length - 1],
      cases: pairs.length
    },
    checks: {
      reconstructionMismatches: perCase
        .filter((item) => !item.reconstructionMatches)
        .map((item) => item.id),
      orderMatches: perCase.filter((item) => item.order.matches).length,
      orderCases: perCase.length,
      orderMismatches: perCase
        .filter((item) => !item.order.matches)
        .map((item) => item.id)
    },
    perCase: perCase.map((item) => ({
      id: item.id,
      pairs: item.pairs,
      candidates: item.candidates,
      relevantCandidates: item.relevantCandidates,
      eligible: item.order.eligible,
      reconstructionMatches: item.reconstructionMatches
    }))
  });
  console.error(`curve written to ${target}`);
}

/**
 * B from the live M0 (D1) and f_passo from the measured reranker time (D2). The pairs
 * must match the replay in every case, or the run stops with option A.
 */
async function runAssemble(): Promise<void> {
  const throughput = await readJson<ThroughputFile>("throughput-t0.json");
  const live = await readJson<LiveLatencyFile>("latency-live-t0.json");
  const mismatches = live.cases
    .filter((item) => !item.pairsMatch)
    .map((item) => item.id);
  if (mismatches.length > 0)
    throw new Error(
      `Live pair counts differ from the replay in ${mismatches.length} cases (${mismatches.join(", ")}). Stop and choose option A, the recapture.`
    );
  const adopted = adoptedOrderingOf(throughput.gainPercent);
  const adoptedPairsPerSecond =
    adopted === "bySize"
      ? throughput.pairsPerSecond.bySize
      : throughput.pairsPerSecond.original;
  const timed = live.cases.flatMap((item) => item.samples);
  const m0 = latencySummary(timed.map((sample) => sample.e2eMs));
  if (m0.medianMs === null) throw new Error("The live latency has no timed sample.");
  const m0Seconds = m0.medianMs / 1000;
  const interpretationSeconds =
    medianOf(timed.map((sample) => sample.preEmbedMs)) / 1000;
  const passPerCase = live.cases.map((item) =>
    passSecondsOf({
      e2eSeconds: medianOf(item.samples.map((sample) => sample.e2eMs)) / 1000,
      interpretationSeconds,
      rerankSeconds:
        medianOf(item.samples.map((sample) => sample.rerankMs)) / 1000
    })
  );
  const passSeconds = medianOf(passPerCase);
  const budget = rerankBudgetOf({
    pairsPerSecond: adoptedPairsPerSecond,
    m0Seconds,
    interpretationSeconds,
    passSeconds
  });
  // Sensitivity: each case subtracts its own pre-embedding time, because literal-mode
  // queries do not run the LFM interpreter and the global f_interp overstates them.
  const passPerCaseOwn = live.cases.map((item) =>
    passSecondsOf({
      e2eSeconds: medianOf(item.samples.map((sample) => sample.e2eMs)) / 1000,
      interpretationSeconds:
        medianOf(item.samples.map((sample) => sample.preEmbedMs)) / 1000,
      rerankSeconds:
        medianOf(item.samples.map((sample) => sample.rerankMs)) / 1000
    })
  );
  const passSecondsOwn = medianOf(passPerCaseOwn);
  const budgetOwn = rerankBudgetOf({
    pairsPerSecond: adoptedPairsPerSecond,
    m0Seconds,
    interpretationSeconds,
    passSeconds: passSecondsOwn
  });
  const timedPairs = timed.reduce((total, sample) => total + sample.pairs, 0);
  const timedRerankSeconds =
    timed.reduce((total, sample) => total + sample.rerankMs, 0) / 1000;
  const target = await writeJson("results-t0.json", {
    schemaVersion: 2,
    captureId: CAPTURE_ID,
    formula: {
      budget: "B = floor(v_adopted * (1.2 * M0 - f_interp - 3 * f_passo))",
      fPasso: "median over the cases of (median end-to-end - f_interp - median measured reranker time)",
      fInterp: "median of the time from the start of each timed recall to the query embedding",
      m0: "median of all timed live recalls, as latencySummary reports it"
    },
    adoptedOrdering: adopted,
    gainPercent: throughput.gainPercent,
    vAdoptedPairsPerSecond: adoptedPairsPerSecond,
    impliedOriginalPairsPerSecond: impliedPairsPerSecond(timedPairs, timedRerankSeconds),
    originalThroughputOfBenchmark: throughput.pairsPerSecond.original,
    m0: {
      medianMs: m0.medianMs,
      p95Ms: m0.p95Ms,
      timedSamples: m0.samples,
      subset: live.cases.map((item) => item.id)
    },
    interpretation: {
      fInterpSeconds: interpretationSeconds,
      lfmOnlyMedianMs: medianOf(timed.map((sample) => sample.interpretMs))
    },
    fPassoSeconds: passSeconds,
    fPassoSecondsPerCase: passPerCase,
    negativeFPassoCases: passPerCase.filter((value) => value < 0).length,
    budget,
    viableK: viableKs(budget),
    kMax: maxViableK(budget),
    sensitivityOwnInterpretation: {
      rule: "f_passo per case, subtracting the case's own pre-embedding time instead of the global f_interp",
      fPassoSeconds: passSecondsOwn,
      fPassoSecondsPerCase: passPerCaseOwn,
      negativeFPassoCases: passPerCaseOwn.filter((value) => value < 0).length,
      budget: budgetOwn,
      viableK: viableKs(budgetOwn),
      kMax: maxViableK(budgetOwn)
    },
    pairsCheck: {
      cases: live.cases.length,
      matched: live.cases.filter((item) => item.pairsMatch).length
    }
  });
  console.error(`results written to ${target}`);
}

const COMMANDS: Readonly<Record<string, () => Promise<void>>> = {
  throughput: runThroughput,
  latency: runLatency,
  curve: runCurve,
  assemble: runAssemble
};

async function main(): Promise<void> {
  const name = process.argv[2] ?? "";
  if (!Object.hasOwn(COMMANDS, name)) {
    console.error(
      `Usage: t0-funnel-prestudy.ts <${Object.keys(COMMANDS).join("|")}>`
    );
    process.exitCode = 2;
    return;
  }
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await COMMANDS[name]();
}

/** The study runs only as a script. Importing its helpers (the latency measurement of E4 does) must not run it. */
function isEntrypoint(): boolean {
  const invokedPath = process.argv[1];
  if (invokedPath === undefined) return false;
  return path.resolve(invokedPath) === fileURLToPath(import.meta.url);
}

if (isEntrypoint())
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
