import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getWorkspaceInfo } from "../../src/core/workspace.js";
import { LocalEmbeddingProvider } from "../../src/core/memory/local-provider.js";
import { LocalQueryInterpretationProvider } from "../../src/core/memory/local-query-interpreter.js";
import { LocalRerankingProvider } from "../../src/core/memory/local-reranker.js";
import type { MemoryLayer } from "../../src/core/memory/sources/contract.js";
import { disposeProviders, openCaptureContext, type CaptureProviders } from "./capture.js";
import { configuredDocumentsOf, withTemporaryWorkspace, type CorpusSource } from "./corpus.js";

/**
 * Whether the layer-0 embeddings of the marc index depend on the index layers. Two temporary indexes of
 * layer 0 are built, to check determinism, and one of layers 0, 1 and 2, to compare the stored vectors of
 * the same recordIds. The result is written as the `vectors` section of bm25-invariance.json.
 */
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const PINNED_FILE = path.join(SCRIPT_DIR, "datasets", "marc.corpus.json");
const OUTPUT_FILE = path.join(REPOSITORY_ROOT, ".marc", "cache", "memory-eval-e3", "t1c", "bm25-invariance.json");

type Vectors = Map<string, number[]>;

type Comparison = {
  label: string;
  recordsCompared: number;
  onlyLeft: number;
  onlyRight: number;
  identical: number;
  differing: number;
  maxAbsDelta: number;
  minCosine: number;
};

export async function runVectorInvariance(): Promise<Record<string, unknown>> {
  const pinned = JSON.parse(await fs.readFile(PINNED_FILE, "utf8")) as { threadIds: string[] };
  const source: CorpusSource = {
    threadsRoot: path.join(REPOSITORY_ROOT, ".marc", "threads"),
    threadIds: pinned.threadIds,
    rulesPath: path.join(REPOSITORY_ROOT, ".marc", "RULES.md"),
    documents: await configuredDocumentsOf({ repositoryRoot: REPOSITORY_ROOT })
  };
  const providers = providersOf(await getWorkspaceInfo(REPOSITORY_ROOT));
  try {
    const firstZero = await layerZeroVectors(source, [0], providers);
    const secondZero = await layerZeroVectors(source, [0], providers);
    const allLayers = await layerZeroVectors(source, [0, 1, 2], providers);
    const determinism = compare("[0] built twice", firstZero, secondZero);
    const batch = compare("[0] against [0,1,2], layer-0 records", firstZero, allLayers);
    return {
      dimension: firstZero.values().next().value?.length ?? 0,
      layer0Records: { firstZero: firstZero.size, secondZero: secondZero.size, allLayers: allLayers.size },
      determinism,
      batchComposition: batch,
      classification: classify(determinism, batch)
    };
  } finally {
    await disposeProviders(providers);
  }
}

/**
 * (a) when the index of layer 0 repeats its own vectors and the layers change them, the cause is the
 * composition of the embedding batch; (b) when the vectors are equal, the cause is in the search.
 */
function classify(determinism: Comparison, batch: Comparison): string {
  if (determinism.differing > 0) return "indeterminado: o indice de camada 0 nao reproduz os proprios vetores";
  if (batch.differing > 0) return "a: vetores diferentes entre [0] e [0,1,2], e [0] deterministico; efeito da composicao do indice, com o lote como hipotese nao isolada";
  return "b: vetores iguais; a causa esta na busca, e nao foi corrigida";
}

function providersOf(info: Awaited<ReturnType<typeof getWorkspaceInfo>>): CaptureProviders {
  return {
    embedding: new LocalEmbeddingProvider(info),
    reranker: new LocalRerankingProvider(info),
    interpreter: new LocalQueryInterpretationProvider(info)
  };
}

/** The stored vector of every layer-0 record of one temporary index over `layers`. */
function layerZeroVectors(source: CorpusSource, layers: MemoryLayer[], providers: CaptureProviders): Promise<Vectors> {
  return withTemporaryWorkspace(source, async (info) => {
    const context = await openCaptureContext({ info, providers, threadIds: source.threadIds, layers });
    return new Map(
      context.rows.filter((row) => row.layer === 0).map((row) => [row.recordId, [...row.vector]])
    );
  });
}

function compare(label: string, left: Vectors, right: Vectors): Comparison {
  const common = [...left.keys()].filter((recordId) => right.has(recordId));
  let identical = 0;
  let maxAbsDelta = 0;
  let minCosine = 1;
  for (const recordId of common) {
    const a = left.get(recordId) ?? [];
    const b = right.get(recordId) ?? [];
    const delta = deltaOf(a, b);
    const cosine = cosineOf(a, b);
    if (delta === 0) identical += 1;
    maxAbsDelta = Math.max(maxAbsDelta, delta);
    minCosine = Math.min(minCosine, cosine);
  }
  return {
    label,
    recordsCompared: common.length,
    onlyLeft: [...left.keys()].filter((recordId) => !right.has(recordId)).length,
    onlyRight: [...right.keys()].filter((recordId) => !left.has(recordId)).length,
    identical,
    differing: common.length - identical,
    maxAbsDelta,
    minCosine
  };
}

function deltaOf(a: number[], b: number[]): number {
  return a.reduce((largest, value, index) => Math.max(largest, Math.abs(value - (b[index] ?? 0))), 0);
}

function cosineOf(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  a.forEach((value, index) => {
    const other = b[index] ?? 0;
    dot += value * other;
    normA += value * value;
    normB += other * other;
  });
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main(): Promise<void> {
  const vectors = await runVectorInvariance();
  const current = JSON.parse(await fs.readFile(OUTPUT_FILE, "utf8")) as Record<string, unknown>;
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify({ ...current, vectors }, null, 2)}\n`);
  console.log(`file=${OUTPUT_FILE}`);
  console.log(`classification=${String(vectors.classification)}`);
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
