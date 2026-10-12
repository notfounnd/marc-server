import type {
  SummaryProjectionState,
  ThreadSummaryWriteResult,
  WorkspaceInfo
} from "./types.js";
import { ThreadSummaryError } from "./thread-summary-error.js";
import {
  normalizeSummaryBody,
  parseChatThreadId,
  parseChatTitle,
  parseExistingSummary,
  renderSummary
} from "./thread-summary-markdown.js";
import {
  hashSummaryBytes,
  inspectThreadFiles,
  readExistingSummary,
  readRegularFile,
  type ExistingSummary,
  type ThreadSummaryPathMetadataReader
} from "./thread-summary-paths.js";
import {
  refreshThreadSummaryProjectionsInWorkspace,
  type WorkspaceStatusDependencies
} from "./workspace-status.js";
import {
  threadWriteResource,
  withWorkspaceWriteLock,
  writeFileAtomically,
  type AtomicRename
} from "./write-coordination.js";

export type ThreadSummaryWriteInput = {
  threadId: string;
  body: string;
  mode?: "create" | "update";
  expectedSummaryRevision?: string;
};

export type ThreadSummaryWriteDependencies = {
  pathMetadata?: ThreadSummaryPathMetadataReader;
  rename?: AtomicRename;
  projections?: WorkspaceStatusDependencies;
};

export { ThreadSummaryError };
export type { ThreadSummaryErrorCode } from "./thread-summary-error.js";

type WriteContext = {
  info: WorkspaceInfo;
  threadId: string;
  title: string;
  reference: string;
  summaryPath: string;
  body: string;
  dependencies: ThreadSummaryWriteDependencies;
  existing?: ExistingSummary;
};

type SummaryCommit = Omit<ThreadSummaryWriteResult, "projections">;

type SummaryWriteMode = "create" | "update";

const summaryWriteModes: Record<
  SummaryWriteMode,
  (context: WriteContext, expectedRevision?: string) => Promise<SummaryCommit>
> = {
  create: createSummary,
  update: updateSummary
};

export async function writeThreadSummaryInWorkspace(
  info: WorkspaceInfo,
  input: ThreadSummaryWriteInput,
  dependencies: ThreadSummaryWriteDependencies = {}
): Promise<ThreadSummaryWriteResult> {
  const mode = input.mode ?? "create";
  const modeWriter = summaryWriteModes[mode];
  if (!modeWriter) throw new ThreadSummaryError("invalid_input");
  if (typeof input.body !== "string") {
    throw new ThreadSummaryError("invalid_input");
  }
  const body = normalizeSummaryBody(input.body);
  if (!body) throw new ThreadSummaryError("invalid_input");
  if (
    input.mode !== undefined &&
    input.mode !== "create" &&
    input.mode !== "update"
  ) {
    throw new ThreadSummaryError("invalid_input");
  }
  if (mode === "update" && !isRevision(input.expectedSummaryRevision)) {
    throw new ThreadSummaryError("invalid_input");
  }
  const threadId = input.threadId;
  if (!isCanonicalWriteThreadId(threadId)) {
    throw new ThreadSummaryError("invalid_thread");
  }
  await inspectThreadFiles(info, threadId, dependencies.pathMetadata);

  let commit: SummaryCommit;
  try {
    commit = await withWorkspaceWriteLock(
      info.marcPath,
      threadWriteResource(threadId),
      async () => {
        const files = await inspectThreadFiles(
          info,
          threadId,
          dependencies.pathMetadata
        );
        const chat = await readRegularFile(
          files.chatPath,
          files.threadPathReal,
          dependencies.pathMetadata
        );
        const title = parseChatTitle(chat.toString("utf8"));
        if (!title) throw new ThreadSummaryError("invalid_thread");
        const chatThreadId = parseChatThreadId(chat.toString("utf8"));
        if (chatThreadId && chatThreadId !== threadId) {
          throw new ThreadSummaryError("invalid_thread");
        }
        const existing = await readExistingSummary(
          files,
          dependencies.pathMetadata
        );
        const context: WriteContext = {
          info,
          threadId,
          title,
          reference: `marc://$${threadId}`,
          summaryPath: `threads/${threadId}/SUMMARY.md`,
          body,
          dependencies,
          existing
        };
        return modeWriter(context, input.expectedSummaryRevision);
      }
    );
  } catch (error) {
    if (error instanceof ThreadSummaryError) throw error;
    throw new ThreadSummaryError("write_failed");
  }

  const projections = await refreshSummaryProjections(
    info,
    dependencies.projections
  );
  return { ...commit, projections };
}

