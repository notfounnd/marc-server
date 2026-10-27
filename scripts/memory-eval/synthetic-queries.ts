import { createHash } from "node:crypto";

/** Queries generated per generation. */
export const SYNTHETIC_QUERY_COUNT = 60;

/** Shortest and longest sentence kept, in whitespace-separated words. */
export const SYNTHETIC_MIN_WORDS = 6;
export const SYNTHETIC_MAX_WORDS = 20;

/**
 * Exact rule of the generator. Every capture stores this text, so the rebuild
 * (T3) and any replay can reproduce the queries from the same passages.
 */
export const SYNTHETIC_QUERY_RULE = [
  "Seed: the first four bytes of sha256(generation), read as an unsigned",
  "big-endian integer, seed a mulberry32 generator.",
  "Pool: the passage records, sorted by recordId; a passage without a sentence",
  "of 6 to 20 words is left out.",
  "Sentences: the passage text is split at line breaks and after each [.!?]",
  "followed by whitespace; words are separated by whitespace; a sentence with",
  "fewer than 6 words is dropped, and a longer one keeps its first 20 words.",
  "Sampling: a Fisher-Yates shuffle of the pool with the generator; the first 60",
  "passages of the shuffle are used, each once (without replacement); when the pool",
  "has fewer than 60 passages, all of them are used.",
  "Query: one remaining sentence of the passage, picked with index",
  "floor(u * n), where u is the next generator value and n the number of",
  "sentences of the passage. The positive is the passage's threadId (Inverse Cloze)."
].join(" ");

/** A passage record of the rebuilt index, as the generator reads it. */
export type SyntheticPassage = {
  recordId: string;
  threadId: string;
  text: string;
};

export type SyntheticQuery = {
  id: string;
  text: string;
  sourceThreadId: string;
  sourceRecordId: string;
};

/** Seed of the generator: the first four bytes of sha256(generation), unsigned. */
export function syntheticSeed(generation: string): number {
  return createHash("sha256").update(generation).digest().readUInt32BE(0);
}

/** The mulberry32 generator: returns values in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The sentences of a passage that the generator may pick: split at line breaks
 * and after [.!?] followed by whitespace, with at least SYNTHETIC_MIN_WORDS
 * words, cut to the first SYNTHETIC_MAX_WORDS words.
 */
export function eligibleSentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((sentence) =>
      sentence
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0)
    )
    .filter((words) => words.length >= SYNTHETIC_MIN_WORDS)
    .map((words) => words.slice(0, SYNTHETIC_MAX_WORDS).join(" "));
}

/**
 * The synthetic queries of one generation, following SYNTHETIC_QUERY_RULE. The
 * output is deterministic for the same passages and generation. When fewer than
 * `count` passages have an eligible sentence, all of them are used: the caller
 * records the requested count next to the produced one, so a shortfall is explicit.
 */
export function syntheticQueries(
  passages: readonly SyntheticPassage[],
  generation: string,
  count: number = SYNTHETIC_QUERY_COUNT
): SyntheticQuery[] {
  const random = mulberry32(syntheticSeed(generation));
  const pool = [...passages]
    .sort((left, right) => compareText(left.recordId, right.recordId))
    .map((passage) => ({
      ...passage,
      sentences: eligibleSentences(passage.text)
    }))
    .filter((passage) => passage.sentences.length > 0);
  const sampled = shuffle(pool, random).slice(0, count);
  return sampled.map((passage, index) => {
    const sentenceIndex = Math.floor(random() * passage.sentences.length);
    return {
      id: `synthetic-${String(index + 1).padStart(2, "0")}`,
      text: passage.sentences[sentenceIndex],
      sourceThreadId: passage.threadId,
      sourceRecordId: passage.recordId
    };
  });
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
