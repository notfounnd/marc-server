import { containsQuote, type EvidenceQuote } from "./dataset.js";
import type { EvidenceMatch, EvidencePassage } from "./matrix-plan.js";

/**
 * Locates each evidence quote of a case among the indexed passages of its source. A quote held
 * whole by one passage is `indexed` and its passage ids are recorded. A quote that the source
 * holds but no passage holds whole is `evidence_unindexable`: the case stays incomplete until the
 * approvers choose a shorter quote. A quote the source lacks is `missing`.
 */
export function evidenceMatchesOf(input: {
  evidence: readonly EvidenceQuote[];
  passages: readonly EvidencePassage[];
  sourceTexts: ReadonlyMap<string, string>;
}): EvidenceMatch[] {
  return input.evidence.map((item) => {
    const passageIds = input.passages
      .filter((passage) => passage.sourcePath === item.sourcePath && containsQuote(passage.text, item.quote))
      .map((passage) => passage.passageId);
    const sourceText = input.sourceTexts.get(item.sourcePath);
    return {
      sourcePath: item.sourcePath,
      quote: item.quote,
      passageIds,
      status: statusOf(passageIds, sourceText, item.quote)
    };
  });
}

function statusOf(
  passageIds: readonly string[],
  sourceText: string | undefined,
  quote: string
): EvidenceMatch["status"] {
  if (passageIds.length > 0) return "indexed";
  if (sourceText !== undefined && containsQuote(sourceText, quote)) return "evidence_unindexable";
  return "missing";
}

/** Whether every quote of a case is indexed; a case with any other status stays incomplete. */
export function allEvidenceIndexed(matches: readonly EvidenceMatch[]): boolean {
  return matches.every((match) => match.status === "indexed");
}
