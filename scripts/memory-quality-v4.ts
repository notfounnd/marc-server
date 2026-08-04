import { performance } from "node:perf_hooks";
import process from "node:process";
import { initWorkspace } from "../src/core/workspace.js";
import { LocalEmbeddingProvider } from "../src/core/memory/local-provider.js";
import { LocalQueryInterpretationProvider } from "../src/core/memory/local-query-interpreter.js";
import { LocalRerankingProvider } from "../src/core/memory/local-reranker.js";
import {
  buildMemoryQueryCandidates,
  interpretMemoryQuery
} from "../src/core/memory/query-interpretation.js";
import { candidateLimitForMemorySearchDepth } from "../src/core/memory/search-depth.js";
import { rankHybridMemoryCandidates } from "../src/core/memory/hybrid-ranking.js";
import {
  rankSemanticMemoryCandidates,
  type RankedMemoryThread
} from "../src/core/memory/semantic-ranking.js";
import {
  LanceDbMemoryVectorStore,
  readMemoryManifest
} from "../src/core/memory/store.js";
import {
  memoryModelBenchmarkReport,
  prepareMemoryModelBenchmark
} from "./memory-model-benchmark-support.js";
import { encodeMemoryModelBenchmarkReport } from "./memory-model-benchmark-runner.js";
import { selectMemoryQualityCases } from "./memory-quality-selection.js";
import { defaultMemoryInferenceManager } from "../src/core/memory/inference-manager.js";
import type {
  EmbeddingProvider,
  MemoryQueryInterpretation,
  MemorySearchDepth,
  MemoryVectorRow,
  MemoryVectorStore,
  QueryInterpretationProvider
} from "../src/core/memory/types.js";

type RelevanceGrade = 0 | 1 | 2 | 3;
type MemoryQualityStrategy = "baseline" | "hybrid-exact" | "hybrid-prefix";

type QualityCase = {
  expectedEffectiveQuery?: string;
  expectedSuggestedQuery?: string;
  expectedTopThreadId?: string;
  family: string;
  judgments: Record<string, RelevanceGrade>;
  query: string;
};

type InterpretedQualityCase = QualityCase & {
  candidates: ReturnType<typeof buildMemoryQueryCandidates>;
  interpretation: MemoryQueryInterpretation;
  interpretationTrace: InterpretationTrace[];
};

type InterpretationTrace = {
  feedback?: string;
  output: string;
  variants: string[];
};

type EvaluatedCase = InterpretedQualityCase & {
  depth: MemorySearchDepth;
  durationMs: number;
  ranked: RankedMemoryThread[];
};

const STYLE_THREAD =
  "oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1";
const CALIBRATION_THREAD =
  "oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac";
const BACKGROUND_THREAD =
  "oportunidade-processamento-em-background-para-gerar-memory-aa4908aa";
const SETTINGS_THREAD =
  "oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9";
const TOKEN_SECURITY_THREAD =
  "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3";
const DEPTHS: MemorySearchDepth[] = [0, 1, 2, 3];
const ELIGIBILITY_THRESHOLD = 0.5;

