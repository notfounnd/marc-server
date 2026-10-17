import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import {
  captureMemoryEval,
  type CaptureOptions,
  type CaptureProviders
} from "../scripts/memory-eval/capture.js";
import type { CaptureFile } from "../scripts/memory-eval/capture-types.js";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import {
  measureCaptureLatency,
  readLatencyFile,
  type LatencyFile
} from "../scripts/memory-eval/latency.js";
import type {
  EmbeddingProvider,
  EmbeddingProviderMetadata,
  QueryInterpretationProvider,
  QueryInterpretationProviderMetadata
} from "../src/core/memory/types.js";
import {
  FakeRerankingProvider,
  providerMetadata,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";

export const REPOSITORY_ROOT = fileURLToPath(new URL("..", import.meta.url));

export const THREAD_TOKEN = "thread-token-aaaa1111";
export const THREAD_SETTINGS = "thread-settings-bbbb2222";
export const THREAD_RULES = "thread-rules-cccc3333";

function summaryOf(title: string, threadId: string, decision: string): string {
  return [
    `# Resumo - ${title}`,
    "",
    `Thread: marc://$${threadId}`,
    "",
    "Closed: `2026-10-01T10:00:00.000Z`",
    "",
    "## Decisao",
    "",
    decision,
    ""
  ].join("\n");
}

export const FIXTURE_THREADS: Array<{ threadId: string; markdown: string }> = [
  {
    threadId: THREAD_TOKEN,
    markdown: summaryOf(
      "Token do daemon",
      THREAD_TOKEN,
      "Rotacionar o token do daemon periodicamente com seguranca."
    )
  },
  {
    threadId: THREAD_SETTINGS,
    markdown: summaryOf(
      "Settings em JSON",
      THREAD_SETTINGS,
      "Guardar configuracoes do workspace em JSON estruturado."
    )
  },
  {
    threadId: THREAD_RULES,
    markdown: summaryOf(
      "Regras de bootstrap",
      THREAD_RULES,
      "Separar instrucoes gerenciadas das regras customizaveis no bootstrap."
    )
  }
];

export const FIXTURE_THREAD_IDS: string[] = FIXTURE_THREADS.map(
  (thread) => thread.threadId
);

export const dataset: EvalDataset = {
  schemaVersion: 1,
  corpus: "marc",
  cases: [
    {
      id: "A1",
      family: THREAD_TOKEN,
      style: "direct",
      query: "rotacao de token do daemon",
      queryMode: "auto",
      judgments: { [THREAD_TOKEN]: 3 },
      origin: "fixture-capture"
    },
    {
      id: "A2",
      family: THREAD_SETTINGS,
      style: "typo",
      query: "settngs em JSON",
      queryMode: "auto",
      expectedInterpretation: { effectiveQuery: "settings em JSON" },
      judgments: { [THREAD_SETTINGS]: 3 },
      origin: "fixture-capture"
    },
    {
      id: "A3",
      family: THREAD_RULES,
      style: "direct",
      query: "separar instrucoes gerenciadas",
      queryMode: "literal",
      judgments: { [THREAD_RULES]: 3 },
      origin: "fixture-capture"
    }
  ]
};

/**
 * Deterministic embeddings with a non-zero vector for every text. The shared
 * fake returns zero vectors for texts without its keywords, which leaves the
 * identity channel empty and cannot exercise the capture.
 */
export class HashingEmbeddingProvider implements EmbeddingProvider {
  readonly queryTexts: string[] = [];

  describe(): EmbeddingProviderMetadata {
    return providerMetadata;
  }

  isPrepared(): Promise<boolean> {
    return Promise.resolve(true);
  }

  prepare(): Promise<void> {
    return Promise.resolve();
  }

  embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map(hashedVector));
  }

  embedQuery(text: string): Promise<number[]> {
    this.queryTexts.push(text);
    return Promise.resolve(hashedVector(text));
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}

function hashedVector(text: string): number[] {
  const digest = createHash("sha256").update(text).digest();
  return [digest[0] + 1, digest[1] + 1, digest[2] + 1];
}

/** Chooses the variant with index 1 for the misspelled query; every other call keeps the original. */
export class ScriptedInterpreter implements QueryInterpretationProvider {
  readonly calls: string[] = [];

