import assert from "node:assert/strict";
import type {
  CapturedCase,
  CapturedRecord
} from "../scripts/memory-eval/capture-types.js";
import type {
  DeepCaseRuns,
  RankedPassage,
  VariantRun,
  DeepVariantId
} from "../scripts/memory-eval/deep-variants.js";
import type { VariantMetrics } from "../scripts/memory-eval/deep-metrics.js";
import type { EvalCase } from "../scripts/memory-eval/dataset.js";
import { rerankPairKey } from "../scripts/memory-eval/recording-providers.js";
import type { CaseRuns } from "../scripts/memory-eval/deep-run.js";
import { semanticRerankingDocument } from "../src/core/memory/semantic-ranking.js";
import type {
  MemoryVectorRecord,
  RerankingProvider,
  RerankingProviderMetadata
} from "../src/core/memory/types.js";

export const QUERY = "rotacao de token do daemon";
export const SCOPE_THREAD = "thread-scope-aaaa1111";
export const OTHER_THREAD = "thread-other-bbbb2222";
export const SCOPE_SUMMARY = `threads/${SCOPE_THREAD}/SUMMARY.md`;
export const OTHER_SUMMARY = `threads/${OTHER_THREAD}/SUMMARY.md`;
/** The quote that a case cites from the scope thread. It is a whole sentence of SCOPE_SUMMARY. */
export const SCOPE_QUOTE =
  "a rotacao de token do daemon foi adiada por custo de migracao";
export const SCOPE_SOURCE_TEXT = `# Resumo\n\n## Decisao\n\nNa thread, ${SCOPE_QUOTE}. Outras passagens tratam do assunto de forma incidental.\n`;
export const OTHER_SOURCE_TEXT =
  "# Resumo\n\n## Outra\n\nTexto sem relacao com a rotacao.\n";

export type PassageSpec = {
  recordId: string;
  threadId: string;
  /** The workspace path, as the index stores it: `.marc/threads/...`. */
  sourcePath: string;
  passageHex: string;
  vector: number[];
  /** Reranker score of the passage for QUERY. */
  score: number;
  text: string;
  sourceType?: "summary" | "artifact" | "chat";
};

/** The passages of the scope thread, with four scores that are distinct, and one passage of another thread. */
export const SCOPE_PASSAGES: PassageSpec[] = [
  spec(
    "rec-s1",
    SCOPE_THREAD,
    SCOPE_SUMMARY,
    "00000000000000a1",
    [1, 0],
    0.2,
    "trecho um sobre o token"
  ),
  spec(
    "rec-s2",
    SCOPE_THREAD,
    SCOPE_SUMMARY,
    "00000000000000a2",
    [0.6, 0.8],
    0.9,
    "trecho dois sobre o daemon"
  ),
  spec(
    "rec-s3",
    SCOPE_THREAD,
    SCOPE_SUMMARY,
    "00000000000000a3",
    [0, 1],
    0.5,
    "trecho tres sobre outro tema"
  ),
  spec(
    "rec-s4",
    SCOPE_THREAD,
    SCOPE_SUMMARY,
    "00000000000000a4",
    [0.8, 0.6],
    0.9999,
    "trecho quatro sobre a rotacao"
  )
];

export const OTHER_PASSAGES: PassageSpec[] = [
  spec(
    "rec-o1",
    OTHER_THREAD,
    OTHER_SUMMARY,
    "00000000000000b1",
    [1, 0],
    0.99,
    "trecho de outra thread"
  )
];

function spec(
  recordId: string,
  threadId: string,
  corpusPath: string,
  passageHex: string,
  vector: number[],
  score: number,
  text: string
): PassageSpec {
  return {
    recordId,
    threadId,
    sourcePath: `.marc/${corpusPath}`,
    passageHex,
    vector,
    score,
    text
  };
}

/** The passageId of a spec, in the E1 form: the workspace path, a hash sign, and 16 lowercase hex digits. */
export function passageIdOf(item: PassageSpec): string {
  return `${item.sourcePath}#${item.passageHex}`;
}

/** A passage record as the capture stores it. Only the fields that the ranking and the reranker read are real. */
export function capturedRecordOf(item: PassageSpec): CapturedRecord {
  return {
    recordId: item.recordId,
    threadId: item.threadId,
    title: item.threadId,
    summaryPath: item.sourcePath,
    relativeSummaryPath: item.sourcePath,
    reference: `marc://${item.threadId}`,
    kind: "passage",
    sectionTitle: "Decisao",
    text: item.text,
    embeddingText: item.text,
    sourceType: item.sourceType ?? "summary",
    layer: 0,
    sourcePath: item.sourcePath,
    authority: "decision",
    lineStart: 1,
    lineEnd: 2,
    sourceSha256: "0".repeat(64),
    passageOrdinal: 0,
    passageSha256: "0".repeat(64),
    passageId: passageIdOf(item)
  } as CapturedRecord;
}

