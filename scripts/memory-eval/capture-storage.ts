import fs from "node:fs/promises";
import path from "node:path";
import { writeFileAtomically } from "../../src/core/write-coordination.js";
import type { CapturedCase } from "./capture-types.js";

export const SCHEMA_VERSION = 1;
export const CAPTURE_FILE = "capture.json";
const CHECKPOINT_FILE = "checkpoint.json";
const CASES_DIRECTORY = "cases";

type CheckpointFile = {
  schemaVersion: typeof SCHEMA_VERSION;
  captureId: string;
  corpusDigest: string;
  completedCaseIds: string[];
};

/** Creates the capture directory. Without `resume`, an existing directory is never reused. */
export async function prepareCaptureDirectory(
  captureDir: string,
  resume: boolean
): Promise<void> {
  const exists = await fs.stat(captureDir).then(
    () => true,
    () => false
  );
  if (exists && !resume)
    throw new Error(
      `Capture directory already exists: ${captureDir}. Use --resume to continue it, or remove it first.`
    );
  await fs.mkdir(path.join(captureDir, CASES_DIRECTORY), { recursive: true });
}

/**
 * Returns the concluded case ids. A checkpoint written over a different corpus
 * content is refused, because its cases would describe threads that changed.
 */
export async function readCheckpoint(
  captureDir: string,
  captureId: string,
  corpusDigest: string
): Promise<string[]> {
  const content = await fs
    .readFile(path.join(captureDir, CHECKPOINT_FILE), "utf8")
    .catch(() => undefined);
  if (content === undefined) return [];
  const checkpoint = JSON.parse(content) as CheckpointFile;
  if (checkpoint.captureId !== captureId)
    throw new Error(`Checkpoint in ${captureDir} belongs to another capture.`);
  if (checkpoint.corpusDigest !== corpusDigest)
    throw new Error(
      `The corpus changed since the checkpoint in ${captureDir}. Remove the capture directory and capture again.`
    );
  return [...checkpoint.completedCaseIds];
}

export async function writeCheckpoint(
  captureDir: string,
  captureId: string,
  corpusDigest: string,
  completedCaseIds: string[]
): Promise<void> {
  const checkpoint: CheckpointFile = {
    schemaVersion: SCHEMA_VERSION,
    captureId,
    corpusDigest,
    completedCaseIds
  };
  await writeFileAtomically(
    path.join(captureDir, CHECKPOINT_FILE),
    JSON.stringify(checkpoint, null, 2)
  );
}

export async function writeCapturedCase(
  captureDir: string,
  captured: CapturedCase
): Promise<void> {
  await writeFileAtomically(
    caseFilePath(captureDir, captured.id),
    JSON.stringify(captured)
  );
}

export async function readCapturedCase(
  captureDir: string,
  caseId: string
): Promise<CapturedCase> {
  const content = await fs.readFile(caseFilePath(captureDir, caseId), "utf8");
  return JSON.parse(content) as CapturedCase;
}

export async function writeCaptureFile(
  captureDir: string,
  capture: unknown
): Promise<void> {
  await writeFileAtomically(
    path.join(captureDir, CAPTURE_FILE),
    JSON.stringify(capture)
  );
}

function caseFilePath(captureDir: string, caseId: string): string {
  return path.join(captureDir, CASES_DIRECTORY, `${caseId}.json`);
}
