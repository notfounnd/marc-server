import { createHash } from "node:crypto";
import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { safeJoin } from "./paths.js";
import {
  ThreadSummaryError,
  type ThreadSummaryErrorCode
} from "./thread-summary-error.js";
import type { WorkspaceInfo } from "./types.js";

export type ThreadFiles = {
  threadPath: string;
  threadPathReal: string;
  chatPath: string;
  summaryPath: string;
};

export type ExistingSummary = {
  markdown: string;
  revision: string;
  mtime: Date;
};

export type ThreadSummaryPathMetadata = Pick<
  Stats,
  "isDirectory" | "isFile" | "isSymbolicLink"
>;

export type ThreadSummaryPathMetadataReader = {
  lstat: (filePath: string) => Promise<ThreadSummaryPathMetadata>;
  realpath: (filePath: string) => Promise<string>;
};

const nodePathMetadataReader: ThreadSummaryPathMetadataReader = {
  lstat: (filePath) => fs.lstat(filePath),
  realpath: (filePath) => fs.realpath(filePath)
};

export async function inspectThreadFiles(
  info: WorkspaceInfo,
  threadId: string,
  metadata: ThreadSummaryPathMetadataReader = nodePathMetadataReader
): Promise<ThreadFiles> {
  let rootPathReal: string;
  try {
    rootPathReal = await metadata.realpath(info.rootPath);
  } catch {
    throw new ThreadSummaryError("thread_not_found");
  }
  const marcPath = await realDirectory(info.marcPath, rootPathReal, metadata);
  const threadsPath = safeJoin(info.marcPath, "threads");
  const threadsPathReal = await realDirectory(threadsPath, marcPath, metadata);
  const threadPath = safeJoin(threadsPath, threadId);
  const threadPathReal = await realDirectory(
    threadPath,
    threadsPathReal,
    metadata
  );
  const chatPath = safeJoin(threadPath, "CHAT.md");
  await assertRegularFile(
    chatPath,
    threadPathReal,
    "thread_not_found",
    false,
    metadata
  );
  const summaryPath = safeJoin(threadPath, "SUMMARY.md");
  await assertRegularFile(
    summaryPath,
    threadPathReal,
    "path_invalid",
    true,
    metadata
  );
  return { threadPath, threadPathReal, chatPath, summaryPath };
}

export async function readRegularFile(
  filePath: string,
  parentRealPath: string,
  metadata: ThreadSummaryPathMetadataReader = nodePathMetadataReader
): Promise<Buffer> {
  await assertRegularFile(
    filePath,
    parentRealPath,
    "thread_not_found",
    false,
    metadata
  );
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    throw pathError(error, "thread_not_found");
  }
}

export async function readExistingSummary(
  files: ThreadFiles,
  metadata: ThreadSummaryPathMetadataReader = nodePathMetadataReader
): Promise<ExistingSummary | undefined> {
  const exists = await assertRegularFile(
    files.summaryPath,
    files.threadPathReal,
    "path_invalid",
    true,
    metadata
  );
  if (!exists) return undefined;
  const buffer = await readRegularFile(
    files.summaryPath,
    files.threadPathReal,
    metadata
  );
  let stats: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stats = await fs.stat(files.summaryPath);
  } catch {
    throw new ThreadSummaryError("path_invalid");
  }
  return {
    markdown: buffer.toString("utf8"),
    revision: hashSummaryBytes(buffer),
    mtime: stats.mtime
  };
}

export function hashSummaryBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function realDirectory(
  targetPath: string,
  parentRealPath: string,
  metadata: ThreadSummaryPathMetadataReader
): Promise<string> {
  let stats: ThreadSummaryPathMetadata;
  try {
    stats = await metadata.lstat(targetPath);
  } catch (error) {
    throw pathError(error, "thread_not_found");
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new ThreadSummaryError("path_invalid");
  }
  let targetRealPath: string;
  try {
    targetRealPath = await metadata.realpath(targetPath);
  } catch {
    throw new ThreadSummaryError("path_invalid");
  }
  if (!isInside(parentRealPath, targetRealPath)) {
    throw new ThreadSummaryError("path_invalid");
  }
  return targetRealPath;
}

async function assertRegularFile(
  filePath: string,
  parentRealPath: string,
  missingCode: ThreadSummaryErrorCode,
  optional: boolean,
  metadata: ThreadSummaryPathMetadataReader
): Promise<boolean> {
  let stats: ThreadSummaryPathMetadata;
  try {
    stats = await metadata.lstat(filePath);
  } catch (error) {
    if (optional && isMissing(error)) return false;
    throw pathError(error, missingCode);
  }
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new ThreadSummaryError("path_invalid");
  }
  let realFilePath: string;
  try {
    realFilePath = await metadata.realpath(filePath);
  } catch {
    throw new ThreadSummaryError("path_invalid");
  }
  if (!isInside(parentRealPath, realFilePath)) {
    throw new ThreadSummaryError("path_invalid");
  }
  return true;
}

function pathError(
  error: unknown,
  missingCode: ThreadSummaryErrorCode
): ThreadSummaryError {
  if (isMissing(error)) return new ThreadSummaryError(missingCode);
  return new ThreadSummaryError("path_invalid");
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}
