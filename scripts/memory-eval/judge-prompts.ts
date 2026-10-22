/**
 * Fixed prompts and token layouts of the judges and of the typed choice (E2, A3).
 * Nothing here is fitted to the evaluation data.
 */

/** Instruction of the Qwen judge: the question that the thread record must answer. */
export const JUDGE_INSTRUCTION =
  "Given a question about a software project's past work, judge whether this thread record answers it";

/** System prompt of the Qwen3-Reranker card. */
export const QWEN_SYSTEM_PROMPT =
  'Judge whether the Document meets the requirements based on the Query and the Instruct provided. Note that the answer can only be "yes" or "no".';

/** The Qwen3-Reranker template of its card, with the assistant turn opened after the empty think block. */
export function qwenJudgePrompt(query: string, document: string): string {
  return (
    `<|im_start|>system\n${QWEN_SYSTEM_PROMPT}<|im_end|>\n` +
    `<|im_start|>user\n<Instruct>: ${JUDGE_INSTRUCTION}\n\n<Query>: ${query}\n\n<Document>: ${document}<|im_end|>\n` +
    `<|im_start|>assistant\n<think>\n\n</think>\n`
  );
}

/** Kev state of the judge: the effective query and the judged document. */
export function kevJudgeState(query: string, document: string): string {
  return `Query: ${query}\n\n${document}`;
}

/** Question of the Kev judge: a yes/no question, with the options in this order. */
export const KEV_JUDGE_QUESTION = "Does this thread record answer the query?";
export const KEV_NOUL_OPTIONS: readonly string[] = ["no", "yes"];

/** The option that keeps the query as typed, in the typed choice (H8). */
export const KEEP_OPTION = "keep the query as typed";
export const KEV_CHOICE_QUESTION = "Which search query did the user mean?";

/** Kev state of the typed choice: the original query. */
export function kevChoiceState(originalQuery: string): string {
  return `Search query: ${originalQuery}`;
}

/**
 * Delimiter ids of the Kev graph, taken from config.json (`kev.delimiter_ids`). The
 * card's example passes the delimiter texts through its own sanitization before
 * encoding them, which produces wrong ids, so the ids are not derived from the tokenizer.
 */
export const KEV_DELIMITER_IDS = {
  state: 151659,
  question: 151660,
  optionStart: 151648,
  optionEnd: 151649,
  decide: 151661
} as const;

/** Caller text can never produce a delimiter: <|name|> becomes <¦name¦>, as in the card. */
export function sanitizeCallerText(text: string): string {
  return text.replace(/<\|([A-Za-z0-9_]+)\|>/g, "<¦$1¦>");
}

export type KevQuestion = { instruction: string; options: string[] };

export type KevLayout = {
  /** Token ids of the whole sequence: the state first, then one branch per question. */
  tokens: number[];
  /** For each question, the position of the </opt> token of each option. */
  optionEnds: number[][];
};

/**
 * The Kev sequence of one state and its questions, as the card builds it: the
 * state, then for each question [question, instruction, (option_start, option,
 * option_end)*, decide]. Each option's logit is read at its option_end position.
 * `encode` returns the token ids of plain text, without special tokens.
 */
export function kevLayout(input: {
  encode: (text: string) => number[];
  state: string;
  questions: KevQuestion[];
}): KevLayout {
  const enc = (text: string) => input.encode(sanitizeCallerText(text));
  const tokens: number[] = [KEV_DELIMITER_IDS.state, ...enc(input.state)];
  const optionEnds = input.questions.map((question) => {
    const instruction = enc(question.instruction);
    const spans = question.options.map((option) => [
      KEV_DELIMITER_IDS.optionStart,
      ...enc(option),
      KEV_DELIMITER_IDS.optionEnd
    ]);
    const branch = [
      KEV_DELIMITER_IDS.question,
      ...instruction,
      ...spans.flat(),
      KEV_DELIMITER_IDS.decide
    ];
    const base = tokens.length;
    let cursor = 1 + instruction.length;
    const ends = spans.map((span) => {
      cursor += span.length;
      return base + cursor - 1;
    });
    tokens.push(...branch);
    return ends;
  });
  return { tokens, optionEnds };
}

/** The two options of the typed choice, without the original query: the correction, then keep. */
export function typedChoiceOptions(correction: string): string[] {
  return [correction, KEEP_OPTION];
}
