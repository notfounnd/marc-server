import fs from "node:fs/promises";
import path from "node:path";
import { safeJoin } from "../../paths.js";
import type { WorkspaceInfo } from "../../types.js";
import {
  marcRelativePath,
  readRegularFile,
  type RegularFile
} from "./files.js";

const SUMMARY_FILE = "SUMMARY.md";
const CHAT_FILE = "CHAT.md";

// A closed thread is a thread directory with a non-empty SUMMARY.md.
export type ClosedThread = {
  threadId: string;
  title: string;
  closedAt?: string;
  reference: string;
  threadPath: string;
  summaryPath: string;
  relativeSummaryPath: string;
  summary: RegularFile;
  summaryMarkdown: string;
  chat?: RegularFile;
};

export async function readClosedThreads(
  info: WorkspaceInfo
): Promise<ClosedThread[]> {
  const threadsRoot = safeJoin(info.marcPath, "threads");
  const entries = await fs
    .readdir(threadsRoot, { withFileTypes: true })
    .catch(() => []);
  const threads = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => readClosedThread(info, entry.name))
  );
  return threads
    .filter((thread): thread is ClosedThread => thread !== undefined)
    .sort((left, right) => left.threadId.localeCompare(right.threadId));
}

async function readClosedThread(
  info: WorkspaceInfo,
  directoryName: string
): Promise<ClosedThread | undefined> {
  const threadPath = safeJoin(info.marcPath, "threads", directoryName);
  const summary = await readRegularFile(
    info.rootPath,
    path.join(threadPath, SUMMARY_FILE)
  );
  if (!summary?.bytes.length) return undefined;
  const chat = await readRegularFile(
    info.rootPath,
    path.join(threadPath, CHAT_FILE)
  );
  const summaryMarkdown = summary.bytes.toString("utf8");
  const chatMarkdown = chat?.bytes.toString("utf8");
  const threadId = parseThreadId(summaryMarkdown) ?? directoryName;
  return {
    threadId,
    title: parseChatTitle(chatMarkdown) ?? parseSummaryTitle(summaryMarkdown),
    closedAt: parseClosedAt(summaryMarkdown),
    reference: `marc://$${threadId}`,
    threadPath,
    summaryPath: summary.path,
    relativeSummaryPath: marcRelativePath(info, summary.path),
    summary,
    summaryMarkdown,
    chat
  };
}

function parseChatTitle(markdown: string | undefined): string | undefined {
  return /^#\s+(.+)$/m.exec(markdown ?? "")?.[1]?.trim() || undefined;
}

function parseThreadId(markdown: string): string | undefined {
  const rawThreadId = /^Thread:\s+`?([^`\n]+)`?$/m.exec(markdown)?.[1]?.trim();
  if (!rawThreadId) return undefined;
  return normalizeThreadId(rawThreadId);
}

function parseClosedAt(markdown: string): string | undefined {
  return /^Closed:\s+`?([^`\n]+)`?$/m.exec(markdown)?.[1]?.trim();
}

function parseSummaryTitle(markdown: string): string {
  const heading = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim();
  const title = heading
    ?.replace(/^Resumo\s+-\s+/i, "")
    .replace(/^Summary\s+-\s+/i, "")
    .trim();
  return title || "Thread summary";
}

function normalizeThreadId(rawThreadId: string): string {
  const match = /^marc:\/\/\$([^#\s`]+)/.exec(rawThreadId);
  if (!match) return rawThreadId;
  return match[1]!;
}
