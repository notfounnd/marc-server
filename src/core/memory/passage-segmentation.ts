export type PassageSegmentationOptions = {
  maxTokens: number;
  overlapTokens: number;
};

export type PassageTokenizer = {
  decode(tokenIds: number[]): string;
  tokenIds(text: string): number[];
};

export function normalizePassageOptions(
  maxTokens: number,
  overlapTokens: number
): PassageSegmentationOptions {
  if (!Number.isInteger(maxTokens) || maxTokens < 1)
    throw new Error("Memory passage maximum must be a positive integer.");
  if (!Number.isInteger(overlapTokens) || overlapTokens < 0)
    throw new Error("Memory passage overlap must be a non-negative integer.");
  return {
    maxTokens,
    overlapTokens: Math.min(overlapTokens, maxTokens - 1)
  };
}

export function splitTextIntoPassages(
  tokenizer: PassageTokenizer,
  text: string,
  options: PassageSegmentationOptions
): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (!sentences.length) return [];
  return sentencePassages(tokenizer, sentences, options);
}

function sentencePassages(
  tokenizer: PassageTokenizer,
  sentences: string[],
  options: PassageSegmentationOptions
): string[] {
  const passages: string[] = [];
  let start = 0;

  while (start < sentences.length) {
    const end = sentenceEnd(tokenizer, sentences, start, options.maxTokens);
    if (end === start) {
      passages.push(...tokenWindows(tokenizer, sentences[start]!, options));
      start += 1;
      continue;
    }
    passages.push(sentences.slice(start, end).join(" "));
    if (end === sentences.length) break;
    start = nextSentenceStart(
      tokenizer,
      sentences,
      start,
      end,
      options.overlapTokens
    );
  }

  return passages;
}

function sentenceEnd(
  tokenizer: PassageTokenizer,
  sentences: string[],
  start: number,
  maxTokens: number
): number {
  let tokens = 0;
  let index = start;
  while (index < sentences.length) {
    const sentenceTokens = tokenizer.tokenIds(sentences[index]!);
    if (tokens + sentenceTokens.length > maxTokens) return index;
    tokens += sentenceTokens.length;
    index += 1;
  }
  return index;
}

function nextSentenceStart(
  tokenizer: PassageTokenizer,
  sentences: string[],
  start: number,
  end: number,
  overlapTokens: number
): number {
  let tokens = 0;
  let index = end - 1;
  while (index >= start) {
    tokens += tokenizer.tokenIds(sentences[index]!).length;
    if (tokens > overlapTokens) return Math.max(start + 1, index + 1);
    index -= 1;
  }
  return start + 1;
}

function tokenWindows(
  tokenizer: PassageTokenizer,
  text: string,
  options: PassageSegmentationOptions
): string[] {
  const tokenIds = tokenizer.tokenIds(text);
  const windows: string[] = [];
  let start = 0;
  while (start < tokenIds.length) {
    const end = Math.min(start + options.maxTokens, tokenIds.length);
    const window = tokenizer.decode(tokenIds.slice(start, end));
    if (window.trim()) windows.push(window.trim());
    if (end === tokenIds.length) break;
    start = Math.max(start + 1, end - options.overlapTokens);
  }
  return windows;
}