const qualityCases: QualityCase[] = [
  styleCase("brutal"),
  styleCase("brutalismp", "brutalism"),
  styleCase("brutalism", "brutalism"),
  styleCase("interface com brutalism", "interface com brutalism"),
  styleCase("interace com brutalism", "interface com brutalism"),
  {
    expectedEffectiveQuery: "toggle",
    expectedTopThreadId: BACKGROUND_THREAD,
    family: "toggle",
    judgments: {
      [BACKGROUND_THREAD]: 3,
      [SETTINGS_THREAD]: 2
    },
    query: "toggle"
  },
  {
    expectedEffectiveQuery: "toogle",
    expectedSuggestedQuery: "toggle",
    expectedTopThreadId: BACKGROUND_THREAD,
    family: "toggle",
    judgments: {
      [BACKGROUND_THREAD]: 3,
      [SETTINGS_THREAD]: 2
    },
    query: "toogle"
  },
  {
    expectedEffectiveQuery: "interface token rotation security",
    expectedTopThreadId: TOKEN_SECURITY_THREAD,
    family: "security",
    judgments: { [TOKEN_SECURITY_THREAD]: 3 },
    query: "interface token rotation security"
  },
  {
    expectedEffectiveQuery: "structured workspace settings json",
    expectedTopThreadId: SETTINGS_THREAD,
    family: "settings",
    judgments: { [SETTINGS_THREAD]: 3, [BACKGROUND_THREAD]: 2 },
    query: "structured workspace settings json"
  },
  {
    expectedEffectiveQuery: "seguranca da rotacao de token da interface",
    expectedTopThreadId: TOKEN_SECURITY_THREAD,
    family: "security-pt",
    judgments: { [TOKEN_SECURITY_THREAD]: 3 },
    query: "seguranca da rotacao de token da interface"
  },
  {
    expectedEffectiveQuery: "seguranca da rotacao de token da interface",
    expectedTopThreadId: TOKEN_SECURITY_THREAD,
    family: "security-pt",
    judgments: { [TOKEN_SECURITY_THREAD]: 3 },
    query: "seguranca da rotacao de toke da interface"
  },
  {
    expectedEffectiveQuery: "structured workspace settings json",
    expectedTopThreadId: SETTINGS_THREAD,
    family: "settings-typo",
    judgments: { [SETTINGS_THREAD]: 3, [BACKGROUND_THREAD]: 2 },
    query: "structured worksapce settings json"
  },
  {
    expectedEffectiveQuery: "invoice tax reconciliation for international payments",
    family: "negative-finance",
    judgments: {},
    query: "invoice tax reconciliation for international payments"
  },
  {
    expectedEffectiveQuery: "kubernetes autoscaling policy for production clusters",
    family: "negative-infrastructure",
    judgments: {},
    query: "kubernetes autoscaling policy for production clusters"
  }
];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const selected = selectedCases(args);
  const info = await initWorkspace(workspaceArgument(args));
  const interpreter = new RecordingQueryInterpreter(
    new LocalQueryInterpretationProvider(info)
  );
  const sourceStore = new LanceDbMemoryVectorStore();
  const manifest = await readMemoryManifest(info);
  if (
    !manifest ||
    manifest.schemaVersion !== 6 ||
    manifest.retrievalContract !== "field-aware-hybrid-v2"
  )
    throw new Error("Memory quality requires a schema v6 full rebuild.");
  const rows = await sourceStore.readRows(info, manifest.generation);
  const strategy = selectedStrategy(args);
  if (args.includes("--interpret-only")) {
    const interpreted: InterpretedQualityCase[] = [];
    for (const qualityCase of selected)
      interpreted.push(
        await interpretQualityCase(qualityCase, interpreter, rows)
      );
    console.log(
      JSON.stringify(
        {
          cases: interpreted.map(interpretationReport),
          note: "Interpretation-only diagnostic. Retrieval and reranking were skipped."
        },
        null,
        2
      )
    );
    return;
  }

  const provider = new LocalEmbeddingProvider(info);
  const reranker = new LocalRerankingProvider(info);
  const benchmark = await prepareMemoryModelBenchmark({
    generation: manifest.generation,
    info,
    provider,
    reranker,
    rows,
    sourceStore
  });
  const evaluated: EvaluatedCase[] = [];
  for (const qualityCase of selected) {
    const interpreted = await interpretQualityCase(
      qualityCase,
      interpreter,
      rows
    );
    for (const depth of selectedDepths(args)) {
      evaluated.push(
        await evaluateCase(
          interpreted,
          depth,
          benchmark.generation,
          info,
          provider,
          reranker,
          benchmark.store,
          strategy
        )
      );
    }
  }

  const failures = evaluated.flatMap(qualityFailures);
  const report = {
    aggregate: aggregateMetrics(evaluated),
    benchmark: await memoryModelBenchmarkReport(info, benchmark),
    cases: evaluated.map(caseReport),
    failures,
    note: "Durations are observational and do not gate quality.",
    strategy
  };
  if (benchmark.profile)
    console.log(encodeMemoryModelBenchmarkReport(report));
  if (!benchmark.profile) console.log(JSON.stringify(report, null, 2));
  if (!failures.length) return;
  console.error(`Memory quality failures:\n${failures.join("\n")}`);
  process.exitCode = 1;
}

