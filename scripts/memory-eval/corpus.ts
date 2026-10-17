import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { WorkspaceInfo } from "../../src/core/types.js";
import { initWorkspace } from "../../src/core/workspace.js";

export type CorpusSource = {
  /** Directory whose children are thread folders with SUMMARY.md and CHAT.md. */
  threadsRoot: string;
  /** Frozen thread ids. Only these folders are copied and digested. */
  threadIds: readonly string[];
  /** RULES.md copied next to the threads, when present. */
  rulesPath?: string;
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

async function copyCorpus(source: CorpusSource, marcPath: string): Promise<void> {
  for (const threadId of source.threadIds) {
    await fs.cp(
      path.join(source.threadsRoot, threadId),
      path.join(marcPath, "threads", threadId),
      { recursive: true }
    );
  }
  await copyRules(source.rulesPath, marcPath);
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
  const files = [...threadFiles.flat(), ...rulesFiles(source.rulesPath)];
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