export function allPassages(): PassageSpec[] {
  return [...SCOPE_PASSAGES, ...OTHER_PASSAGES];
}

/** Records, vectors and the captured case for the passages above, with reranker scores under the core's pair keys. */
export function captureFixture(extraScores: Record<string, number> = {}): {
  captured: CapturedCase;
  records: Map<string, CapturedRecord>;
  vectors: Map<string, number[]>;
  rerankerMetadata: RerankingProviderMetadata;
} {
  const records = new Map(
    allPassages().map(
      (item) => [item.recordId, capturedRecordOf(item)] as const
    )
  );
  const vectors = new Map(
    allPassages().map((item) => [item.recordId, item.vector] as const)
  );
  const scores = Object.fromEntries(
    allPassages().map((item) => [pairKeyOf(item), item.score] as const)
  );
  const captured = {
    id: "C-deep",
    interpretation: { effectiveQuery: QUERY },
    queryVectors: { [QUERY]: [1, 0] },
    rerankScores: { ...scores, ...extraScores }
  } as unknown as CapturedCase;
  return {
    captured,
    records,
    vectors,
    rerankerMetadata: {} as RerankingProviderMetadata
  };
}

/** The reranker key of one passage for QUERY, as the capture writes it. */
export function pairKeyOf(item: PassageSpec): string {
  return rerankPairKey(
    QUERY,
    semanticRerankingDocument(
      capturedRecordOf(item) as unknown as MemoryVectorRecord
    )
  );
}

/** A reranker that scores each document by a table. The core and the cache must agree on it. */
export class TableReranker implements RerankingProvider {
  constructor(private readonly scores: ReadonlyMap<string, number>) {}

  describe(): RerankingProviderMetadata {
    return {} as RerankingProviderMetadata;
  }

  isPrepared(): Promise<boolean> {
    return Promise.resolve(true);
  }

  prepare(): Promise<void> {
    return Promise.resolve();
  }

  rerank(_query: string, documents: string[]): Promise<number[]> {
    return Promise.resolve(
      documents.map((document) => this.scores.get(document) ?? 0)
    );
  }

  splitPassages(): Promise<string[][]> {
    return Promise.reject(new Error("TableReranker does not split passages."));
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}

/** A deep case of the scope thread, with the quote and the grades of the passages in the scope. */
export function scopedCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: "D-scoped",
    family: "deep",
    style: "deep",
    query: QUERY,
    queryMode: "auto",
    judgments: {},
    evidence: [{ sourcePath: SCOPE_SUMMARY, quote: SCOPE_QUOTE }],
    scope: { threadId: SCOPE_THREAD },
    passageJudgments: {},
    origin: "fixture",
    ...overrides
  };
}

/** A run of ok status over the passage ids given, in order. Scores are optional (the cosine variant has none). */
export function okRun(
  variant: DeepVariantId,
  passages: Array<[string, number | undefined]>,
  extra: Partial<OkRun> = {}
): OkRun {
  return {
    variant,
    status: "ok",
    ranked: passages.map(([passageId, score]) => rankedOf(passageId, score)),
    pairs: passages.length,
    truncated: false,
    scopePassages: passages.length,
    ...extra
  };
}

export function rankedOf(
  passageId: string,
  score: number | undefined
): RankedPassage {
  return {
    recordId: `rec-${passageId}`,
    passageId,
    threadId: SCOPE_THREAD,
    sourceType: "summary",
    score
  };
}

export type OkRun = Extract<VariantRun, { status: "ok" }>;

/** The run of a variant, asserted to be ok. The assertion is the check; the cast only narrows the type. */
export function okOf(run: VariantRun | undefined): OkRun {
  assert.equal(run?.status, "ok");
  return run as OkRun;
}

export function incompleteRun(variant: DeepVariantId): VariantRun {
  return { variant, status: "incomplete", reason: "missing-pair" };
}

/** Full metrics with neutral values, overridden where a test needs them. */
export function metricsOfFixture(
  overrides: Partial<VariantMetrics>
): VariantMetrics {
  return {
    variant: "DEEP",
    status: "ok",
    top5: [],
    success: false,
    mrr: 0,
    precision5: 0,
    saturated: 0,
    scopeConform: true,
    pairs: 0,
    truncated: false,
    scopePassages: null,
    ...overrides
  };
}

/** The case runs that the worksheet reads, with the given variant runs. */
export function caseRunsOf(
  evalCase: EvalCase,
  runs: DeepCaseRuns["runs"]
): CaseRuns {
  return {
    evalCase,
    captured: { id: evalCase.id } as unknown as CapturedCase,
    caseRuns: { runs }
  };
}

export function deepRunsOf(runs: DeepCaseRuns["runs"]): DeepCaseRuns {
  return { runs };
}
