import type { RerankingProvider } from "../types.js";
import { chunkOrigin, passageEmbeddingContext } from "./chunks.js";
import type { MemoryChunk, MemorySource } from "./contract.js";

const MAX_PASSAGE_TOKENS = 320;
const PASSAGE_OVERLAP_TOKENS = 48;

// Every source reader passes through this step, so passages are split the same
// way for summaries, artifacts, chat messages, rules, and documents.
export async function materializeSources(
  sources: MemorySource[],
  reranker: RerankingProvider
): Promise<MemorySource[]> {
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

function passageChunks(chunk: MemoryChunk, passages: string[]): MemoryChunk[] {
  const sectionTitle = chunk.sectionTitle ?? "Overview";
  return passages.map(
    (text, index): MemoryChunk => ({
      recordId: `${chunk.recordId}:passage:${String(index + 1).padStart(3, "0")}`,
      kind: "passage",
      sectionTitle,
      text,
      embeddingText: passageEmbeddingContext(sectionTitle, text),
      lineStart: chunk.lineStart,
      lineEnd: chunk.lineEnd,
      passageOrdinal: index,
      ...chunkOrigin(chunk)
    })
  );
}
