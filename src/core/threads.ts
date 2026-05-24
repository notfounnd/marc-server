import fs from "node:fs/promises";
import { newId, slugify } from "./ids.js";
import { MESSAGE_STYLE_GUIDE, validateMessageBody } from "./guards.js";
import { parseMessages, renderChatHeader, renderMessage } from "./markdown.js";
import { safeJoin } from "./paths.js";
import {
  threadWriteResource,
  withWorkspaceWriteLock,
  writeFileAtomically
} from "./write-coordination.js";
import {
  JsonThreadIndexStore,
  ThreadIndexReconciler,
  threadIndexPath
} from "./thread-index.js";
import type {
  ChatMessage,
  MessageInput,
  ThreadInfo,
  ThreadInfoResult,
  ThreadListOptions,
  ThreadReadOptions,
  ThreadReadResult,
  ThreadReadSinceResult,
  ThreadTailOptions,
  ThreadTailResult,
  WorkspaceInfo
} from "./types.js";

export async function createThreadInWorkspace(
  info: WorkspaceInfo,
  title: string
): Promise<ThreadInfo> {
  const createdAt = new Date().toISOString();
  const id = `${slugify(title)}-${newId("thread").slice(-8)}`;
  const threadPath = safeJoin(info.marcPath, "threads", id);
  await fs.mkdir(safeJoin(threadPath, "artifacts"), { recursive: true });
  await writeFileAtomically(
    safeJoin(threadPath, "CHAT.md"),
    renderChatHeader(title, id, createdAt)
  );

  return { id, title, path: threadPath, createdAt, status: "open" };
}

export function listThreadsInWorkspace(
  info: WorkspaceInfo,
  options: ThreadListOptions = {}
): Promise<ThreadInfo[]> {
  const threadsRoot = safeJoin(info.marcPath, "threads");
  const reconciler = new ThreadIndexReconciler(
    threadsRoot,
    new JsonThreadIndexStore(threadIndexPath(info.marcPath))
  );
  return reconciler.list(options);
}

export async function appendMessageInWorkspace(
  info: WorkspaceInfo,
  threadId: string,
  input: MessageInput
): Promise<ChatMessage> {
  const guard = validateMessageBody(input.body);
  if (!guard.ok) {
    throw new Error(
      `${guard.reason} Message style: ${MESSAGE_STYLE_GUIDE.join(" ")}`
    );
  }

  return withWorkspaceWriteLock(
    info.marcPath,
    threadWriteResource(threadId),
    async () => {
      const chatPath = safeJoin(info.marcPath, "threads", threadId, "CHAT.md");
      if (!(await exists(chatPath))) {
        throw new Error(`Thread not found: ${threadId}`);
      }

      const message: ChatMessage = {
        id: newId("msg"),
        threadId,
        timestamp: new Date().toISOString(),
        agentId: slugify(input.agentId),
        role: input.role,
        body: input.body,
        artifacts: input.artifacts ?? []
      };
      await fs.appendFile(chatPath, renderMessage(message));
      return message;
    }
  );
}

export async function readThreadInWorkspace(
  info: WorkspaceInfo,
  threadId: string,
  options: ThreadReadOptions = {}
): Promise<ThreadReadResult> {
  const chatPath = safeJoin(info.marcPath, "threads", threadId, "CHAT.md");
  const markdown = await fs.readFile(chatPath, "utf8");
  const messages = parseMessages(markdown);
  const stats = threadMessageStats(messages);
  const includeMessages = options.includeMessages ?? true;
  const includeSummary = options.includeSummary ?? true;
  const summary = includeSummary
    ? await readTextIfExists(
        safeJoin(info.marcPath, "threads", threadId, "SUMMARY.md")
      )
    : "";

  return {
    ...(options.includeMarkdown ? { markdown } : {}),
    ...(includeMessages ? { messages } : {}),
    ...(summary ? { summary } : {}),
    ...stats
  };
}

export async function readThreadSinceInWorkspace(
  info: WorkspaceInfo,
  threadId: string,
  afterMessageId: string
): Promise<ThreadReadSinceResult> {
  const chatPath = safeJoin(info.marcPath, "threads", threadId, "CHAT.md");
  const markdown = await fs.readFile(chatPath, "utf8");
  const messages = parseMessages(markdown);
  const cursorIndex = messages.findIndex(
    (message) => message.id === afterMessageId
  );
  const stats = threadMessageStats(messages);
  if (cursorIndex === -1) {
    return {
      ok: false,
      error: "cursor_not_found",
      shouldReadFullThread: true,
      afterMessageId,
      messages: [],
      ...stats
    };
  }

  return {
    ok: true,
    afterMessageId,
    messages: messages.slice(cursorIndex + 1),
    ...stats
  };
}

export async function readThreadInfoInWorkspace(
  info: WorkspaceInfo,
  threadId: string
): Promise<ThreadInfoResult> {
  const chatPath = safeJoin(info.marcPath, "threads", threadId, "CHAT.md");
  const markdown = await fs.readFile(chatPath, "utf8");
  const messages = parseMessages(markdown);
  const stats = threadMessageStats(messages);
  const threads = await listThreadsInWorkspace(info, { status: "all" });
  const thread = threads.find((item) => item.id === threadId);
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`);
  }

  return {
    ...thread,
    ...stats,
    updatedAt: stats.updatedAt ?? thread.createdAt,
    summaryAvailable: Boolean(thread.summaryPath)
  };
}

export async function readThreadTailInWorkspace(
  info: WorkspaceInfo,
  threadId: string,
  options: ThreadTailOptions = {}
): Promise<ThreadTailResult> {
  const chatPath = safeJoin(info.marcPath, "threads", threadId, "CHAT.md");
  const markdown = await fs.readFile(chatPath, "utf8");
  const messages = parseMessages(markdown);
  const stats = threadMessageStats(messages);
  const limit = normalizeTailLimit(options.limit);

  return {
    messages: messages.slice(-limit),
    ...stats,
    limit
  };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath: string): Promise<string> {
  return (await exists(filePath)) ? fs.readFile(filePath, "utf8") : "";
}

function threadMessageStats(messages: ChatMessage[]): {
  messageCount: number;
  lastMessageId?: string;
  updatedAt?: string;
} {
  const lastMessage = messages.at(-1);
  return {
    messageCount: messages.length,
    lastMessageId: lastMessage?.id,
    updatedAt: lastMessage?.timestamp
  };
}

function normalizeTailLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 10;
  return Math.min(50, Math.max(1, Math.floor(limit)));
}
