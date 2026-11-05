import fs from "node:fs/promises";
import path from "node:path";
import type { RegistryFile } from "../core/session-slots.js";
import type { ThreadExtras } from "./activation-file.js";
import {
  createMarkedWriter,
  isSafeSegment,
  readMarked,
  recoverMarked,
  type MarkedSpec,
  type MarkedWriter,
  type RecoverOutcome
} from "./marked-file.js";
import type { AtomicWriter } from "./registry-file.js";
import {
  emptyRegistryFile,
  isRegistryFile,
  serializeRegistry
} from "./session-file.js";

/**
 * One state file per thread, under threads/<workspaceId>/<threadId>.json. It holds
 * the F2 session slots of that thread and, from F3, the activation counters. Only
 * the daemon writes it. Each file has its own queue, so a write to one thread never
 * waits for or touches another.
 */
export const THREADS_DIRECTORY = "threads";
const LOST_REASON = "registry_lost";

export type ThreadScope = { workspaceId: string; threadId: string };
export type ThreadFile = RegistryFile & ThreadExtras;

export type ThreadView =
  | { status: "ready"; file: ThreadFile; exists: boolean }
  | { status: "invalid"; reason: string };

/**
 * What one step of a thread update answers, and the file it writes. A step that writes only a periodic presence
 * mark (a heartbeat, an observation that only refreshes its instant) sets `quiet`: the write is kept, and nothing
 * is announced, so a panel does not reload for a mark it does not show. Every other write announces.
 */
export type ThreadStep<T> = { value: T; file?: ThreadFile; quiet?: boolean };

/** closed: the thread's SUMMARY.md exists, so no operation may create or change its state. */
export type ThreadUpdate<T> =
  | { status: "done"; value: T }
  | { status: "invalid"; reason: string }
  | { status: "closed" };

export type ThreadStoreDependencies = {
  writeAtomic: AtomicWriter;
  now: () => string;
  /** Asked inside each thread's queue before any write. The default says nothing is closed. */
  isClosed?: (scope: ThreadScope) => Promise<boolean>;
  /**
   * Told after a write that changed a thread's state file, from any path: a route, the supervisor, a
   * reservation or a sweep. The panel refreshes on it, so a change made in the background shows up.
   */
  changed?: (scope: ThreadScope) => void;
};

export type ThreadStore = {
  read(scope: ThreadScope): Promise<ThreadView>;
  update<T>(
    scope: ThreadScope,
    step: (file: ThreadFile) => ThreadStep<T> | Promise<ThreadStep<T>>
  ): Promise<ThreadUpdate<T>>;
  remove(scope: ThreadScope): Promise<void>;
  recover(scope: ThreadScope): Promise<RecoverOutcome>;
  scopes(workspaceId?: string): Promise<ThreadScope[]>;
};

export const THREAD_SPEC: MarkedSpec<ThreadFile> = {
  validate: (value): value is ThreadFile => isRegistryFile(value),
  lostReason: LOST_REASON
};

type Context = {
  root: string;
  writer: MarkedWriter;
  now: () => string;
  isClosed: (scope: ThreadScope) => Promise<boolean>;
  changed: (scope: ThreadScope) => void;
};

export function createThreadStore(
  dataDir: string,
  dependencies: ThreadStoreDependencies
): ThreadStore {
  const context: Context = {
    root: path.join(dataDir, THREADS_DIRECTORY),
    writer: createMarkedWriter(dependencies.writeAtomic, dependencies.now),
    now: dependencies.now,
    isClosed: dependencies.isClosed ?? (async () => false),
    changed: dependencies.changed ?? (() => undefined)
  };
  return {
    read: (scope) => readIn(context, scope),
    update: (scope, step) => updateIn(context, scope, step),
    remove: (scope) => removeIn(context, scope),
    recover: (scope) => recoverIn(context, scope),
    scopes: (workspaceId) => scopesIn(context, workspaceId)
  };
}

