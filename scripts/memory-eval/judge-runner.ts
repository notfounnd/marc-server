import fs from "node:fs/promises";
import { queryInterpretationMessages } from "../../src/core/memory/query-interpretation-inference.js";
import type { TokenTruncator } from "./judge-document.js";
import {
  KEV_CHOICE_QUESTION,
  KEV_JUDGE_QUESTION,
  KEV_NOUL_OPTIONS,
  kevChoiceState,
  kevJudgeState,
  kevLayout,
  type KevQuestion,
  qwenJudgePrompt,
  typedChoiceOptions
} from "./judge-prompts.js";

/**
 * Model runners of the judges (H7) and of the typed choice (H8). Only the `judge`
 * and `choice` commands import this file. Replay and fit never do. Downloads are
 * made here, with the revision pinned by full SHA, and nowhere else.
 */

/** The quantisations used by the judges and the production LFM. */
export type ModelDtype = "q8" | "q4";

export type ModelIdentity = {
  id: string;
  file: string;
  dtype: ModelDtype;
  /** Full commit SHA of the Hugging Face repository; null for the read-only production folder. */
  revision: string | null;
};

export const QWEN_IDENTITY: ModelIdentity = {
  id: "onnx-community/Qwen3-Reranker-0.6B-ONNX",
  file: "onnx/model_quantized.onnx",
  dtype: "q8",
  revision: "9995c50e2310679108a55f5ccd16ba8be9f17c20"
};

export const KEV_IDENTITY: ModelIdentity = {
  id: "onnx-community/kev-0.6b-ONNX",
  file: "onnx/model_q4.onnx",
  dtype: "q4",
  revision: "5a827091b3d58fe4fdfc02a5a5b2ce364047d678"
};

/** The production LFM interpreter, read from its folder only: no download and no write. */
export const LFM_IDENTITY: ModelIdentity = {
  id: "onnx-community/LFM2.5-350M-ONNX",
  file: "onnx/model_q4.onnx",
  dtype: "q4",
  revision: null
};

/** The judge models' download cache. */
export const JUDGE_CACHE_DIR = ".marc/cache/memory-eval/models";
/**
 * The production LFM folder, read only. The query interpretation worker uses this
 * folder itself as its transformers.js cache directory, so the model sits below it
 * at onnx-community/LFM2.5-350M-ONNX, and the same folder is used here.
 */
export const PRODUCTION_LFM_CACHE_DIR =
  ".marc/cache/memory-models/onnx-community--LFM2.5-350M-ONNX";

type Encoded = { input_ids: { data: ArrayLike<bigint | number> } };

/** The part of the transformers.js tokenizer that the runners use. */
export type Tokenizer = {
  (text: string, options?: Record<string, unknown>): Encoded;
  decode(ids: number[], options?: Record<string, unknown>): string;
  convert_tokens_to_ids(token: string): number;
  encode(text: string, options?: Record<string, unknown>): number[];
  apply_chat_template(
    messages: Array<{ role: string; content: string }>,
    options: Record<string, unknown>
  ): string;
};

async function transformersWith(cacheDir: string, allowRemoteModels: boolean) {
  const transformers = await import("@huggingface/transformers");
  transformers.env.cacheDir = cacheDir;
  transformers.env.allowRemoteModels = allowRemoteModels;
  return transformers;
}

export type Transformers = Awaited<ReturnType<typeof transformersWith>>;

function idsOf(tokenizer: Tokenizer, text: string): number[] {
  return Array.from(tokenizer(text, { add_special_tokens: false }).input_ids.data, Number);
}

/** Cuts a text to the judge's token budget, decoding the kept tokens back to text. */
export function tokenTruncatorOf(tokenizer: Tokenizer): TokenTruncator {
  return (text, maxTokens) => {
    const ids = idsOf(tokenizer, text);
    if (ids.length <= maxTokens) return text;
    return tokenizer.decode(ids.slice(0, maxTokens), { skip_special_tokens: true });
  };
}

/** Two-way softmax of logits: [softmax_0, softmax_1]. */
export function softmaxPair(first: number, second: number): [number, number] {
  const top = Math.max(first, second);
  const a = Math.exp(first - top);
  const b = Math.exp(second - top);
  return [a / (a + b), b / (a + b)];
}

/** Logits of one model output: a [1, positions, vocabulary] tensor, read as data. */
type Logits = { dims: number[]; data: ArrayLike<number> };

/** A causal model call: the feeds in, and an output with the logits among its values. */
export type LogitsModel = (
  feeds: Record<string, unknown>
) => Promise<{ logits: Logits } & Record<string, unknown>>;

/** A transformers.js tensor, or any output that releases its buffers on dispose. */
type Releasable = { dispose: () => unknown };

function isReleasable(value: unknown): value is Releasable {
  return (
    typeof value === "object" &&
    value !== null &&
    "dispose" in value &&
    typeof value.dispose === "function"
  );
}

