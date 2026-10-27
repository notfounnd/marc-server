import fs from "node:fs/promises";
import path from "node:path";
import { parseMessages } from "../../markdown.js";
import type { WorkspaceInfo } from "../../types.js";
import { sectionChunks } from "./chunks.js";
import { MEMORY_SOURCE_AUTHORITIES, type MemorySource } from "./contract.js";
import {
  definedFiles,
  readRegularFile,
  rootRelativePath,
  sha256Hex,
  sourceHash,
  type RegularFile
} from "./files.js";
import { sectionsOrOverview } from "./sections.js";
import { readClosedThreads, type ClosedThread } from "./threads.js";

const ARTIFACTS_DIRECTORY = "artifacts";
const ARTIFACT_LEVELS = [2];

// Top-level Markdown artifacts of closed threads. Open threads have no
// SUMMARY.md and are not listed by readClosedThreads.
export async function readArtifactSources(
  info: WorkspaceInfo
): Promise<MemorySource[]> {
  const threads = await readClosedThreads(info);
  const groups = await Promise.all(
    threads.map((thread) => threadArtifactSources(info, thread))
  );
  return groups.flat();
}

async function threadArtifactSources(
  info: WorkspaceInfo,
  thread: ClosedThread
): Promise<MemorySource[]> {
  const directory = path.join(thread.threadPath, ARTIFACTS_DIRECTORY);
  const stats = await fs.lstat(directory).catch(() => undefined);
  if (!stats?.isDirectory() || stats.isSymbolicLink()) return [];
  const names = await markdownNames(directory);
  const files = await Promise.all(
    names.map((name) =>
      readRegularFile(info.rootPath, path.join(directory, name))
    )
  );
  return definedFiles(files).map((file) => artifactSource(info, thread, file));
}

async function markdownNames(directory: string): Promise<string[]> {
  const entries = await fs
    .readdir(directory, { withFileTypes: true })
    .catch(() => []);
  return entries
    .filter(
      (entry) =>
        entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(".md")
    )
    .map((entry) => entry.name)
    .sort();
}

function artifactSource(
  info: WorkspaceInfo,
  thread: ClosedThread,
  file: RegularFile
): MemorySource {
  const fileName = path.basename(file.path);
  const markdown = file.bytes.toString("utf8");
  const title = `${thread.title} / ${fileName}`;
  const messageId = artifactMessageId(thread.chat, fileName);
  return {
    sourceType: "artifact",
    threadId: thread.threadId,
    title,
    closedAt: thread.closedAt,
    summaryPath: thread.summaryPath,
    relativeSummaryPath: thread.relativeSummaryPath,
    reference: thread.reference,
    markdown,
    sourcePath: rootRelativePath(info, file.path),
    sourceSha256: sha256Hex(file.bytes),
    // The linking message is part of the source hash, so a changed link re-indexes the file.
    sha256: sourceHash(markdown, `${title}\0messageId=${messageId ?? ""}`),
    mtimeMs: file.mtimeMs,
    authority: MEMORY_SOURCE_AUTHORITIES.artifact,
    chunks: sectionChunks(
      `${thread.threadId}:artifact:${fileName}:source`,
      sectionsOrOverview(markdown, ARTIFACT_LEVELS),
      { artifactFileName: fileName, messageId }
    )
  };
}

/**
 * The id of the first CHAT.md message whose artifacts list names the file. Undefined when no
 * message links it, or when the thread has no chat.
 */
export function artifactMessageId(
  chat: RegularFile | undefined,
  fileName: string
): string | undefined {
  if (chat === undefined) return undefined;
  const target = `${ARTIFACTS_DIRECTORY}/${fileName}`;
  const message = parseMessages(chat.bytes.toString("utf8")).find((item) =>
    item.artifacts.includes(target)
  );
  return message?.id;
}
