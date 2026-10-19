import { slugify } from "../../ids.js";
import type { MemoryChunk } from "./contract.js";
import type { MarkdownSection } from "./sections.js";

export type ChunkOrigin = Partial<
  Pick<MemoryChunk, "messageId" | "agentId" | "artifactFileName">
>;

const ORIGIN_KEYS = ["messageId", "agentId", "artifactFileName"] as const;

// One section chunk per section. Record ids are `${recordPrefix}:${slug}`, and
// repeated titles inside one source get -2, -3, and so on.
export function sectionChunks(
  recordPrefix: string,
  sections: MarkdownSection[],
  origin: ChunkOrigin = {}
): MemoryChunk[] {
  const usedSlugs = new Set<string>();
  return sections.map(
    (section): MemoryChunk => ({
      recordId: `${recordPrefix}:${uniqueSlug(slugify(section.title), usedSlugs)}`,
      kind: "section",
      sectionTitle: section.title,
      text: section.text,
      embeddingText: passageEmbeddingContext(section.title, section.text),
      lineStart: section.lineStart,
      lineEnd: section.lineEnd,
      passageOrdinal: 0,
      ...origin
    })
  );
}

// Copies only the origin fields that are set, so absent fields stay absent.
export function chunkOrigin(chunk: MemoryChunk): ChunkOrigin {
  return Object.fromEntries(
    ORIGIN_KEYS.filter((key) => chunk[key] !== undefined).map((key) => [
      key,
      chunk[key]
    ])
  );
}

export function passageEmbeddingContext(
  sectionTitle: string,
  text: string
): string {
  return `Section: ${sectionTitle}. Content: ${text}`;
}

function uniqueSlug(base: string, usedSlugs: Set<string>): string {
  let slug = base;
  for (let suffix = 2; usedSlugs.has(slug); suffix += 1) {
    slug = `${base}-${suffix}`;
  }
  usedSlugs.add(slug);
  return slug;
}
