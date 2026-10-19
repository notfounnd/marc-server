import { parseMessages } from "../../markdown.js";
import type { ChatMessage, WorkspaceInfo } from "../../types.js";
import { passageEmbeddingContext } from "./chunks.js";
import {
  MEMORY_SOURCE_AUTHORITIES,
  type MemoryChunk,
  type MemorySource
} from "./contract.js";
import { rootRelativePath, sha256Hex, sourceHash } from "./files.js";
import { markdownToIndexText } from "./markdown-text.js";
import { readClosedThreads, type ClosedThread } from "./threads.js";

const MESSAGE_PATTERN =
  /<!-- marc-message([\s\S]*?)-->\s*([\s\S]*?)\s*<!-- \/marc-message -->/g;
const MESSAGE_END = "<!-- /marc-message -->";

export type MessageLineRange = {
  messageId: string;
  lineStart: number;
  lineEnd: number;
};

// Pure: 1-based lines of each message's opening and closing markers.
export function messageLineRanges(markdown: string): MessageLineRange[] {
  return [...markdown.matchAll(MESSAGE_PATTERN)].flatMap((match) =>
    lineRangeOf(markdown, match)
  );
}

// Pure: the range for one message id, or undefined when the id is absent.
export function findMessageLines(
  ranges: readonly MessageLineRange[],
  messageId: string
): MessageLineRange | undefined {
  return ranges.find((range) => range.messageId === messageId);
}

// Closed threads only; each CHAT.md becomes one source with one section per
// message.
export async function readChatSources(
  info: WorkspaceInfo
): Promise<MemorySource[]> {
  const threads = await readClosedThreads(info);
  return threads.flatMap((thread) => chatSource(info, thread));
}

function chatSource(info: WorkspaceInfo, thread: ClosedThread): MemorySource[] {
  const chat = thread.chat;
  if (!chat) return [];
  const markdown = chat.bytes.toString("utf8");
  return [
    {
      sourceType: "chat",
      threadId: thread.threadId,
      title: thread.title,
      closedAt: thread.closedAt,
      summaryPath: thread.summaryPath,
      relativeSummaryPath: thread.relativeSummaryPath,
      reference: thread.reference,
      markdown,
      sourcePath: rootRelativePath(info, chat.path),
      sourceSha256: sha256Hex(chat.bytes),
      sha256: sourceHash(markdown, thread.title),
      mtimeMs: chat.mtimeMs,
      authority: MEMORY_SOURCE_AUTHORITIES.chat,
      chunks: messageChunks(thread.threadId, markdown)
    }
  ];
}

function messageChunks(threadId: string, markdown: string): MemoryChunk[] {
  const ranges = messageLineRanges(markdown);
  return parseMessages(markdown).flatMap((message) =>
    messageChunk(threadId, message, findMessageLines(ranges, message.id))
  );
}

function messageChunk(
  threadId: string,
  message: ChatMessage,
  lines: MessageLineRange | undefined
): MemoryChunk[] {
  if (!lines) return [];
  const sectionTitle = `${message.agentId} ${message.timestamp}`;
  const text = markdownToIndexText(message.body);
  return [
    {
      recordId: `${threadId}:chat:${message.id}`,
      kind: "section",
      sectionTitle,
      text,
      embeddingText: passageEmbeddingContext(sectionTitle, text),
      lineStart: lines.lineStart,
      lineEnd: lines.lineEnd,
      passageOrdinal: 0,
      messageId: message.id,
      agentId: message.agentId
    }
  ];
}

function lineRangeOf(
  markdown: string,
  match: RegExpMatchArray
): MessageLineRange[] {
  const messageId = messageIdOf(match[1] ?? "");
  if (!messageId) return [];
  const start = match.index ?? 0;
  const end = start + match[0].lastIndexOf(MESSAGE_END);
  return [
    {
      messageId,
      lineStart: lineOf(markdown, start),
      lineEnd: lineOf(markdown, end)
    }
  ];
}

function messageIdOf(meta: string): string | undefined {
  return /^\s*id:\s*(.*?)\s*$/m.exec(meta)?.[1] || undefined;
}

function lineOf(markdown: string, offset: number): number {
  return markdown.slice(0, offset).split("\n").length;
}
