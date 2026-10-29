import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  activeMemoryModelSelection,
  queryInterpretationProviderMetadata
} from "../../src/core/memory/model-config.js";
import type { MemoryLayer } from "../../src/core/memory/types.js";
import { E3_K_MAX } from "./capture-scope.js";
import type { EvalCase, EvalDataset } from "./dataset.js";

export type CaptureModelIdentity = ReturnType<typeof modelIdentity>;

export type CaptureFingerprint = {
  captureId: string;
  fingerprint: string;
  queryFingerprint: string;
  models: CaptureModelIdentity;
  packageVersion: string;
  sourceHash: string;
  corpusDigest: string;
  /** Present only when the layers differ from the default [0]. */
  indexedLayers?: readonly MemoryLayer[];
  /** Version of the captured channels. Present only in captures that record the E2 channels. */
  captureChannels?: string;
  /** Order in which the reranker receives the documents (`length`). Present only when it is recorded. */
  rerankOrder?: string;
  /** K_max of the closed scope. Present only when it differs from the E3 default of 30. */
  kMax?: number;
};

/** The components that the captureId hashes. A capture.json stores them all. */
export type FingerprintComponents = Omit<CaptureFingerprint, "captureId" | "fingerprint">;

/** Version written by captures that record the E2 channels (variants, synthetic queries, identity vectors, references). */
export const E2_CAPTURE_CHANNELS = "e2-v1";

const DEFAULT_INDEXED_LAYERS: readonly MemoryLayer[] = [0];

/**
 * Computes the captureId: the first 12 hex characters of the SHA-256 over the
 * query fingerprint, the active models, the package version, the memory
 * sources and the digest of the pinned corpus. Judgments and origins are
 * deliberately left out. indexedLayers joins the hash only when it differs
 * from the default [0], and captureChannels only when it is given, so captures
 * that do not carry those fields keep their ids.
 */
export async function computeCaptureFingerprint(
  dataset: EvalDataset,
  repositoryRoot: string,
  corpusDigest: string,
  indexedLayers?: readonly MemoryLayer[],
  captureChannels?: string,
  rerankOrder?: string,
  kMax?: number
): Promise<CaptureFingerprint> {
  const components: FingerprintComponents = {
    queryFingerprint: sha256Json(queryFingerprintCases(dataset.cases)),
    models: modelIdentity(),
    packageVersion: await readPackageVersion(repositoryRoot),
    sourceHash: await memorySourceHash(repositoryRoot),
    corpusDigest,
    ...layersPart(indexedLayers),
    ...channelsPart(captureChannels),
    ...orderPart(rerankOrder),
    ...kMaxPart(kMax)
  };
  return fingerprintOf(components);
}

function orderPart(rerankOrder: string | undefined): { rerankOrder?: string } {
  if (rerankOrder === undefined) return {};
  return { rerankOrder };
}

/** K_max joins the components only when it differs from the E3 default, so that E0 to E3 ids keep their value. */
function kMaxPart(kMax: number | undefined): { kMax?: number } {
  if (kMax === undefined || kMax === E3_K_MAX) return {};
  return { kMax };
}

/**
 * The fingerprint and captureId of stored components. The stored components of a
 * capture.json reproduce its captureId through this function.
 */
export function fingerprintOf(components: FingerprintComponents): CaptureFingerprint {
  const fingerprint = sha256Json({
    queryFingerprint: components.queryFingerprint,
    models: components.models,
    packageVersion: components.packageVersion,
    sourceHash: components.sourceHash,
    corpusDigest: components.corpusDigest,
    ...layersPart(components.indexedLayers),
    ...channelsPart(components.captureChannels),
    ...orderPart(components.rerankOrder),
    ...kMaxPart(components.kMax)
  });
  return {
    captureId: fingerprint.slice(0, 12),
    fingerprint,
    ...components
  };
}

function channelsPart(captureChannels: string | undefined): { captureChannels?: string } {
  if (captureChannels === undefined) return {};
  return { captureChannels };
}

/** Cases as hashed for the query fingerprint: id, query, mode and expected interpretation, sorted by id. */
export function queryFingerprintCases(cases: readonly EvalCase[]) {
  return [...cases].sort(compareCaseIds).map((evalCase) => ({
    id: evalCase.id,
    query: evalCase.query,
    queryMode: evalCase.queryMode,
    expectedInterpretation: evalCase.expectedInterpretation ?? null,
    ...scopePart(evalCase)
  }));
}

/** The scope joins the query fingerprint only when the case declares one, so that the older datasets keep their ids. */
function scopePart(evalCase: EvalCase): { scope?: EvalCase["scope"] } {
  if (evalCase.scope === undefined) return {};
  return { scope: evalCase.scope };
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Json(value: unknown): string {
  return sha256(JSON.stringify(value));
}

function layersPart(
  indexedLayers: readonly MemoryLayer[] | undefined
): { indexedLayers?: readonly MemoryLayer[] } {
  if (indexedLayers === undefined) return {};
  if (sameLayers(indexedLayers, DEFAULT_INDEXED_LAYERS)) return {};
  return { indexedLayers: [...indexedLayers] };
}

function sameLayers(
  left: readonly MemoryLayer[],
  right: readonly MemoryLayer[]
): boolean {
  return (
    left.length === right.length &&
    left.every((layer, index) => layer === right[index])
  );
}

function modelIdentity() {
  const selection = activeMemoryModelSelection();
  const interpreter = queryInterpretationProviderMetadata();
  return {
    benchmarkProfile: selection.id,
    embedding: {
      providerId: selection.embedding.providerId,
      model: selection.embedding.model,
      modelFile: selection.embedding.modelFile,
      dimensions: selection.embedding.dimensions,
      quantized: selection.embedding.quantized
    },
    reranking: {
      providerId: selection.reranking.providerId,
      model: selection.reranking.model,
      modelFile: selection.reranking.modelFile,
      quantized: selection.reranking.quantized
    },
    interpretation: {
      id: interpreter.id,
      model: interpreter.model,
      version: interpreter.version,
      quantized: interpreter.quantized
    }
  };
}

async function readPackageVersion(repositoryRoot: string): Promise<string> {
  const content = await fs.readFile(
    path.join(repositoryRoot, "package.json"),
    "utf8"
  );
  const parsed = JSON.parse(content) as { version?: unknown };
  if (typeof parsed.version !== "string")
    throw new Error("package.json has no string version.");
  return parsed.version;
}

/**
 * Digest of every TypeScript file under src/core/memory, including the
 * source-layer readers in sources/, so a reader change moves the captureId.
 */
async function memorySourceHash(repositoryRoot: string): Promise<string> {
  const directory = path.join(repositoryRoot, "src", "core", "memory");
  const relatives = (await typeScriptFilesUnder(directory)).sort();
  const digests = await Promise.all(
    relatives.map(async (relative) => {
      const content = await fs.readFile(path.join(directory, relative), "utf8");
      return `src/core/memory/${relative}\0${sha256(content)}`;
    })
  );
  return sha256(digests.join("\n"));
}

async function typeScriptFilesUnder(directory: string, prefix = ""): Promise<string[]> {
  const entries = await fs.readdir(path.join(directory, prefix), {
    withFileTypes: true
  });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) return typeScriptFilesUnder(directory, relative);
      if (entry.name.endsWith(".ts")) return [relative];
      return [];
    })
  );
  return nested.flat();
}

function compareCaseIds(left: { id: string }, right: { id: string }): number {
  return Number(left.id > right.id) - Number(left.id < right.id);
}
