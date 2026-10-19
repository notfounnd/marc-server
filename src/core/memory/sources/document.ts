import fs from "node:fs/promises";
import path from "node:path";
import { safeJoin } from "../../paths.js";
import type {
  WorkspaceDocumentSource,
  WorkspaceInfo,
  WorkspaceSettings
} from "../../types.js";
import { sectionChunks } from "./chunks.js";
import type { MemoryAuthority, MemorySource } from "./contract.js";
import {
  definedFiles,
  readRegularFile,
  rootRelativePath,
  sha256Hex,
  sourceHash,
  type RegularFile
} from "./files.js";
import { sectionsOrOverview } from "./sections.js";

const DOCUMENT_AUTHORITIES: Record<
  WorkspaceDocumentSource["authority"],
  MemoryAuthority
> = {
  normative: "rule",
  reference: "document"
};
const MAX_DIRECTORY_DEPTH = 4;
const MAX_FILES_PER_SOURCE = 200;
const DOCUMENT_LEVELS = [2];
const SKIPPED_NAMES = new Set([".marc", "node_modules"]);

type DocumentFile = {
  file: RegularFile;
  authority: MemoryAuthority;
};

// Documents configured in settings.memory.documentSources. Links are never
// followed, and a source that is missing or unreadable yields nothing.
export async function readDocumentSources(
  info: WorkspaceInfo,
  settings: WorkspaceSettings
): Promise<MemorySource[]> {
  const groups = await Promise.all(
    settings.memory.documentSources.map((entry) => documentFilesOf(info, entry))
  );
  const byPath = new Map<string, DocumentFile>();
  for (const document of groups.flat()) {
    const key = rootRelativePath(info, document.file.path);
    if (!byPath.has(key)) byPath.set(key, document);
  }
  return [...byPath.values()].map((document) => documentSource(info, document));
}

async function documentFilesOf(
  info: WorkspaceInfo,
  entry: WorkspaceDocumentSource
): Promise<DocumentFile[]> {
  const root = resolveRoot(info, entry.path);
  if (!root) return [];
  const stats = await fs.lstat(root).catch(() => undefined);
  if (!stats || stats.isSymbolicLink()) return [];
  const authority = DOCUMENT_AUTHORITIES[entry.authority];
  if (stats.isFile()) return documentFile(info.rootPath, root, authority);
  if (!stats.isDirectory()) return [];
  const paths = (await markdownPaths(root, 1))
    .sort()
    .slice(0, MAX_FILES_PER_SOURCE);
  const files = await Promise.all(
    paths.map((filePath) => readRegularFile(info.rootPath, filePath))
  );
  return definedFiles(files).map((file) => ({ file, authority }));
}

async function documentFile(
  rootPath: string,
  filePath: string,
  authority: MemoryAuthority
): Promise<DocumentFile[]> {
  if (!filePath.endsWith(".md")) return [];
  const file = await readRegularFile(rootPath, filePath);
  if (!file) return [];
  return [{ file, authority }];
}

function resolveRoot(
  info: WorkspaceInfo,
  relativePath: string
): string | undefined {
  try {
    return safeJoin(info.rootPath, relativePath);
  } catch {
    return undefined;
  }
}

// Markdown files at most MAX_DIRECTORY_DEPTH path segments below the source.
async function markdownPaths(
  directory: string,
  depth: number
): Promise<string[]> {
  const entries = await fs
    .readdir(directory, { withFileTypes: true })
    .catch(() => []);
  const nested = await Promise.all(
    entries.map((entry) =>
      entryMarkdownPaths(path.join(directory, entry.name), entry, depth)
    )
  );
  return nested.flat();
}

async function entryMarkdownPaths(
  entryPath: string,
  entry: {
    name: string;
    isFile(): boolean;
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
  },
  depth: number
): Promise<string[]> {
  if (entry.isSymbolicLink() || SKIPPED_NAMES.has(entry.name)) return [];
  if (entry.isFile()) return entryPath.endsWith(".md") ? [entryPath] : [];
  if (!entry.isDirectory() || depth >= MAX_DIRECTORY_DEPTH) return [];
  return markdownPaths(entryPath, depth + 1);
}

function documentSource(
  info: WorkspaceInfo,
  document: DocumentFile
): MemorySource {
  const { file, authority } = document;
  const markdown = file.bytes.toString("utf8");
  const sourcePath = rootRelativePath(info, file.path);
  const title = headingTitle(markdown) ?? path.basename(file.path);
  const threadId = `@document/${sourcePath}`;
  return {
    sourceType: "document",
    threadId,
    title,
    summaryPath: file.path,
    relativeSummaryPath: sourcePath,
    reference: sourcePath,
    markdown,
    sourcePath,
    sourceSha256: sha256Hex(file.bytes),
    sha256: sourceHash(markdown, title),
    mtimeMs: file.mtimeMs,
    authority,
    chunks: sectionChunks(
      `${threadId}:source`,
      sectionsOrOverview(markdown, DOCUMENT_LEVELS)
    )
  };
}

function headingTitle(markdown: string): string | undefined {
  return /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() || undefined;
}
