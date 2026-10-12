import path from "node:path";
import type {
  ThreadSummaryPathMetadata,
  ThreadSummaryPathMetadataReader
} from "../src/core/thread-summary-paths.js";
import type { WorkspaceInfo } from "../src/core/types.js";

export type SummaryPathNodeKind = "directory" | "file" | "symbolic-link";

export type SummaryPathNode = {
  path: string;
  kind: SummaryPathNodeKind;
  realPath: string;
};

export type SummaryPathError = {
  path: string;
  code: string;
};

export type SummaryPathFixtureOverrides = {
  entries?: readonly SummaryPathNode[];
  lstatErrors?: readonly SummaryPathError[];
  realpathErrors?: readonly SummaryPathError[];
};

const metadataByKind: Record<SummaryPathNodeKind, ThreadSummaryPathMetadata> = {
  directory: {
    isDirectory: () => true,
    isFile: () => false,
    isSymbolicLink: () => false
  },
  file: {
    isDirectory: () => false,
    isFile: () => true,
    isSymbolicLink: () => false
  },
  "symbolic-link": {
    isDirectory: () => false,
    isFile: () => false,
    isSymbolicLink: () => true
  }
};

export function createThreadSummaryPathMetadataFixture(
  info: WorkspaceInfo,
  threadId: string,
  overrides: SummaryPathFixtureOverrides = {}
): ThreadSummaryPathMetadataReader {
  const threadsPath = path.join(info.marcPath, "threads");
  const threadPath = path.join(threadsPath, threadId);
  const chatPath = path.join(threadPath, "CHAT.md");
  const summaryPath = path.join(threadPath, "SUMMARY.md");
  const nodes = new Map<string, SummaryPathNode>([
    [
      info.marcPath,
      { path: info.marcPath, kind: "directory", realPath: info.marcPath }
    ],
    [
      threadsPath,
      { path: threadsPath, kind: "directory", realPath: threadsPath }
    ],
    [threadPath, { path: threadPath, kind: "directory", realPath: threadPath }],
    [chatPath, { path: chatPath, kind: "file", realPath: chatPath }]
  ]);
  (overrides.entries ?? []).forEach((entry) => nodes.set(entry.path, entry));

  const lstatOperations = new Map<
    string,
    () => Promise<ThreadSummaryPathMetadata>
  >([[summaryPath, () => Promise.reject(fixtureError("ENOENT", summaryPath))]]);
  nodes.forEach((entry) =>
    lstatOperations.set(entry.path, () =>
      Promise.resolve(metadataByKind[entry.kind])
    )
  );
  (overrides.lstatErrors ?? []).forEach(({ path: filePath, code }) =>
    lstatOperations.set(filePath, () =>
      Promise.reject(fixtureError(code, filePath))
    )
  );

  const realpathOperations = new Map<string, () => Promise<string>>([
    [info.rootPath, () => Promise.resolve(info.rootPath)]
  ]);
  nodes.forEach((entry) =>
    realpathOperations.set(entry.path, () => Promise.resolve(entry.realPath))
  );
  (overrides.realpathErrors ?? []).forEach(({ path: filePath, code }) =>
    realpathOperations.set(filePath, () =>
      Promise.reject(fixtureError(code, filePath))
    )
  );

  return {
    lstat: (filePath) => runFixtureOperation(lstatOperations, filePath),
    realpath: (filePath) => runFixtureOperation(realpathOperations, filePath)
  };
}

function runFixtureOperation<T>(
  operations: Map<string, () => Promise<T>>,
  filePath: string
): Promise<T> {
  const missingPath = () => Promise.reject(fixtureError("ENOENT", filePath));
  return (operations.get(filePath) ?? missingPath)();
}

function fixtureError(
  code: string,
  filePath: string
): Error & { code: string } {
  return Object.assign(new Error(`Fixture ${filePath} is unavailable.`), {
    code
  });
}
