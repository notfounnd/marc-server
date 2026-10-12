import os from "node:os";
import path from "node:path";
import type { ThreadResolutionFileSystem } from "../src/mcp/thread-resolution.js";

export type ThreadResolutionFixtureEntry = {
  path: string;
  type: "directory" | "file" | "symlink";
};

export type ThreadResolutionFixtureError = {
  operation: "lstat" | "readdir";
  path: string;
  code: string;
  message?: string;
};

export type ThreadResolutionFixtureOptions = {
  root: string;
  entries: readonly ThreadResolutionFixtureEntry[];
  errors?: readonly ThreadResolutionFixtureError[];
};

export const fixtureWorkspace = path.join(
  os.tmpdir(),
  "marc-thread-resolution-fixture-only"
);
export const fixtureBaseEntries: ThreadResolutionFixtureEntry[] = [
  { path: ".marc", type: "directory" },
  { path: ".marc/threads", type: "directory" }
];
export const threadNotFound = {
  ok: false,
  error: { code: "thread_not_found", message: "Thread not found." }
} as const;
export const invalidThreadId = {
  ok: false,
  error: {
    code: "invalid_thread_id",
    message: "Thread ID must not contain path separators or traversal segments."
  }
} as const;
export const ambiguousThreadSuffix = {
  ok: false,
  error: {
    code: "ambiguous_thread_id",
    message: "Thread ID suffix matches multiple threads.",
    details: { candidates: ["alpha-deadbeef", "zeta-deadbeef"] }
  }
} as const;
export const filesystemFailureCases = [
  {
    name: "readdir EACCES",
    operation: "readdir",
    path: ".marc/threads",
    code: "EACCES"
  },
  {
    name: "unexpected EIO",
    operation: "lstat",
    path: ".marc",
    code: "EIO"
  }
] as const;

type FixtureMetadata = Awaited<ReturnType<ThreadResolutionFileSystem["lstat"]>>;

const metadataByType: Record<
  ThreadResolutionFixtureEntry["type"],
  FixtureMetadata
> = {
  directory: { isDirectory: () => true, isFile: () => false },
  file: { isDirectory: () => false, isFile: () => true },
  symlink: { isDirectory: () => false, isFile: () => false }
};

export function regularThreadFixtureEntries(
  threadIds: readonly string[]
): ThreadResolutionFixtureEntry[] {
  return [
    ...fixtureBaseEntries,
    ...threadIds.flatMap((threadId) => [
      { path: `.marc/threads/${threadId}`, type: "directory" as const },
      { path: `.marc/threads/${threadId}/CHAT.md`, type: "file" as const }
    ])
  ];
}

export function linkedThreadDirectoryEntries(
  threadId: string
): ThreadResolutionFixtureEntry[] {
  return [{ path: `.marc/threads/${threadId}`, type: "symlink" }];
}

export function linkedChatEntries(
  threadId: string
): ThreadResolutionFixtureEntry[] {
  return [
    { path: `.marc/threads/${threadId}`, type: "directory" },
    { path: `.marc/threads/${threadId}/CHAT.md`, type: "symlink" }
  ];
}

export function fixtureFileSystem(
  entries: readonly ThreadResolutionFixtureEntry[],
  errors: readonly ThreadResolutionFixtureError[] = []
): ThreadResolutionFileSystem {
  return createThreadResolutionFixture({
    root: fixtureWorkspace,
    entries,
    errors
  });
}

export function createThreadResolutionFixture({
  root,
  entries,
  errors = []
}: ThreadResolutionFixtureOptions): ThreadResolutionFileSystem {
  const normalizedEntries = entries.map((entry) => ({
    path: path.resolve(root, entry.path),
    type: entry.type
  }));
  const childNamesByDirectory = new Map<string, string[]>(
    normalizedEntries
      .filter((entry) => entry.type === "directory")
      .map((entry) => [entry.path, []])
  );
  normalizedEntries.forEach((entry) => {
    const parentPath = path.dirname(entry.path);
    const childNames = childNamesByDirectory.get(parentPath) ?? [];
    childNamesByDirectory.set(parentPath, [
      ...childNames,
      path.basename(entry.path)
    ]);
  });

  const lstatOperations = new Map<string, () => Promise<FixtureMetadata>>(
    normalizedEntries.map((entry) => [
      entry.path,
      () => Promise.resolve(metadataByType[entry.type])
    ])
  );
  const readdirOperations = new Map<string, () => Promise<string[]>>(
    [...childNamesByDirectory].map(([directoryPath, childNames]) => [
      directoryPath,
      () => Promise.resolve(childNames)
    ])
  );

  errors
    .filter((error) => error.operation === "lstat")
    .forEach((error) => {
      const targetPath = path.resolve(root, error.path);
      lstatOperations.set(targetPath, () =>
        Promise.reject(fileSystemError(error))
      );
    });
  errors
    .filter((error) => error.operation === "readdir")
    .forEach((error) => {
      const targetPath = path.resolve(root, error.path);
      readdirOperations.set(targetPath, () =>
        Promise.reject(fileSystemError(error))
      );
    });

  return {
    lstat: (targetPath) =>
      runFixtureOperation(lstatOperations, path.resolve(targetPath)),
    readdir: (targetPath) =>
      runFixtureOperation(readdirOperations, path.resolve(targetPath))
  };
}

function runFixtureOperation<T>(
  operations: Map<string, () => Promise<T>>,
  targetPath: string
): Promise<T> {
  const missingPath = () => Promise.reject(missingPathError(targetPath));
  return (operations.get(targetPath) ?? missingPath)();
}

function missingPathError(targetPath: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`ENOENT: ${targetPath}`), { code: "ENOENT" });
}

function fileSystemError(
  error: ThreadResolutionFixtureError
): NodeJS.ErrnoException {
  return Object.assign(
    new Error(error.message ?? `${error.code}: ${error.path}`),
    {
      code: error.code
    }
  );
}
