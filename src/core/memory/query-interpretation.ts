import type {
  MemoryQueryInterpretation,
  MemoryQueryMode,
  QueryInterpretationProvider
} from "./types.js";
export {
  buildMemoryQueryCandidates,
  buildMemoryQueryVariants
} from "./query-candidates.js";
export type { MemoryQueryCandidateSet } from "./query-candidates.js";

export async function interpretMemoryQuery({
  mode,
  originalQuery,
  provider,
  suggestionOnlyIndexes = [],
  variants
}: {
  mode: MemoryQueryMode;
  originalQuery: string;
  provider: QueryInterpretationProvider;
  suggestionOnlyIndexes?: number[];
  variants: string[];
}): Promise<MemoryQueryInterpretation> {
  if (mode === "literal") return originalInterpretation(originalQuery, mode);
  if (variants.length < 2) return originalInterpretation(originalQuery, mode);
  if (variants.length !== 2) return originalInterpretation(originalQuery, mode);

  try {
    const firstOutput = await provider.selectVariant({
      feedback: semanticAuditFeedback(),
      originalQuery,
      variants
    });
    const firstIndex = selectedVariantIndex(firstOutput, variants.length);
    if (firstIndex !== undefined)
      return selectedInterpretation(
        originalQuery,
        mode,
        variants,
        firstIndex,
        suggestionOnlyIndexes
      );

    const secondOutput = await provider.selectVariant({
      feedback: `${semanticAuditFeedback()} ${validIndexFeedback(variants.length)}`,
      originalQuery,
      variants
    });
    const secondIndex = selectedVariantIndex(secondOutput, variants.length);
    if (secondIndex !== undefined)
      return selectedInterpretation(
        originalQuery,
        mode,
        variants,
        secondIndex,
        suggestionOnlyIndexes
      );
    return originalInterpretation(originalQuery, mode);
  } catch {
    return originalInterpretation(originalQuery, mode);
  }
}

export function literalMemoryQueryInterpretation(
  originalQuery: string,
  mode: MemoryQueryMode = "literal"
): MemoryQueryInterpretation {
  return originalInterpretation(originalQuery, mode);
}

function selectedVariantIndex(
  output: string,
  variantCount: number
): number | undefined {
  const trimmed = output.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const index = Number(trimmed);
  if (!Number.isSafeInteger(index)) return undefined;
  if (index < 0 || index >= variantCount) return undefined;
  return index;
}

function selectedInterpretation(
  originalQuery: string,
  mode: MemoryQueryMode,
  variants: string[],
  index: number,
  suggestionOnlyIndexes: number[]
): MemoryQueryInterpretation {
  const effectiveQuery = variants[index] ?? originalQuery;
  if (index === 0) return originalInterpretation(originalQuery, mode);
  if (suggestionOnlyIndexes.includes(index)) {
    return {
      correctionApplied: false,
      effectiveQuery: originalQuery,
      mode,
      originalQuery,
      suggestedQuery: effectiveQuery
    };
  }
  return {
    correctionApplied: true,
    effectiveQuery,
    mode,
    originalQuery,
    suggestedQuery: effectiveQuery
  };
}

function originalInterpretation(
  originalQuery: string,
  mode: MemoryQueryMode
): MemoryQueryInterpretation {
  return {
    correctionApplied: false,
    effectiveQuery: originalQuery,
    mode,
    originalQuery
  };
}

function validIndexFeedback(variantCount: number): string {
  return `Return one integer index from 0 to ${variantCount - 1}. Return no other text.`;
}

function semanticAuditFeedback(): string {
  return "Audit candidate 1 against candidate 0. Return 1 only when every changed token fixes a clear accidental character-level typo and the query meaning is unchanged. Return 0 for synonyms, inflections, accent-only changes, grammar changes, translations, or uncertain corrections. Return only 0 or 1.";
}
