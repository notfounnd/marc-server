import type { MemoryVectorRow } from "./types.js";

const MAXIMUM_EDIT_DISTANCE = 1;
const MIN_CORRECTABLE_TOKEN_LENGTH = 4;
const TOKEN_PATTERN = /[\p{L}\p{N}_]+/gu;
const PROTECTED_PATTERN =
  /(?:https?:\/\/|marc:\/\/|[a-zA-Z]:[\\/]|\.{0,2}[\\/])\S+/gu;

type QueryToken = {
  end: number;
  normalized: string;
  start: number;
  value: string;
};

type TokenReplacement = {
  originalInCorpus: boolean;
  replacement: string;
  token: QueryToken;
};

export type MemoryQueryCandidateSet = {
  suggestionOnlyIndexes: number[];
  variants: string[];
};

export function buildMemoryQueryCandidates(
  originalQuery: string,
  rows: MemoryVectorRow[]
): MemoryQueryCandidateSet {
  const vocabulary = memoryVocabulary(rows);
  const protectedRanges = rangesForProtectedSyntax(originalQuery);
  const replacements = queryTokens(originalQuery)
    .filter((token) => isCorrectableToken(token, protectedRanges))
    .map((token) => replacementsForToken(token, vocabulary))
    .filter((items) => items.length > 0);
  const combined = replacements.map((items) => items[0]).filter(isDefined);
  if (!combined.length) return candidateSet([[originalQuery, false]]);
  const variants = new Map<string, boolean>([[originalQuery, false]]);
  addVariant(variants, originalQuery, combined);
  return candidateSet([...variants.entries()]);
}

export function buildMemoryQueryVariants(
  originalQuery: string,
  rows: MemoryVectorRow[]
): string[] {
  return buildMemoryQueryCandidates(originalQuery, rows).variants;
}

function addVariant(
  variants: Map<string, boolean>,
  originalQuery: string,
  replacements: TokenReplacement[]
): void {
  const query = applyReplacements(originalQuery, replacements);
  const suggestionOnly = replacements.some((item) => item.originalInCorpus);
  variants.set(query, (variants.get(query) ?? false) || suggestionOnly);
}

function candidateSet(
  entries: Array<[string, boolean]>
): MemoryQueryCandidateSet {
  return {
    suggestionOnlyIndexes: entries.flatMap(([, suggestionOnly], index) =>
      suggestionOnly ? [index] : []
    ),
    variants: entries.map(([variant]) => variant)
  };
}

function memoryVocabulary(rows: MemoryVectorRow[]): Map<string, number> {
  const vocabulary = new Map<string, number>();
  const seenRecords = new Set<string>();
  for (const row of rows) {
    if (seenRecords.has(row.recordId)) continue;
    seenRecords.add(row.recordId);
    const content = [row.title, row.sectionTitle, row.text]
      .filter(isDefined)
      .join(" ");
    for (const token of queryTokens(content)) {
      if (token.normalized.length < MIN_CORRECTABLE_TOKEN_LENGTH) continue;
      vocabulary.set(
        token.normalized,
        (vocabulary.get(token.normalized) ?? 0) + 1
      );
    }
  }
  return vocabulary;
}

function queryTokens(value: string): QueryToken[] {
  return [...value.matchAll(TOKEN_PATTERN)].map((match) => {
    const start = match.index;
    const token = match[0];
    return {
      end: start + token.length,
      normalized: normalizeToken(token),
      start,
      value: token
    };
  });
}

function isCorrectableToken(
  token: QueryToken,
  protectedRanges: Array<{ end: number; start: number }>
): boolean {
  if (token.normalized.length < MIN_CORRECTABLE_TOKEN_LENGTH) return false;
  if (/\d|_/.test(token.value)) return false;
  if (protectedRanges.some((range) => overlaps(token, range))) return false;
  return true;
}

function replacementsForToken(
  token: QueryToken,
  vocabulary: Map<string, number>
): TokenReplacement[] {
  const originalFrequency = vocabulary.get(token.normalized) ?? 0;
  return [...vocabulary.entries()]
    .filter(([candidate]) =>
      couldMatch(token.normalized, candidate, MAXIMUM_EDIT_DISTANCE)
    )
    .map(([candidate, frequency]) => ({
      candidate,
      distance: damerauLevenshtein(token.normalized, candidate),
      frequency
    }))
    .filter((candidate) => candidate.distance <= MAXIMUM_EDIT_DISTANCE)
    .filter(
      ({ candidate, frequency }) =>
        accentFold(candidate) !== accentFold(token.normalized) &&
        (originalFrequency === 0 || frequency > originalFrequency)
    )
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        right.frequency - left.frequency ||
        left.candidate.localeCompare(right.candidate)
    )
    .slice(0, 1)
    .map(({ candidate }) => ({
      originalInCorpus: vocabulary.has(token.normalized),
      replacement: preserveTokenCase(token.value, candidate),
      token
    }));
}

function couldMatch(
  token: string,
  candidate: string,
  maximumDistance: number
): boolean {
  if (token === candidate) return false;
  return Math.abs(token.length - candidate.length) <= maximumDistance;
}

function applyReplacements(
  originalQuery: string,
  replacements: TokenReplacement[]
): string {
  const ordered = [...replacements].sort(
    (left, right) => right.token.start - left.token.start
  );
  return ordered.reduce(
    (query, item) =>
      `${query.slice(0, item.token.start)}${item.replacement}${query.slice(item.token.end)}`,
    originalQuery
  );
}

function rangesForProtectedSyntax(
  query: string
): Array<{ end: number; start: number }> {
  return [...query.matchAll(PROTECTED_PATTERN)].map((match) => ({
    end: match.index + match[0].length,
    start: match.index
  }));
}

function overlaps(
  token: QueryToken,
  range: { end: number; start: number }
): boolean {
  return token.start < range.end && token.end > range.start;
}

function preserveTokenCase(source: string, replacement: string): string {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase())
    return `${replacement[0]?.toUpperCase() ?? ""}${replacement.slice(1)}`;
  return replacement;
}

function normalizeToken(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

function accentFold(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

function damerauLevenshtein(left: string, right: string): number {
  const leftChars = [...left];
  const rightChars = [...right];
  const matrix = Array.from({ length: leftChars.length + 1 }, () =>
    Array<number>(rightChars.length + 1).fill(0)
  );
  for (let row = 0; row <= leftChars.length; row += 1) matrix[row]![0] = row;
  for (let column = 0; column <= rightChars.length; column += 1)
    matrix[0]![column] = column;

  for (let row = 1; row <= leftChars.length; row += 1) {
    for (let column = 1; column <= rightChars.length; column += 1) {
      const substitutionCost =
        leftChars[row - 1] === rightChars[column - 1] ? 0 : 1;
      matrix[row]![column] = Math.min(
        matrix[row - 1]![column]! + 1,
        matrix[row]![column - 1]! + 1,
        matrix[row - 1]![column - 1]! + substitutionCost
      );
      const transposes =
        row > 1 &&
        column > 1 &&
        leftChars[row - 1] === rightChars[column - 2] &&
        leftChars[row - 2] === rightChars[column - 1];
      if (!transposes) continue;
      matrix[row]![column] = Math.min(
        matrix[row]![column]!,
        matrix[row - 2]![column - 2]! + substitutionCost
      );
    }
  }
  return matrix[leftChars.length]![rightChars.length]!;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
