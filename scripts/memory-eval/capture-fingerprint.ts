import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  activeMemoryModelSelection,
  queryInterpretationProviderMetadata
} from "../../src/core/memory/model-config.js";
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
};

/**
 * Computes the captureId: the first 12 hex characters of the SHA-256 over the
 * query fingerprint, the active models, the package version, the memory
 * sources and the digest of the pinned corpus. Judgments and origins are
 * deliberately left out.
 */
export async function computeCaptureFingerprint(
  dataset: EvalDataset,
  repositoryRoot: string,
  corpusDigest: string
): Promise<CaptureFingerprint> {
  const queryFingerprint = sha256Json(queryFingerprintCases(dataset.cases));
  const models = modelIdentity();
  const packageVersion = await readPackageVersion(repositoryRoot);
  const sourceHash = await memorySourceHash(repositoryRoot);
  const fingerprint = sha256Json({
    queryFingerprint,
    models,
    packageVersion,
    sourceHash,
    corpusDigest
  });
  return {
    captureId: fingerprint.slice(0, 12),
    fingerprint,
    queryFingerprint,
    models,
    packageVersion,
    sourceHash,
    corpusDigest
  };
}

/** Cases as hashed for the query fingerprint: id, query, mode and expected interpretation, sorted by id. */
export function queryFingerprintCases(cases: readonly EvalCase[]) {
  return [...cases].sort(compareCaseIds).map((evalCase) => ({
    id: evalCase.id,
    query: evalCase.query,
    queryMode: evalCase.queryMode,
    expectedInterpretation: evalCase.expectedInterpretation ?? null
  }));
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Json(value: unknown): string {
  return sha256(JSON.stringify(value));
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

async function memorySourceHash(repositoryRoot: string): Promise<string> {
  const directory = path.join(repositoryRoot, "src", "core", "memory");
  const names = (await fs.readdir(directory))
    .filter((name) => name.endsWith(".ts"))
    .sort();
  const digests = await Promise.all(
    names.map(async (name) => {
      const content = await fs.readFile(path.join(directory, name), "utf8");
      return `src/core/memory/${name}\0${sha256(content)}`;
    })
  );
  return sha256(digests.join("\n"));
}

function compareCaseIds(left: { id: string }, right: { id: string }): number {
  return Number(left.id > right.id) - Number(left.id < right.id);
}