/**
 * Releases the buffers of inputs and outputs. transformers.js holds the ONNX buffers
 * until dispose, so without it every document adds its own to the process.
 */
export async function releaseAll(values: readonly unknown[]): Promise<void> {
  await Promise.all(values.filter(isReleasable).map((value) => value.dispose()));
}

/**
 * The logits of the given token ids at the last position of one sequence, read from
 * the output. Only those values are copied out. The graph is asked for the last
 * position alone through `num_logits_to_keep`: transformers.js passes that input on
 * only when the graph declares it, and a graph without it returns every position, which
 * is read the same way. Every feed and every output is released before the function
 * returns, also when the call fails. `positions` is the count the graph returned.
 */
export async function lastPositionLogits(input: {
  model: LogitsModel;
  feeds: Record<string, unknown>;
  keepLast: unknown;
  ids: readonly number[];
}): Promise<{ values: number[]; positions: number }> {
  const consumed: unknown[] = [input.keepLast, ...Object.values(input.feeds)];
  try {
    const output = await input.model({
      ...input.feeds,
      num_logits_to_keep: input.keepLast
    });
    consumed.push(...Object.values(output));
    const { dims, data } = output.logits;
    const [, positions, vocabulary] = dims;
    const last = (positions - 1) * vocabulary;
    return {
      values: input.ids.map((id) => Number(data[last + id])),
      positions
    };
  } finally {
    await releaseAll(consumed);
  }
}

/** The num_logits_to_keep input that asks for the last position only. */
function keepLastOf(transformers: Transformers): unknown {
  return new transformers.Tensor("int64", BigInt64Array.of(1n), []);
}

/**
 * Reports, once per model, a graph that returned every position: then the memory of
 * the full logits is still used, though the scores are the same.
 */
function lastPositionReporter(modelId: string): (positions: number) => void {
  let reported = false;
  return (positions) => {
    if (reported || positions === 1) return;
    reported = true;
    console.warn(
      `${modelId} returned ${positions} positions per document; its graph does not keep only the last one.`
    );
  };
}

/** A judge: scores one document for one effective query, with P(yes). */
export type JudgeRunner = {
  identity: ModelIdentity;
  truncate: TokenTruncator;
  scoreDocument: (query: string, document: string) => Promise<number>;
};

/** A judge loader: the pinned model, downloaded into the cache when it is missing. */
type JudgeLoader = (cacheDir: string) => Promise<JudgeRunner>;

/** The loader of each judge. Dispatch is a table, so a new judge adds one entry. */
const JUDGE_LOADERS: Readonly<Record<"qwen" | "kev", JudgeLoader>> = {
  qwen: loadQwenRunner,
  kev: loadKevRunner
};

/** Loads a judge with its pinned revision. The cache is the judge cache, which may download. */
export async function loadJudgeRunner(
  name: "qwen" | "kev",
  cacheDir: string
): Promise<JudgeRunner> {
  return JUDGE_LOADERS[name](cacheDir);
}

async function loadQwenRunner(cacheDir: string): Promise<JudgeRunner> {
  await fs.mkdir(cacheDir, { recursive: true });
  const transformers = await transformersWith(cacheDir, true);
  const identity = QWEN_IDENTITY;
  const tokenizer = (await transformers.AutoTokenizer.from_pretrained(identity.id, {
    revision: identity.revision ?? undefined
  })) as unknown as Tokenizer;
  const model = (await transformers.AutoModelForCausalLM.from_pretrained(identity.id, {
    dtype: identity.dtype,
    revision: identity.revision ?? undefined
  })) as unknown as LogitsModel;
  const yesId = tokenizer.convert_tokens_to_ids("yes");
  const noId = tokenizer.convert_tokens_to_ids("no");
  const reportPositions = lastPositionReporter(identity.id);
  return {
    identity,
    truncate: tokenTruncatorOf(tokenizer),
    scoreDocument: async (query, document) => {
      const { values, positions } = await lastPositionLogits({
        model,
        feeds: tokenizer(qwenJudgePrompt(query, document), { truncation: false }),
        keepLast: keepLastOf(transformers),
        ids: [yesId, noId]
      });
      reportPositions(positions);
      const [yes] = softmaxPair(values[0], values[1]);
      return yes;
    }
  };
}

async function loadKevRunner(cacheDir: string): Promise<JudgeRunner> {
  const kev = await loadKevModel(cacheDir);
  return {
    identity: kev.identity,
    truncate: tokenTruncatorOf(kev.tokenizer),
    scoreDocument: async (query, document) => {
      const [answers] = await kev.ask(kevJudgeState(query, document), [
        { instruction: KEV_JUDGE_QUESTION, options: [...KEV_NOUL_OPTIONS] }
      ]);
      // Options are ["no", "yes"]: the second probability is P(yes).
      return answers[1];
    }
  };
}