function selectedCases(args: string[]): QualityCase[] {
  const family = stringArgument(args, "--family");
  const query = stringArgument(args, "--query");
  return selectMemoryQualityCases(qualityCases, family, query);
}

function selectedDepths(args: string[]): MemorySearchDepth[] {
  const rawDepth = stringArgument(args, "--depth");
  if (!rawDepth) return DEPTHS;
  const depth = Number(rawDepth);
  if (depth === 0 || depth === 1 || depth === 2 || depth === 3) return [depth];
  throw new Error("--depth must be an integer from 0 to 3.");
}

async function evaluateCase(
  qualityCase: InterpretedQualityCase,
  depth: MemorySearchDepth,
  generation: string | undefined,
  info: Awaited<ReturnType<typeof initWorkspace>>,
  provider: EmbeddingProvider,
  reranker: LocalRerankingProvider,
  store: MemoryVectorStore,
  strategy: MemoryQualityStrategy
): Promise<EvaluatedCase> {
  const startedAt = performance.now();
  const effectiveQuery = qualityCase.interpretation.effectiveQuery;
  const vector = await provider.embedQuery(effectiveQuery);
  const limit = candidateLimitForMemorySearchDepth(depth);
  const lexicalFields = lexicalFieldsForStrategy(strategy, effectiveQuery);
  const [identityHits, passageHits, ...lexicalHits] = await Promise.all([
    store.searchVector(info, vector, {
      generation,
      kind: "identity",
      limit
    }),
    store.searchVector(info, vector, {
      generation,
      kind: "passage",
      limit
    }),
    ...lexicalFields.map((field) =>
      store.searchLexical(info, effectiveQuery, vector, {
        field,
        generation,
        limit
      })
    )
  ]);
  const ranked = await rankQualityCandidates(strategy, effectiveQuery, {
    identities: identityHits,
    passages: passageHits,
    lexical: lexicalHits.flat()
  }, reranker);
  return {
    ...qualityCase,
    depth,
    durationMs: performance.now() - startedAt,
    ranked
  };
}

function selectedStrategy(args: string[]): MemoryQualityStrategy {
  const strategy = stringArgument(args, "--strategy");
  if (!strategy && process.env.MARC_MEMORY_BENCHMARK_PROFILE) return "baseline";
  if (!strategy) return "hybrid-prefix";
  if (
    strategy === "baseline" ||
    strategy === "hybrid-exact" ||
    strategy === "hybrid-prefix"
  )
    return strategy;
  throw new Error(
    "--strategy must be baseline, hybrid-exact, or hybrid-prefix."
  );
}

function lexicalFieldsForStrategy(
  strategy: MemoryQualityStrategy,
  query: string
): Array<"title" | "summary" | "titlePrefix"> {
  if (strategy === "baseline") return [];
  const fields: Array<"title" | "summary" | "titlePrefix"> = [
    "title",
    "summary"
  ];
  if (strategy !== "hybrid-prefix") return fields;
  if (query.trim().split(/\s+/).length !== 1) return fields;
  return [...fields, "titlePrefix"];
}

function rankQualityCandidates(
  strategy: MemoryQualityStrategy,
  query: string,
  channels: {
    identities: Awaited<ReturnType<MemoryVectorStore["searchVector"]>>;
    passages: Awaited<ReturnType<MemoryVectorStore["searchVector"]>>;
    lexical: Awaited<ReturnType<MemoryVectorStore["searchLexical"]>>;
  },
  reranker: LocalRerankingProvider
): Promise<RankedMemoryThread[]> {
  if (strategy !== "baseline")
    return rankHybridMemoryCandidates(query, channels, reranker);
  return rankSemanticMemoryCandidates(
    query,
    [...channels.identities, ...channels.passages],
    reranker
  );
}

async function interpretQualityCase(
  qualityCase: QualityCase,
  interpreter: RecordingQueryInterpreter,
  rows: MemoryVectorRow[]
): Promise<InterpretedQualityCase> {
  const candidates = buildMemoryQueryCandidates(qualityCase.query, rows);
  const traceOffset = interpreter.trace.length;
  const interpretation = await interpretMemoryQuery({
    mode: "auto",
    originalQuery: qualityCase.query,
    provider: interpreter,
    ...candidates
  });
  return {
    ...qualityCase,
    candidates,
    interpretation,
    interpretationTrace: interpreter.trace.slice(traceOffset)
  };
}

