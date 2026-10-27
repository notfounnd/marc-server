import fs from "node:fs/promises";
import path from "node:path";
import type { RegularFile } from "../src/core/memory/sources/files.js";
import type { RankedMemoryThread } from "../src/core/memory/semantic-ranking.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import type {
  MemoryRecordKind,
  MemoryVectorRecord
} from "../src/core/memory/types.js";
import { summaryProvenanceFixture } from "./memory-provenance-fixtures.js";

export function record(
  threadId: string,
  kind: MemoryRecordKind,
  overrides: Partial<MemoryVectorRecord> = {}
): MemoryVectorRecord {
  const text = `${threadId} ${kind}`;
  return {
    recordId: `${threadId}:${kind}`,
    threadId,
    title: `${threadId} title`,
    summaryPath: `/tmp/${threadId}/SUMMARY.md`,
    relativeSummaryPath: `threads/${threadId}/SUMMARY.md`,
    reference: `marc://$${threadId}`,
    kind,
    sectionTitle: "Result",
    text,
    embeddingText: text,
    ...summaryProvenanceFixture(threadId, text),
    ...overrides
  };
}

export function ranked(recordValue: MemoryVectorRecord): RankedMemoryThread {
  return {
    eligibility: 0.9,
    evidence: { denseRank: 1, record: recordValue, vectorScore: 0.9 },
    rankingScore: 1,
    relevance: 0.9,
    rerankerRank: 1,
    semanticEligibility: 0.9,
    score: 1,
    signals: {} as RankedMemoryThread["signals"]
  } as RankedMemoryThread;
}

export function summary(threadId: string, content: string): string {
  return [
    `# Summary - ${content}`,
    "",
    `Thread: \`${threadId}\``,
    "",
    content
  ].join("\n");
}

export function chatMessage(id: string, artifacts: string): string {
  return [
    "<!-- marc-message",
    `id: ${id}`,
    "threadId: t1",
    "timestamp: 2026-10-01T00:00:00.000Z",
    "agentId: agent",
    `artifacts: ${artifacts}`,
    "-->",
    "body",
    "<!-- /marc-message -->"
  ].join("\n");
}

export function chatText(messages: string[]): string {
  return ["# Chat", "", ...messages].join("\n\n");
}

export function chatFile(messages: string[]): RegularFile {
  return {
    path: "CHAT.md",
    bytes: Buffer.from(chatText(messages)),
    mtimeMs: 0
  } as RegularFile;
}

export async function writeArtifact(
  info: WorkspaceInfo,
  threadId: string,
  fileName: string,
  content: string
): Promise<void> {
  await writeFileAt(
    path.join(info.marcPath, "threads", threadId, "artifacts", fileName),
    content
  );
}

export async function writeFileAt(
  target: string,
  content: string
): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}
