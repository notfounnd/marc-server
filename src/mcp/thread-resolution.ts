import fs from "node:fs/promises";
import path from "node:path";

export type ThreadResolutionErrorCode =
  | "thread_not_found"
  | "ambiguous_thread_id"
  | "invalid_thread_id";

export type ThreadResolutionError = {
  code: ThreadResolutionErrorCode;
  message: string;
  details?: { candidates: string[] };
};

export type ThreadResolution =
  | { ok: true; threadId: string }
  | { ok: false; error: ThreadResolutionError };

type ThreadFileMetadata = Pick<
  Awaited<ReturnType<typeof fs.lstat>>,
  "isDirectory" | "isFile"
>;

export type ThreadResolutionFileSystem = {
  lstat(targetPath: string): Promise<ThreadFileMetadata>;
  readdir(directoryPath: string): Promise<string[]>;
};

const HEX_SUFFIX_PATTERN = /^[0-9a-f]{8}$/i;
const nodeThreadResolutionFileSystem: ThreadResolutionFileSystem = {
  lstat: (targetPath) => fs.lstat(targetPath),
  readdir: (directoryPath) => fs.readdir(directoryPath)
};

export async function resolveThreadId(
  workspaceRoot: string,
  requestedId: string,
  fileSystem: ThreadResolutionFileSystem = nodeThreadResolutionFileSystem
): Promise<ThreadResolution> {
  if (hasPathTraversal(requestedId)) {
    return {
      ok: false,
      error: {
        code: "invalid_thread_id",
        message:
          "Thread ID must not contain path separators or traversal segments."
      }
    };
  }

  const threads = await readThreadEntries(workspaceRoot, fileSystem);
  if (!threads) return threadNotFound();
  if (await isExactEligibleThread(threads, requestedId, fileSystem)) {
    return { ok: true, threadId: requestedId };
  }
  if (!HEX_SUFFIX_PATTERN.test(requestedId)) return threadNotFound();

  const suffix = requestedId.toLowerCase();
  const candidateNames = threads.entries.filter((threadId) =>
    hasSuffix(threadId, suffix)
  );
  const checkedCandidates = await Promise.all(
    candidateNames.map(async (threadId) =>
      (await isEligibleThread(threads.threadsPath, threadId, fileSystem))
        ? threadId
        : undefined
    )
  );
  const candidates = checkedCandidates
    .filter((threadId): threadId is string => threadId !== undefined)
    .sort();
  if (candidates.length === 1) {
    return { ok: true, threadId: candidates[0] };
  }
  if (candidates.length > 1) {
    return {
      ok: false,
      error: {
        code: "ambiguous_thread_id",
        message: "Thread ID suffix matches multiple threads.",
        details: { candidates }
      }
    };
  }

  return threadNotFound();
}

function hasPathTraversal(threadId: string): boolean {
  return (
    threadId === "." ||
    threadId === ".." ||
    threadId.includes("/") ||
    threadId.includes("\\")
  );
}

async function readThreadEntries(
  workspaceRoot: string,
  fileSystem: ThreadResolutionFileSystem
): Promise<{ threadsPath: string; entries: string[] } | undefined> {
  const marcPath = path.join(workspaceRoot, ".marc");
  const threadsPath = path.join(marcPath, "threads");
  if (!(await isRegularDirectory(marcPath, fileSystem))) return undefined;
  if (!(await isRegularDirectory(threadsPath, fileSystem))) return undefined;
  return { threadsPath, entries: await fileSystem.readdir(threadsPath) };
}

async function isEligibleThread(
  threadsPath: string,
  threadId: string,
  fileSystem: ThreadResolutionFileSystem
): Promise<boolean> {
  const threadPath = path.join(threadsPath, threadId);
  if (!(await isRegularDirectory(threadPath, fileSystem))) return false;
  const chatStat = await lstatIfPresent(
    path.join(threadPath, "CHAT.md"),
    fileSystem
  );
  return chatStat?.isFile() === true;
}

async function isExactEligibleThread(
  threads: { threadsPath: string; entries: string[] },
  threadId: string,
  fileSystem: ThreadResolutionFileSystem
): Promise<boolean> {
  if (!threads.entries.includes(threadId)) return false;
  return isEligibleThread(threads.threadsPath, threadId, fileSystem);
}

function hasSuffix(threadId: string, suffix: string): boolean {
  const separatorIndex = threadId.lastIndexOf("-");
  return (
    separatorIndex !== -1 &&
    threadId.slice(separatorIndex + 1).toLowerCase() === suffix
  );
}

async function isRegularDirectory(
  directoryPath: string,
  fileSystem: ThreadResolutionFileSystem
): Promise<boolean> {
  const stat = await lstatIfPresent(directoryPath, fileSystem);
  return stat?.isDirectory() === true;
}

async function lstatIfPresent(
  targetPath: string,
  fileSystem: ThreadResolutionFileSystem
): Promise<ThreadFileMetadata | undefined> {
  try {
    return await fileSystem.lstat(targetPath);
  } catch (error) {
    if (!isMissingPath(error)) throw error;
    return undefined;
  }
}

function isMissingPath(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

function threadNotFound(): ThreadResolution {
  return {
    ok: false,
    error: { code: "thread_not_found", message: "Thread not found." }
  };
}