function qualityFailures(evaluated: EvaluatedCase): string[] {
  const failures: string[] = [];
  if (
    evaluated.expectedEffectiveQuery &&
    evaluated.interpretation.effectiveQuery !==
      evaluated.expectedEffectiveQuery
  ) {
    failures.push(
      `${caseId(evaluated)} expected effective query ${evaluated.expectedEffectiveQuery}, received ${evaluated.interpretation.effectiveQuery}`
    );
  }
  if (
    evaluated.expectedSuggestedQuery &&
    evaluated.interpretation.suggestedQuery !==
      evaluated.expectedSuggestedQuery
  ) {
    failures.push(
      `${caseId(evaluated)} expected suggested query ${evaluated.expectedSuggestedQuery}, received ${evaluated.interpretation.suggestedQuery ?? "none"}`
    );
  }
  const eligible = eligibleThreads(evaluated);
  const topThreadId = eligible[0]?.evidence.record.threadId;
  if (
    evaluated.expectedTopThreadId &&
    topThreadId !== evaluated.expectedTopThreadId
  )
    failures.push(
      `${caseId(evaluated)} expected ${evaluated.expectedTopThreadId}, received ${topThreadId ?? "no result"}`
    );
  if (!evaluated.expectedTopThreadId && eligible.length)
    failures.push(
      `${caseId(evaluated)} expected abstention, received ${topThreadId}`
    );
  const incidental = eligible.find(
    (thread) => relevanceGrade(evaluated, thread) < 2
  );
  if (incidental)
    failures.push(
      `${caseId(evaluated)} exposed incidental thread ${incidental.evidence.record.threadId}`
    );
  return failures;
}

function aggregateMetrics(evaluated: EvaluatedCase[]) {
  const metrics = evaluated.map(caseMetrics);
  return {
    meanNdcgAt10: mean(metrics.map((metric) => metric.ndcgAt10)),
    meanReciprocalRank: mean(
      metrics.map((metric) => metric.reciprocalRank)
    ),
    meanRecallAt10: mean(metrics.map((metric) => metric.recallAt10)),
    eligibilityPrecision: ratio(
      metrics.reduce((total, metric) => total + metric.truePositive, 0),
      metrics.reduce(
        (total, metric) => total + metric.truePositive + metric.falsePositive,
        0
      )
    ),
    eligibilityRecall: ratio(
      metrics.reduce((total, metric) => total + metric.truePositive, 0),
      metrics.reduce(
        (total, metric) => total + metric.truePositive + metric.falseNegative,
        0
      )
    )
  };
}

function caseMetrics(evaluated: EvaluatedCase) {
  const relevant = relevantThreadIds(evaluated);
  const rankedTopTen = evaluated.ranked.slice(0, 10);
  const eligible = eligibleThreads(evaluated);
  const eligibleRelevant = eligible.filter((thread) =>
    relevant.has(thread.evidence.record.threadId)
  );
  const firstRelevant = rankedTopTen.findIndex((thread) =>
    relevant.has(thread.evidence.record.threadId)
  );
  return {
    ndcgAt10: ndcgAt10(evaluated),
    reciprocalRank: firstRelevant < 0 ? 0 : 1 / (firstRelevant + 1),
    recallAt10: ratio(
      rankedTopTen.filter((thread) =>
        relevant.has(thread.evidence.record.threadId)
      ).length,
      relevant.size
    ),
    truePositive: eligibleRelevant.length,
    falsePositive: eligible.length - eligibleRelevant.length,
    falseNegative: relevant.size - eligibleRelevant.length
  };
}

function relevantThreadIds(evaluated: EvaluatedCase): Set<string> {
  return new Set(
    Object.entries(evaluated.judgments)
      .filter(([, grade]) => grade >= 2)
      .map(([threadId]) => threadId)
  );
}

function ndcgAt10(evaluated: EvaluatedCase): number {
  const gains = evaluated.ranked
    .slice(0, 10)
    .map((thread) => relevanceGrade(evaluated, thread));
  const ideal = Object.values(evaluated.judgments)
    .sort((left, right) => right - left)
    .slice(0, 10);
  return ratio(discountedGain(gains), discountedGain(ideal));
}