export async function readThreadSummarySnapshotInWorkspace(
  info: WorkspaceInfo,
  threadId: string
): Promise<{ summary: string; summaryRevision: string } | undefined> {
  const files = await inspectThreadFiles(info, threadId);
  const existing = await readExistingSummary(files);
  if (!existing) return undefined;
  return {
    summary: existing.markdown,
    summaryRevision: existing.revision
  };
}

async function createSummary(context: WriteContext): Promise<SummaryCommit> {
  if (!context.existing) return createNewSummary(context);
  const parsed = parseExistingSummary(context.existing, context.threadId);
  if (!parsed.ok || parsed.summary.body !== context.body) {
    throw new ThreadSummaryError("summary_exists");
  }
  return commitResult(
    context,
    parsed.summary.closedAt,
    context.existing.revision,
    "unchanged"
  );
}

async function createNewSummary(context: WriteContext): Promise<SummaryCommit> {
  const closedAt = new Date().toISOString();
  const markdown = renderSummary(
    context.title,
    context.reference,
    context.body,
    closedAt
  );
  await persistSummary(context, markdown);
  return commitResult(
    context,
    closedAt,
    hashSummaryBytes(Buffer.from(markdown, "utf8")),
    "created"
  );
}

async function updateSummary(
  context: WriteContext,
  expectedRevision?: string
): Promise<SummaryCommit> {
  if (!context.existing) throw new ThreadSummaryError("summary_not_found");
  const parsed = parseExistingSummary(context.existing, context.threadId);
  if (!parsed.ok) throw new ThreadSummaryError("metadata_invalid");
  if (parsed.summary.body === context.body) {
    return commitResult(
      context,
      parsed.summary.closedAt,
      context.existing.revision,
      "unchanged"
    );
  }
  if (expectedRevision !== context.existing.revision) {
    throw new ThreadSummaryError("revision_conflict", {
      expectedRevision: expectedRevision ?? "",
      currentRevision: context.existing.revision
    });
  }

  const markdown = renderSummary(
    context.title,
    context.reference,
    context.body,
    parsed.summary.closedAt
  );
  await persistSummary(context, markdown);
  return commitResult(
    context,
    parsed.summary.closedAt,
    hashSummaryBytes(Buffer.from(markdown, "utf8")),
    "updated"
  );
}

function commitResult(
  context: WriteContext,
  closedAt: string,
  summaryRevision: string,
  outcome: SummaryCommit["outcome"]
): SummaryCommit {
  return {
    threadId: context.threadId,
    reference: context.reference,
    summaryPath: context.summaryPath,
    status: "closed",
    closedAt,
    summaryRevision,
    outcome
  };
}

async function persistSummary(
  context: WriteContext,
  markdown: string
): Promise<void> {
  const files = await inspectThreadFiles(
    context.info,
    context.threadId,
    context.dependencies.pathMetadata
  );
  try {
    await writeFileAtomically(files.summaryPath, markdown, {
      rename: context.dependencies.rename
    });
  } catch {
    throw new ThreadSummaryError("write_failed");
  }
}

function isRevision(revision: string | undefined): revision is string {
  return Boolean(revision && /^[a-f0-9]{64}$/.test(revision));
}

function isCanonicalWriteThreadId(threadId: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{8}$/.test(threadId);
}

async function refreshSummaryProjections(
  info: WorkspaceInfo,
  dependencies?: WorkspaceStatusDependencies
): Promise<SummaryProjectionState> {
  try {
    return await refreshThreadSummaryProjectionsInWorkspace(info, dependencies);
  } catch {
    return {
      threadIndex: "pending",
      memory: "pending",
      errors: ["thread_index_refresh_failed", "memory_status_failed"]
    };
  }
}
