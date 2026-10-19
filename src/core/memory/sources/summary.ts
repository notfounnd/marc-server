import type { WorkspaceInfo } from "../../types.js";
import { sectionChunks } from "./chunks.js";
import {
  MEMORY_SOURCE_AUTHORITIES,
  type MemoryChunk,
  type MemorySource
} from "./contract.js";
import { rootRelativePath, sha256Hex, sourceHash } from "./files.js";
import { markdownToIndexText } from "./markdown-text.js";
import {
  parseMarkdownSections,
  sectionsOrOverview,
  sourceLines
} from "./sections.js";
import { readClosedThreads, type ClosedThread } from "./threads.js";

const SUMMARY_LEVELS = [2];

export async function readSummarySources(
  info: WorkspaceInfo
): Promise<MemorySource[]> {
  const threads = await readClosedThreads(info);
  return threads.map((thread) => summarySource(info, thread));
}

function summarySource(
  info: WorkspaceInfo,
  thread: ClosedThread
): MemorySource {
  return {
    sourceType: "summary",
    threadId: thread.threadId,
    title: thread.title,
    closedAt: thread.closedAt,
    summaryPath: thread.summaryPath,
    relativeSummaryPath: thread.relativeSummaryPath,
    reference: thread.reference,
    markdown: thread.summaryMarkdown,
    sourcePath: rootRelativePath(info, thread.summaryPath),
    sourceSha256: sha256Hex(thread.summary.bytes),
    sha256: sourceHash(thread.summaryMarkdown, thread.title),
    mtimeMs: thread.summary.mtimeMs,
    authority: MEMORY_SOURCE_AUTHORITIES.summary,
    chunks: summaryChunks(thread.threadId, thread.title, thread.summaryMarkdown)
  };
}

function summaryChunks(
  threadId: string,
  title: string,
  markdown: string
): MemoryChunk[] {
  return [
    identityChunk(threadId, title, markdown),
    ...sectionChunks(
      `${threadId}:source`,
      sectionsOrOverview(markdown, SUMMARY_LEVELS)
    )
  ];
}

function identityChunk(
  threadId: string,
  title: string,
  markdown: string
): MemoryChunk {
  const synthesis = executiveSynthesis(markdown);
  return {
    recordId: `${threadId}:identity`,
    kind: "identity",
    text: synthesis.text,
    embeddingText: `Thread: ${title}. Summary: ${synthesis.text}`,
    lineStart: synthesis.lineStart,
    lineEnd: synthesis.lineEnd,
    passageOrdinal: 0
  };
}

// The first section with text; otherwise the whole file.
function executiveSynthesis(markdown: string): {
  text: string;
  lineStart: number;
  lineEnd: number;
} {
  const first = parseMarkdownSections(markdown, SUMMARY_LEVELS).find(
    (section) => section.text
  );
  if (first)
    return {
      text: `${first.title}. ${first.text}`,
      lineStart: first.lineStart,
      lineEnd: first.lineEnd
    };
  return {
    text: markdownToIndexText(markdown),
    lineStart: 1,
    lineEnd: sourceLines(markdown).length
  };
}