function discountedGain(grades: RelevanceGrade[]): number {
  return grades.reduce(
    (total, grade, index) =>
      total + (Math.pow(2, grade) - 1) / Math.log2(index + 2),
    0
  );
}

function eligibleThreads(evaluated: EvaluatedCase): RankedMemoryThread[] {
  return evaluated.ranked.filter(
    (thread) => thread.eligibility >= ELIGIBILITY_THRESHOLD
  );
}

function relevanceGrade(
  evaluated: EvaluatedCase,
  thread: RankedMemoryThread
): RelevanceGrade {
  return evaluated.judgments[thread.evidence.record.threadId] ?? 0;
}

function caseReport(evaluated: EvaluatedCase) {
  return {
    candidates: evaluated.candidates,
    depth: evaluated.depth,
    durationMs: Math.round(evaluated.durationMs),
    family: evaluated.family,
    interpretation: evaluated.interpretation,
    interpretationTrace: evaluated.interpretationTrace,
    query: evaluated.query,
    judged: Object.keys(evaluated.judgments).map((threadId) => {
      const thread = evaluated.ranked.find(
        (candidate) => candidate.evidence.record.threadId === threadId
      );
      return threadReport(thread, threadId);
    }),
    top: evaluated.ranked.slice(0, 10).map((thread) => ({
      eligibility: round(thread.eligibility),
      identityRank: thread.identityRank,
      passageRank: thread.passageRank,
      rankingScore: round(thread.rankingScore),
      relevance: round(thread.relevance),
      rerankerRank: thread.rerankerRank,
      signals: thread.signals,
      threadId: thread.evidence.record.threadId
    }))
  };
}

function interpretationReport(evaluated: InterpretedQualityCase) {
  return {
    candidates: evaluated.candidates,
    interpretation: evaluated.interpretation,
    interpretationTrace: evaluated.interpretationTrace,
    query: evaluated.query
  };
}

class RecordingQueryInterpreter implements QueryInterpretationProvider {
  readonly trace: InterpretationTrace[] = [];

  constructor(private readonly delegate: QueryInterpretationProvider) {}

  describe() {
    return this.delegate.describe();
  }

  isPrepared(): Promise<boolean> {
    return this.delegate.isPrepared();
  }

  prepare(): Promise<void> {
    return this.delegate.prepare();
  }

  async selectVariant(input: {
    feedback?: string;
    originalQuery: string;
    variants: string[];
  }): Promise<string> {
    const output = await this.delegate.selectVariant(input);
    this.trace.push({
      feedback: input.feedback,
      output,
      variants: input.variants
    });
    return output;
  }

  dispose(): Promise<void> {
    return this.delegate.dispose();
  }
}

function threadReport(
  thread: RankedMemoryThread | undefined,
  threadId: string
) {
  if (!thread) return { threadId };
  return {
    eligibility: round(thread.eligibility),
    identityRank: thread.identityRank,
    passageRank: thread.passageRank,
    rankingScore: round(thread.rankingScore),
    relevance: round(thread.relevance),
    rerankerRank: thread.rerankerRank,
    signals: thread.signals,
    threadId
  };
}

function styleCase(
  query: string,
  expectedEffectiveQuery?: string
): QualityCase {
  return {
    expectedEffectiveQuery,
    expectedTopThreadId: STYLE_THREAD,
    family: "brutalism",
    judgments: {
      [STYLE_THREAD]: 3,
      [CALIBRATION_THREAD]: 1
    },
    query
  };
}

function caseId(evaluated: EvaluatedCase): string {
  return `${evaluated.query} depth ${evaluated.depth}`;
}

function ratio(numerator: number, denominator: number): number {
  if (!denominator) return numerator ? 0 : 1;
  return numerator / denominator;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function workspaceArgument(args: string[]): string {
  const workspaceRoot = stringArgument(args, "--workspace");
  if (!workspaceRoot) return process.cwd();
  return workspaceRoot;
}

function stringArgument(
  args: string[],
  name: string
): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const workspaceRoot = args[index + 1];
  if (!workspaceRoot) throw new Error("--workspace requires a path.");
  return workspaceRoot;
}

void main().finally(() => defaultMemoryInferenceManager.disposeAll());
