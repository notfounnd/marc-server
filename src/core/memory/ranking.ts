import type { MemorySearchHit, MemoryVectorRecord } from "./types.js";

const DEFAULT_CANDIDATE_LIMIT = 30;
const MAX_CANDIDATE_LIMIT = 100;
const CANDIDATE_MIN_SCORE = 0.05;
const VECTOR_WEIGHT = 0.7;
const LEXICAL_WEIGHT = 0.25;
const SECTION_WEIGHT = 0.05;
const MINIMUM_TOKEN_LENGTH = 3;

const SECTION_BOOSTS: Record<string, number> = {
  architecture: 0.8,
  arquitetura: 0.8,
  context: 0.25,
  contexto: 0.25,
  decisao: 1,
  decisoes: 1,
  decision: 1,
  decisions: 1,
  result: 0.35,
  resultado: 0.35,
  risk: 0.75,
  risks: 0.75,
  risco: 0.75,
  riscos: 0.75,
  security: 0.75,
  seguranca: 0.75,
  summary: 0.15,
  validacao: 0.65,
  validation: 0.65
};

export type RankedMemoryHit = {
  record: MemoryVectorRecord;
  vectorScore: number;
  lexicalScore: number;
  sectionBoost: number;
  exactTerms: string[];
  score: number;
  reason: string;
};

export function memoryRecallCandidateOptions(
  limit: number,
  minScore: number
): { limit: number; minScore: number } {
  return {
    limit: Math.min(
      Math.max(limit * 6, DEFAULT_CANDIDATE_LIMIT),
      MAX_CANDIDATE_LIMIT
    ),
    minScore: Math.min(minScore, CANDIDATE_MIN_SCORE)
  };
}

export function rankMemoryHits(
  query: string,
  hits: MemorySearchHit[]
): RankedMemoryHit[] {
  const queryTerms = queryTermsFor(query);
  return hits
    .map((hit) => rankMemoryHit(hit, queryTerms))
    .sort(compareRankedMemoryHits);
}

function rankMemoryHit(
  hit: MemorySearchHit,
  queryTerms: string[]
): RankedMemoryHit {
  const exactTerms = exactTermsFor(hit.record, queryTerms);
  const lexicalScore = lexicalScoreFor(exactTerms, queryTerms);
  const sectionBoost = sectionBoostFor(hit.record);
  const score = clampScore(
    hit.score * VECTOR_WEIGHT +
      lexicalScore * LEXICAL_WEIGHT +
      sectionBoost * SECTION_WEIGHT
  );
  return {
    record: hit.record,
    vectorScore: hit.score,
    lexicalScore,
    sectionBoost,
    exactTerms,
    score,
    reason: reasonForHit(hit.record, exactTerms, sectionBoost)
  };
}

function compareRankedMemoryHits(
  left: RankedMemoryHit,
  right: RankedMemoryHit
): number {
  const scoreDifference = right.score - left.score;
  if (scoreDifference !== 0) return scoreDifference;
  const lexicalDifference = right.lexicalScore - left.lexicalScore;
  if (lexicalDifference !== 0) return lexicalDifference;
  const vectorDifference = right.vectorScore - left.vectorScore;
  if (vectorDifference !== 0) return vectorDifference;
  return left.record.threadId.localeCompare(right.record.threadId);
}

function queryTermsFor(query: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const term of normalizeText(query).split(/[^a-z0-9]+/)) {
    if (term.length < MINIMUM_TOKEN_LENGTH) continue;
    if (seen.has(term)) continue;
    seen.add(term);
    terms.push(term);
  }
  return terms;
}

function exactTermsFor(
  record: MemoryVectorRecord,
  queryTerms: string[]
): string[] {
  const haystack = normalizeText(
    [record.title, record.sectionTitle ?? "", record.text].join(" ")
  );
  return queryTerms.filter((term) => haystack.includes(term));
}

function lexicalScoreFor(exactTerms: string[], queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;
  return exactTerms.length / queryTerms.length;
}

function sectionBoostFor(record: MemoryVectorRecord): number {
  const section = normalizeText(record.sectionTitle ?? "summary");
  const directBoost = SECTION_BOOSTS[section];
  if (directBoost !== undefined) return directBoost;
  const matchingBoost = Object.entries(SECTION_BOOSTS).find(([sectionName]) =>
    section.includes(sectionName)
  );
  return matchingBoost?.[1] ?? 0;
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function clampScore(score: number): number {
  return Number(Math.max(0, Math.min(1, score)).toFixed(6));
}

function reasonForHit(
  record: MemoryVectorRecord,
  exactTerms: string[],
  sectionBoost: number
): string {
  const label = record.sectionTitle ?? "summary";
  const details = rankingDetailsForHit(exactTerms, sectionBoost, label);
  const suffix = details.length > 0 ? ` ${details.join(" ")}` : "";
  return `Matched ${label} in ${record.title}.${suffix}`;
}

function rankingDetailsForHit(
  exactTerms: string[],
  sectionBoost: number,
  label: string
): string[] {
  return [
    exactTermsReason(exactTerms),
    sectionBoostReason(sectionBoost, label)
  ].filter((detail): detail is string => detail !== undefined);
}

function exactTermsReason(exactTerms: string[]): string | undefined {
  if (exactTerms.length === 0) return undefined;
  return `Exact terms: ${exactTerms.join(", ")}.`;
}

function sectionBoostReason(
  sectionBoost: number,
  label: string
): string | undefined {
  if (sectionBoost === 0) return undefined;
  return `Section boost: ${label}.`;
}