/** Maps a scope to its file. Unsafe ids have no file, so they can never leave the folder. */
export function threadFilePath(
  root: string,
  scope: ThreadScope
): string | undefined {
  if (!isSafeSegment(scope.workspaceId)) return undefined;
  if (!isSafeSegment(scope.threadId)) return undefined;
  return path.join(root, scope.workspaceId, `${scope.threadId}.json`);
}

async function readIn(
  context: Context,
  scope: ThreadScope
): Promise<ThreadView> {
  const filePath = threadFilePath(context.root, scope);
  if (!filePath) return { status: "invalid", reason: "invalid_slot" };
  const view = await readMarked(filePath, THREAD_SPEC);
  if (view.status === "invalid") return view;
  return {
    status: "ready",
    file: view.file ?? emptyRegistryFile(),
    exists: view.exists
  };
}

async function updateIn<T>(
  context: Context,
  scope: ThreadScope,
  step: (file: ThreadFile) => ThreadStep<T> | Promise<ThreadStep<T>>
): Promise<ThreadUpdate<T>> {
  const filePath = threadFilePath(context.root, scope);
  if (!filePath) return { status: "invalid", reason: "invalid_slot" };
  return context.writer.run(filePath, async (): Promise<ThreadUpdate<T>> => {
    if (await context.isClosed(scope)) return { status: "closed" };
    const view = await readMarked(filePath, THREAD_SPEC);
    if (view.status === "invalid") return view;
    const next = await step(
      view.file ?? { ...emptyRegistryFile(), createdAt: context.now() }
    );
    if (!next.file) return { status: "done", value: next.value };
    const body = serializeRegistry(next.file);
    // A write that leaves the file as it was does not announce a change.
    const changed =
      view.file === undefined || serializeRegistry(view.file) !== body;
    await context.writer.persist(filePath, body);
    if (changed && next.quiet !== true) context.changed(scope);
    return { status: "done", value: next.value };
  });
}

async function removeIn(context: Context, scope: ThreadScope): Promise<void> {
  const filePath = threadFilePath(context.root, scope);
  if (!filePath) return;
  await context.writer.run(filePath, () => context.writer.remove(filePath));
}

/**
 * A recovered thread has no slots and no activation, so an enabled policy reads as
 * unauthorized until the human saves it again.
 */
async function recoverIn(
  context: Context,
  scope: ThreadScope
): Promise<RecoverOutcome> {
  const filePath = threadFilePath(context.root, scope);
  if (!filePath) return { kind: "conflict" };
  if (await context.isClosed(scope)) return { kind: "closed" };
  return recoverMarked(
    context.writer,
    filePath,
    THREAD_SPEC,
    context.now(),
    (recovery): ThreadFile => ({
      version: 1,
      generation: 0,
      slots: {},
      createdAt: context.now(),
      recoveries: [recovery]
    })
  );
}

async function scopesIn(
  context: Context,
  workspaceId: string | undefined
): Promise<ThreadScope[]> {
  const workspaces =
    workspaceId === undefined
      ? await childNames(context.root, true)
      : [workspaceId];
  const groups = await Promise.all(
    workspaces.filter(isSafeSegment).map(async (name) =>
      (await threadIdsIn(path.join(context.root, name))).map((threadId) => ({
        workspaceId: name,
        threadId
      }))
    )
  );
  return groups.flat();
}

async function threadIdsIn(directory: string): Promise<string[]> {
  const names = await childNames(directory, false);
  const ids = names.map(threadIdOf).filter(isThreadId);
  return [...new Set(ids)].sort();
}

/** A data file or its marker names the thread. Moved-aside copies match neither suffix. */
function threadIdOf(name: string): string | undefined {
  if (name.endsWith(".meta.json")) return name.slice(0, -".meta.json".length);
  if (name.endsWith(".json")) return name.slice(0, -".json".length);
  return undefined;
}

function isThreadId(value: string | undefined): value is string {
  return value !== undefined && isSafeSegment(value);
}

async function childNames(
  directory: string,
  directoriesOnly: boolean
): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) =>
        directoriesOnly ? entry.isDirectory() : entry.isFile()
      )
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
