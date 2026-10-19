import { createHash } from "node:crypto";
import type { MemoryVectorRecord } from "../src/core/memory/types.js";

export type SummaryProvenanceFields = Pick<
  MemoryVectorRecord,
  | "sourceType"
  | "layer"
  | "sourcePath"
  | "authority"
  | "lineStart"
  | "lineEnd"
  | "sourceSha256"
  | "passageOrdinal"
  | "passageSha256"
  | "passageId"
>;

export function sha256Text(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// Explicit provenance for a summary record whose indexed text is `text`.
// Line numbers are fixed fixture values; tests that check lines read real files.
export function summaryProvenanceFixture(
  threadId: string,
  text: string
): SummaryProvenanceFields {
  const sourcePath = `.marc/threads/${threadId}/SUMMARY.md`;
  const passageSha256 = sha256Text(text);
  return {
    sourceType: "summary",
    layer: 0,
    sourcePath,
    authority: "decision",
    lineStart: 1,
    lineEnd: 1,
    sourceSha256: sha256Text(`${threadId}/SUMMARY.md`),
    passageOrdinal: 0,
    passageSha256,
    passageId: `${sourcePath}#${passageSha256.slice(0, 16)}`
  };
}