  constructor(private readonly outputs: ReadonlyMap<string, string>) {}

  describe(): QueryInterpretationProviderMetadata {
    return {
      id: "scripted-interpreter",
      name: "Scripted query interpreter",
      model: "scripted-model",
      version: "1",
      quantized: true,
      runtime: "local"
    };
  }

  isPrepared(): Promise<boolean> {
    return Promise.resolve(true);
  }

  prepare(): Promise<void> {
    return Promise.resolve();
  }

  selectVariant(input: {
    feedback?: string;
    originalQuery: string;
    variants: string[];
  }): Promise<string> {
    this.calls.push(input.originalQuery);
    return Promise.resolve(this.outputs.get(input.originalQuery) ?? "0");
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

/** Deterministic reranker: a document scores the number of query words it contains. */
export function overlapScores(query: string, documents: string[]): number[] {
  const queryWords = new Set(wordsOf(query));
  return documents.map(
    (document) =>
      wordsOf(document).filter((word) => queryWords.has(word)).length
  );
}

export type FakeSet = {
  embedding: HashingEmbeddingProvider;
  reranker: FakeRerankingProvider;
  interpreter: ScriptedInterpreter;
  providers: CaptureProviders;
};

export function createFakes(): FakeSet {
  const embedding = new HashingEmbeddingProvider();
  const reranker = new FakeRerankingProvider(overlapScores);
  const interpreter = new ScriptedInterpreter(
    new Map([["settngs em JSON", "1"]])
  );
  return {
    embedding,
    reranker,
    interpreter,
    providers: { embedding, reranker, interpreter }
  };
}

export async function fixtureThreadsRoot(t: TestContext): Promise<string> {
  const source = await tempWorkspace();
  t.after(() => fs.rm(source.rootPath, { recursive: true, force: true }));
  for (const thread of FIXTURE_THREADS) {
    await writeSummary(source, thread.threadId, thread.markdown);
  }
  return path.join(source.marcPath, "threads");
}

export async function tempDirectory(t: TestContext): Promise<string> {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-memory-eval-capture-")
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

export async function runCapture(input: {
  threadsRoot: string;
  outputRoot: string;
  fakes: FakeSet;
  resume?: boolean;
  productionManifestPath?: string;
  dataset?: EvalDataset;
}): Promise<{
  result: Awaited<ReturnType<typeof captureMemoryEval>>;
  logs: string[];
}> {
  const logs: string[] = [];
  const options: CaptureOptions = {
    dataset: input.dataset ?? dataset,
    source: { threadsRoot: input.threadsRoot, threadIds: FIXTURE_THREAD_IDS },
    outputRoot: input.outputRoot,
    repositoryRoot: REPOSITORY_ROOT,
    createProviders: () => input.fakes.providers,
    productionManifestPath: input.productionManifestPath,
    resume: input.resume ?? false,
    log: (line) => logs.push(line)
  };
  const result = await captureMemoryEval(options);
  return { result, logs };
}

/** Measures the latency of the fixture capture with the same fake providers and reads latency.json back. */
export async function measureFixtureLatency(input: {
  threadsRoot: string;
  outputRoot: string;
  fakes: FakeSet;
}): Promise<LatencyFile> {
  const result = await measureCaptureLatency({
    dataset,
    source: { threadsRoot: input.threadsRoot, threadIds: FIXTURE_THREAD_IDS },
    outputRoot: input.outputRoot,
    repositoryRoot: REPOSITORY_ROOT,
    createProviders: () => input.fakes.providers,
    log: () => undefined
  });
  return readLatencyFile(path.dirname(result.latencyPath), result.captureId);
}

export async function readCaptureFile(
  captureDir: string
): Promise<CaptureFile> {
  const content = await fs.readFile(
    path.join(captureDir, "capture.json"),
    "utf8"
  );
  return JSON.parse(content) as CaptureFile;
}

/** Runs one capture over the fixture corpus with fake providers and reads it back. */
export async function captureFixture(t: TestContext): Promise<CaptureFile> {
  const { result } = await runCapture({
    threadsRoot: await fixtureThreadsRoot(t),
    outputRoot: await tempDirectory(t),
    fakes: createFakes()
  });
  return readCaptureFile(result.captureDir);
}
