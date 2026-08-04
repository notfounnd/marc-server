import type { PassageTokenizer } from "./passage-segmentation.js";

type TransformersTokenizerOutput = {
  input_ids: { tolist(): unknown };
};

export type TransformersPassageTokenizer = {
  (
    input: string | string[],
    options: Record<string, unknown>
  ): TransformersTokenizerOutput;
  decode(
    tokenIds: number[],
    options: {
      clean_up_tokenization_spaces: boolean;
      skip_special_tokens: boolean;
    }
  ): string;
};

export function passageTokenizer(
  tokenizer: TransformersPassageTokenizer
): PassageTokenizer {
  return {
    decode: (tokenIds) =>
      tokenizer.decode(tokenIds, {
        clean_up_tokenization_spaces: true,
        skip_special_tokens: true
      }),
    tokenIds: (text) => tokenIdsForText(tokenizer, text)
  };
}

function tokenIdsForText(
  tokenizer: TransformersPassageTokenizer,
  text: string
): number[] {
  const encoded = tokenizer(text, {
    add_special_tokens: false,
    padding: false,
    truncation: false
  });
  const tokenValues = encoded.input_ids.tolist();
  if (!Array.isArray(tokenValues))
    throw new Error("Memory reranking tokenizer returned invalid token IDs.");
  const first = tokenValues[0];
  if (Array.isArray(first)) return numericTokenIds(first);
  return numericTokenIds(tokenValues);
}

function numericTokenIds(values: unknown[]): number[] {
  return values.map(numericTokenId);
}

function numericTokenId(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  throw new Error("Memory reranking tokenizer returned invalid token IDs.");
}