/** The Kev model: one forward pass answers every question of a state, as the card does. */
export type KevModel = {
  identity: ModelIdentity;
  tokenizer: Tokenizer;
  transformers: Transformers;
  model: LogitsModel;
  /** Probabilities of each question's options, in order, from one forward pass. */
  ask: (state: string, questions: KevQuestion[]) => Promise<number[][]>;
};

/** Loads the Kev model with its pinned revision and dtype. The cache may download. */
export async function loadKevModel(cacheDir: string): Promise<KevModel> {
  await fs.mkdir(cacheDir, { recursive: true });
  const transformers = await transformersWith(cacheDir, true);
  const identity = KEV_IDENTITY;
  const tokenizer = (await transformers.AutoTokenizer.from_pretrained(identity.id, {
    revision: identity.revision ?? undefined
  })) as unknown as Tokenizer;
  const model = (await transformers.PreTrainedModel.from_pretrained(identity.id, {
    dtype: identity.dtype,
    revision: identity.revision ?? undefined
  })) as unknown as LogitsModel;
  return {
    identity,
    tokenizer,
    transformers,
    model,
    ask: async (state, questions) => {
      const layout = kevLayout({
        encode: (text) => idsOf(tokenizer, text),
        state,
        questions
      });
      return kevAnswers(transformers, model, layout.tokens, layout.optionEnds);
    }
  };
}

/**
 * The option probabilities of every question, from one forward pass over the whole
 * sequence. Each option's logit is read at its </opt> position, and each question is
 * softmaxed over its own options. The option ends are not the last position, so the
 * graph computes every position; the buffers are released after the read.
 */
export async function kevAnswers(
  transformers: Transformers,
  model: LogitsModel,
  tokens: number[],
  optionEnds: number[][]
): Promise<number[][]> {
  const input_ids = new transformers.Tensor("int64", BigInt64Array.from(tokens, BigInt), [1, tokens.length]);
  const attention_mask = new transformers.Tensor(
    "int64",
    new BigInt64Array(tokens.length).fill(1n),
    [1, tokens.length]
  );
  const consumed: unknown[] = [input_ids, attention_mask];
  try {
    const output = await model({ input_ids, attention_mask });
    consumed.push(...Object.values(output));
    return optionEnds.map((ends) =>
      softmaxAll(ends.map((position) => Number(output.logits.data[position])))
    );
  } finally {
    await releaseAll(consumed);
  }
}

function softmaxAll(values: number[]): number[] {
  const top = Math.max(...values);
  const exps = values.map((value) => Math.exp(value - top));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

/** A typed choice runner: the probability of the correction and of "keep the query as typed". */
export type ChoiceRunner = {
  identity: ModelIdentity;
  choose: (original: string, correction: string) => Promise<{ pCorrection: number; pKeep: number }>;
};

/** Kev as a typed choice: the same model as the judge, with the choice question. */
export async function loadKevChoiceRunner(cacheDir: string): Promise<ChoiceRunner> {
  const kev = await loadKevModel(cacheDir);
  return {
    identity: kev.identity,
    choose: async (original, correction) => {
      const [answers] = await kev.ask(kevChoiceState(original), [
        { instruction: KEV_CHOICE_QUESTION, options: typedChoiceOptions(correction) }
      ]);
      return { pCorrection: answers[0], pKeep: answers[1] };
    }
  };
}

/**
 * LFM as a typed choice: the production interpreter prompt with the two candidates,
 * [original, correction]. Candidate 0 is the query as typed (keep) and candidate 1 the
 * correction. One forward pass gives the logits of the next token. The two answer
 * tokens "0" and "1" are compared by a softmax over their two logits, which equals
 * the normalised probability of each token over the whole vocabulary.
 */
export async function loadLfmChoiceRunner(cacheDir: string): Promise<ChoiceRunner> {
  const transformers = await transformersWith(cacheDir, false);
  const pipe = (await transformers.pipeline("text-generation", LFM_IDENTITY.id, {
    dtype: LFM_IDENTITY.dtype,
    model_file_name: "model"
  })) as unknown as { model: LogitsModel; tokenizer: Tokenizer };
  const { model, tokenizer } = pipe;
  const keepId = tokenizer.encode("0", { add_special_tokens: false })[0];
  const correctId = tokenizer.encode("1", { add_special_tokens: false })[0];
  const reportPositions = lastPositionReporter(LFM_IDENTITY.id);
  return {
    identity: LFM_IDENTITY,
    choose: async (original, correction) => {
      const prompt = tokenizer.apply_chat_template(
        queryInterpretationMessages(original, [original, correction]),
        { tokenize: false, add_generation_prompt: true }
      );
      const { values, positions } = await lastPositionLogits({
        model,
        feeds: tokenizer(prompt, { add_special_tokens: false }),
        keepLast: keepLastOf(transformers),
        ids: [keepId, correctId]
      });
      reportPositions(positions);
      const [pKeep, pCorrection] = softmaxPair(values[0], values[1]);
      return { pCorrection, pKeep };
    }
  };
}
