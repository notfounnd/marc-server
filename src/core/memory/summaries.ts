import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { slugify } from "../ids.js";
import { safeJoin } from "../paths.js";
import type { WorkspaceInfo } from "../types.js";
import type {
  MemoryChunk,
  RerankingProvider,
  ThreadSummarySource
} from "./types.js";

const SUMMARY_FILE = "SUMMARY.md";
const CHAT_FILE = "CHAT.md";
const MAX_PASSAGE_TOKENS = 320;
const PASSAGE_OVERLAP_TOKENS = 48;

export async function scanThreadSummarySources(
  info: WorkspaceInfo
): Promise<ThreadSummarySource[]> {
  const threadsRoot = safeJoin(info.marcPath, "threads");
  const entries = await fs
    .readdir(threadsRoot, { withFileTypes: true })
    .catch(() => []);
  const summaries: ThreadSummarySource[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const summary = await readThreadSummarySource(info, entry.name);
    if (!summary) continue;
    summaries.push(summary);
  }

  return summaries.sort((left, right) =>
    left.threadId.localeCompare(right.threadId)
  );
}

export async function materializeThreadSummarySources(
  sources: ThreadSummarySource[],
  reranker: RerankingProvider
): Promise<ThreadSummarySource[]> {
  const chunks = sources.flatMap((source) =>
    source.chunks.filter((chunk) => chunk.kind !== "identity")
  );
  if (!chunks.length) return sources;
  const passages = await reranker.splitPassages(
    chunks.map((chunk) => chunk.text),
    {
      maxTokens: MAX_PASSAGE_TOKENS,
      overlapTokens: PASSAGE_OVERLAP_TOKENS
    }
  );
  if (passages.length !== chunks.length)
    throw new Error("Memory passage segmenter returned an unexpected count.");

  const passagesByRecordId = new Map(
    chunks.map((chunk, index) => [chunk.recordId, passages[index] ?? []])
  );
  return sources.map((source) => ({
    ...source,
    chunks: source.chunks.flatMap((chunk) => {
      if (chunk.kind === "identity") return [chunk];
      return passageChunks(chunk, passagesByRecordId.get(chunk.recordId) ?? []);
    })
  }));
}

async function readThreadSummarySource(
  info: WorkspaceInfo,
  directoryName: string
): Promise<ThreadSummarySource | undefined> {
  const summaryPath = safeJoin(
    info.marcPath,
    "threads",
    directoryName,
    SUMMARY_FILE
  );
  const markdown = await fs
    .readFile(summaryPath, "utf8")
    .catch(() => undefined);
  if (!markdown) return undefined;

  const chatMarkdown = await fs
    .readFile(
      safeJoin(info.marcPath, "threads", directoryName, CHAT_FILE),
      "utf8"
    )
    .catch(() => undefined);
  const stat = await fs.stat(summaryPath);
  const threadId = parseThreadId(markdown) ?? directoryName;
  const title = parseChatTitle(chatMarkdown) ?? parseSummaryTitle(markdown);
  const closedAt = parseClosedAt(markdown);
  const relativeSummaryPath = path
    .relative(info.marcPath, summaryPath)
    .replaceAll("\\", "/");

  return {
    threadId,
    title,
    closedAt,
    summaryPath,
    relativeSummaryPath,
    reference: `marc://$${threadId}`,
    markdown,
    sha256: sourceHash(markdown, title),
    mtimeMs: stat.mtimeMs,
    chunks: buildSummaryChunks(threadId, title, markdown)
  };
}

function parseChatTitle(markdown: string | undefined): string | undefined {
  return /^#\s+(.+)$/m.exec(markdown ?? "")?.[1]?.trim() || undefined;
}

function sourceHash(markdown: string, title: string): string {
  return createHash("sha256")
    .update(markdown)
    .update("\0")
    .update(title)
    .digest("hex");
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

function buildSummaryChunks(
  threadId: string,
  title: string,
  markdown: string
): MemoryChunk[] {
  const identity = identityChunk(threadId, title, markdown);
  const sections = parseSecondLevelSections(markdown);
  if (sections.length)
    return [
      identity,
      ...sections.map((section) => sourceChunk(threadId, section))
    ];

  const text = normalizeMarkdownForEmbedding(markdown);
  if (!text) return [identity];
  return [identity, sourceChunk(threadId, { title: "Overview", text })];
}

function identityChunk(
  threadId: string,
  title: string,
  markdown: string
): MemoryChunk {
  const text = executiveSynthesis(markdown);
  return {
    recordId: `${threadId}:identity`,
    kind: "identity",
    text,
    embeddingText: `Thread: ${title}. Summary: ${text}`
  };
}

function executiveSynthesis(markdown: string): string {
  const sections = parseSecondLevelSections(markdown);
  const first = sections.find((section) => section.text);
  if (first) return `${first.title}. ${first.text}`;
  return normalizeMarkdownForEmbedding(markdown);
}

function sourceChunk(
  threadId: string,
  section: { title: string; text: string }
): MemoryChunk {
  return {
    recordId: `${threadId}:source:${slugify(section.title)}`,
    kind: "section",
    sectionTitle: section.title,
    text: section.text,
    embeddingText: passageEmbeddingContext(section.title, section.text)
  };
}

function passageChunks(chunk: MemoryChunk, passages: string[]): MemoryChunk[] {
  const sectionTitle = chunk.sectionTitle ?? "Overview";
  return passages.map((text, index) => ({
    recordId: `${chunk.recordId}:passage:${String(index + 1).padStart(3, "0")}`,
    kind: "passage",
    sectionTitle,
    text,
    embeddingText: passageEmbeddingContext(sectionTitle, text)
  }));
}

function passageEmbeddingContext(sectionTitle: string, text: string): string {
  return `Section: ${sectionTitle}. Content: ${text}`;
}

function parseSecondLevelSections(
  markdown: string
): Array<{ title: string; text: string }> {
  const lines = markdown.split(/\r?\n/);
  const sections: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } | undefined;

  for (const line of lines) {
    const title = /^##\s+(.+)$/.exec(line)?.[1]?.trim();
    if (title) {
      current = { title, lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    current.lines.push(line);
  }

  return sections.map((section) => ({
    title: section.title,
    text: normalizeMarkdownForEmbedding(section.lines.join("\n"))
  }));
}

function normalizeMarkdownForEmbedding(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, "$1")
    .replace(/[#>*_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeThreadId(rawThreadId: string): string {
  const match = /^marc:\/\/\$([^#\s`]+)/.exec(rawThreadId);
  if (!match) return rawThreadId;
  return match[1]!;
}
