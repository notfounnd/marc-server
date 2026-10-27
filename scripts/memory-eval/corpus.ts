import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readWorkspaceSettingsInWorkspace } from "../../src/core/memory/settings.js";
import { readDocumentSources } from "../../src/core/memory/sources/document.js";
import type { WorkspaceInfo } from "../../src/core/types.js";
import { getWorkspaceInfo, initWorkspace } from "../../src/core/workspace.js";

export type CorpusSource = {
  /** Directory whose children are thread folders with SUMMARY.md and CHAT.md. */
  threadsRoot: string;
  /** Frozen thread ids. Only these folders are copied and digested. */
  threadIds: readonly string[];
  /** RULES.md copied next to the threads, when present. */
  rulesPath?: string;
  /** Configured documents (`memory.documentSources`), copied at their workspace paths and digested. */
  documents?: readonly CorpusDocument[];
};

/** A configured document: its path inside the workspace, the file that holds it, and its authority. */
export type CorpusDocument = {
  relativePath: string;
  absolutePath: string;
  authority: string;
};

type CorpusFile = {
  /** Path inside the corpus, with forward slashes, e.g. `threads/<id>/SUMMARY.md`. */
  relativePath: string;
  absolutePath: string;
};

/**
 * Runs `run` in a fresh workspace that holds only a copy of the pinned corpus.
 * The directory is removed afterwards, even when `run` fails.
 */
export async function withTemporaryWorkspace<T>(
  source: CorpusSource,
  run: (info: WorkspaceInfo) => Promise<T>
): Promise<T> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "marc-memory-eval-"));
  try {
    const info = await initWorkspace(tempRoot);
    await copyCorpus(source, info.marcPath);
    return await run(info);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

/**
 * SHA-256 over the content that is copied: every file of the pinned thread
 * folders and RULES.md, sorted by relative path. Unpinned threads do not
 * change it.
 */
export async function corpusContentDigest(source: CorpusSource): Promise<string> {
  const files = await corpusFiles(source);
  const digests = await Promise.all(
    files.map(async (file) => {
      const content = await fs.readFile(file.absolutePath);
      const hash = createHash("sha256").update(content).digest("hex");
      return `${file.relativePath}\0${hash}`;
    })
  );
  return createHash("sha256").update(digests.join("\n")).digest("hex");
}

/**
 * Text of every file of the pinned corpus, keyed by its corpus path (e.g. `threads/<id>/CHAT.md`,
 * `RULES.md`). The evidence quotes of the dataset are checked against these texts.
 */
export async function corpusSourceTexts(source: CorpusSource): Promise<Map<string, string>> {
  const files = await corpusFiles(source);
  const entries = await Promise.all(
    files.map(async (file) => [file.relativePath, await fs.readFile(file.absolutePath, "utf8")] as const)
  );
  return new Map(entries);
}

async function copyCorpus(source: CorpusSource, marcPath: string): Promise<void> {
  for (const threadId of source.threadIds) {
    await fs.cp(
      path.join(source.threadsRoot, threadId),
      path.join(marcPath, "threads", threadId),
      { recursive: true }
    );
  }
  await copyRules(source.rulesPath, marcPath);
  await copyDocuments(source.documents ?? [], marcPath);
}

/**
 * Copies the configured documents to their workspace paths, which are relative to the workspace
 * root (the parent of the memory directory), and lists them in the copy's memory settings.
 */
async function copyDocuments(documents: readonly CorpusDocument[], marcPath: string): Promise<void> {
  if (documents.length === 0) return;
  const workspaceRoot = path.dirname(marcPath);
  for (const document of documents) {
    const target = path.join(workspaceRoot, ...document.relativePath.split("/"));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(document.absolutePath, target);
  }
  await writeDocumentSources(marcPath, documents);
}

async function writeDocumentSources(marcPath: string, documents: readonly CorpusDocument[]): Promise<void> {
  const configPath = path.join(marcPath, "marc.config.json");
  const config = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
  const memory = (config.memory ?? {}) as Record<string, unknown>;
  const documentSources = documents.map((document) => ({
    path: document.relativePath,
    authority: document.authority
  }));
  const next = { ...config, memory: { ...memory, documentSources } };
  await fs.writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`);
}

/** Authority names of the memory sources, mapped back to the names of the settings. */
const CONFIGURED_AUTHORITY: Readonly<Record<string, string>> = {
  rule: "normative",
  document: "reference"
};

/**
 * The documents that the workspace configures in `memory.documentSources`, read with the production
 * reader: the same settings normalization, the same files and directory entries, and the same limits.
 * The workspace is read without `initWorkspace`, so nothing is created in the repository.
 */
export async function configuredDocumentsOf(input: {
  repositoryRoot: string;
}): Promise<CorpusDocument[]> {
  const info = await getWorkspaceInfo(input.repositoryRoot);
  const settings = await readWorkspaceSettingsInWorkspace(info);
  const sources = await readDocumentSources(info, settings);
  return sources.map((source) => ({
    relativePath: source.sourcePath,
    absolutePath: path.join(input.repositoryRoot, ...source.sourcePath.split("/")),
    authority: CONFIGURED_AUTHORITY[source.authority] ?? source.authority
  }));
}

async function copyRules(
  rulesPath: string | undefined,
  marcPath: string
): Promise<void> {
  if (rulesPath === undefined) return;
  await fs.copyFile(rulesPath, path.join(marcPath, "RULES.md"));
}

async function corpusFiles(source: CorpusSource): Promise<CorpusFile[]> {
  const threadFiles = await Promise.all(
    source.threadIds.map(async (threadId) => {
      const root = path.join(source.threadsRoot, threadId);
      const relatives = await listFiles(root);
      return relatives.map((relative) => ({
        relativePath: `threads/${threadId}/${relative}`,
        absolutePath: path.join(root, relative)
      }));
    })
  );
  const documents = (source.documents ?? []).map((document) => ({
    relativePath: document.relativePath,
    absolutePath: document.absolutePath
  }));
  const files = [...threadFiles.flat(), ...rulesFiles(source.rulesPath), ...documents];
  return files.sort(compareRelativePaths);
}

function rulesFiles(rulesPath: string | undefined): CorpusFile[] {
  if (rulesPath === undefined) return [];
  return [{ relativePath: "RULES.md", absolutePath: rulesPath }];
}

/** Lists the files below `root`, relative to it, with forward slashes. */
async function listFiles(root: string, relative = ""): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, relative), {
    withFileTypes: true
  });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryRelative = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) return listFiles(root, entryRelative);
      return [entryRelative];
    })
  );
  return nested.flat();
}

function compareRelativePaths(left: CorpusFile, right: CorpusFile): number {
  return (
    Number(left.relativePath > right.relativePath) -
    Number(left.relativePath < right.relativePath)
  );
}
