import path from "node:path";
import {
  emptyWorkspaceFile,
  isWorkspaceFile,
  type WorkspaceFile
} from "./activation-file.js";
import {
  createMarkedWriter,
  isSafeSegment,
  readMarked,
  recoverMarked,
  serializeMarked,
  type MarkedSpec,
  type MarkedWriter,
  type RecoverOutcome
} from "./marked-file.js";
import type { ThreadStoreDependencies } from "./thread-store.js";

/**
 * One file per workspace under workspaces/<workspaceId>.json, holding the pause
 * state of "Pausar tudo" for that workspace on this machine. It never enters the
 * repository, because a commit cannot pause another machine.
 */
export const WORKSPACES_DIRECTORY = "workspaces";
const LOST_REASON = "workspace_lost";

export type WorkspaceView =
  | { status: "ready"; file: WorkspaceFile; exists: boolean }
  | { status: "invalid"; reason: string };

export type WorkspaceStep<T> = { value: T; file?: WorkspaceFile };

export type WorkspaceUpdate<T> =
  | { status: "done"; value: T }
  | { status: "invalid"; reason: string };

export type WorkspaceStore = {
  read(workspaceId: string): Promise<WorkspaceView>;
  update<T>(
    workspaceId: string,
    step: (file: WorkspaceFile) => WorkspaceStep<T> | Promise<WorkspaceStep<T>>
  ): Promise<WorkspaceUpdate<T>>;
  recover(workspaceId: string, pausedAt: string): Promise<RecoverOutcome>;
};

const WORKSPACE_SPEC: MarkedSpec<WorkspaceFile> = {
  validate: (value): value is WorkspaceFile => isWorkspaceFile(value),
  lostReason: LOST_REASON
};

type Context = {
  root: string;
  writer: MarkedWriter;
  now: () => string;
};

export function createWorkspaceStore(
  dataDir: string,
  dependencies: ThreadStoreDependencies
): WorkspaceStore {
  const context: Context = {
    root: path.join(dataDir, WORKSPACES_DIRECTORY),
    writer: createMarkedWriter(dependencies.writeAtomic, dependencies.now),
    now: dependencies.now
  };
  return {
    read: (workspaceId) => readIn(context, workspaceId),
    update: (workspaceId, step) => updateIn(context, workspaceId, step),
    recover: (workspaceId, pausedAt) =>
      recoverIn(context, workspaceId, pausedAt)
  };
}

function fileFor(root: string, workspaceId: string): string | undefined {
  if (!isSafeSegment(workspaceId)) return undefined;
  return path.join(root, `${workspaceId}.json`);
}

async function readIn(
  context: Context,
  workspaceId: string
): Promise<WorkspaceView> {
  const filePath = fileFor(context.root, workspaceId);
  if (!filePath) return { status: "invalid", reason: "invalid_workspace" };
  const view = await readMarked(filePath, WORKSPACE_SPEC);
  if (view.status === "invalid") return view;
  return {
    status: "ready",
    file: view.file ?? emptyWorkspaceFile(),
    exists: view.exists
  };
}

async function updateIn<T>(
  context: Context,
  workspaceId: string,
  step: (file: WorkspaceFile) => WorkspaceStep<T> | Promise<WorkspaceStep<T>>
): Promise<WorkspaceUpdate<T>> {
  const filePath = fileFor(context.root, workspaceId);
  if (!filePath) return { status: "invalid", reason: "invalid_workspace" };
  return context.writer.run(filePath, async (): Promise<WorkspaceUpdate<T>> => {
    const view = await readMarked(filePath, WORKSPACE_SPEC);
    if (view.status === "invalid") return view;
    const next = await step(view.file ?? emptyWorkspaceFile());
    if (next.file) {
      await context.writer.persist(filePath, serializeMarked(next.file));
    }
    return { status: "done", value: next.value };
  });
}

/** A recovered workspace starts paused: the pause state before the loss is unknown. */
async function recoverIn(
  context: Context,
  workspaceId: string,
  pausedAt: string
): Promise<RecoverOutcome> {
  const filePath = fileFor(context.root, workspaceId);
  if (!filePath) return { kind: "conflict" };
  return recoverMarked(
    context.writer,
    filePath,
    WORKSPACE_SPEC,
    context.now(),
    (recovery): WorkspaceFile => ({
      version: 1,
      paused: true,
      pausedAt,
      pauseHistory: [{ pausedAt }],
      historyCompleteSince: pausedAt,
      recoveries: [recovery]
    })
  );
}
