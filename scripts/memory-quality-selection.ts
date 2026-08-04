type SelectableQualityCase = {
  family: string;
  query: string;
};

export function selectMemoryQualityCases<T extends SelectableQualityCase>(
  qualityCases: readonly T[],
  family: string | undefined,
  query: string | undefined
): T[] {
  const selected = qualityCases
    .filter((qualityCase) => family === undefined || qualityCase.family === family)
    .filter((qualityCase) => query === undefined || qualityCase.query === query);
  if (selected.length > 0) return selected;

  const filters: string[] = [];
  if (family !== undefined) filters.push(`--family "${family}"`);
  if (query !== undefined) filters.push(`--query "${query}"`);
  const selection = filters.join(" and ") || "the default selection";
  throw new Error(`No memory quality cases matched ${selection}.`);
}
