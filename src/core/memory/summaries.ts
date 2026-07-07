import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { slugify } from "../ids.js";
import { safeJoin } from "../paths.js";
import type { WorkspaceInfo } from "../types.js";
import type { MemoryChunk, ThreadSummarySource } from "./types.js";

const SUMMARY_FILE = "SUMMARY.md";

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

  const stat = await fs.stat(summaryPath);
  const threadId = parseThreadId(markdown) ?? directoryName;
  const title = parseSummaryTitle(markdown);
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
    sha256: createHash("sha256").update(markdown).digest("hex"),
    mtimeMs: stat.mtimeMs,
    chunks: buildSummaryChunks(threadId, markdown)
  };
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

function buildSummaryChunks(threadId: string, markdown: string): MemoryChunk[] {
  const chunks: MemoryChunk[] = [
    {
      recordId: `${threadId}:summary`,
      kind: "summary",
      text: normalizeMarkdownForEmbedding(markdown)
    }
  ];
  const sections = parseSecondLevelSections(markdown);

  for (const section of sections) {
    if (!section.text) continue;
    chunks.push({
      recordId: `${threadId}:section:${slugify(section.title)}`,
      kind: "section",
      sectionTitle: section.title,
      text: section.text
    });
  }

  return chunks;
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
