import fs from "node:fs/promises";
import {
  LFM_INTERPRETER_MODEL_ID,
  workerModelCachePath
} from "./model-config.js";
import type {
  MemoryInferenceRequest,
  MemoryInferenceResult
} from "./inference-protocol.js";

type TextGenerationPipeline = {
  (
    input: unknown,
    options: { do_sample: false; max_new_tokens: number }
  ): Promise<unknown>;
};

let interpreter: TextGenerationPipeline | undefined;

export async function handleQueryInterpretationRequest(
  request: MemoryInferenceRequest
): Promise<MemoryInferenceResult> {
  if (request.action === "prepare") {
    await prepareQueryInterpreter();
    return { prepared: true };
  }
  if (request.action === "interpret") {
    return {
      text: await selectQueryVariant(
        request.originalQuery,
        request.variants,
        request.feedback
      )
    };
  }
  throw new Error(
    "Interpretation worker does not support retrieval or reranking requests."
  );
}

export async function prepareQueryInterpreter(): Promise<void> {
  await loadInterpreter(true);
}

export async function selectQueryVariant(
  originalQuery: string,
  variants: string[],
  feedback?: string
): Promise<string> {
  const pipeline = await loadInterpreter(false);
  const output = await pipeline(
    queryInterpretationMessages(originalQuery, variants, feedback),
    { do_sample: false, max_new_tokens: 4 }
  );
  return generatedText(output);
}

async function loadInterpreter(
  allowRemoteModels: boolean
): Promise<TextGenerationPipeline> {
  if (interpreter) return interpreter;
  const transformers = await import("@huggingface/transformers");
  transformers.env.allowRemoteModels = allowRemoteModels;
  transformers.env.cacheDir = interpretationModelCachePath();
  await fs.mkdir(transformers.env.cacheDir, { recursive: true });
  interpreter = (await transformers.pipeline(
    "text-generation",
    LFM_INTERPRETER_MODEL_ID,
    {
      dtype: "q4",
      model_file_name: "model"
    }
  )) as unknown as TextGenerationPipeline;
  return interpreter;
}

export function queryInterpretationMessages(
  originalQuery: string,
  variants: string[],
  feedback?: string
): Array<{ content: string; role: "system" | "user" }> {
  const correction = feedback ? `\nCorrection: ${feedback}` : "";
  const candidates = variants
    .map((variant, index) => `${index}: ${JSON.stringify(variant)}`)
    .join("\n");
  return [
    {
      role: "system",
      content:
        "Candidate 0 is the default and safest choice. Select another candidate only when it fixes a clear accidental character-level typo in the original query. Do not select synonyms, inflections, accent-only changes, grammar changes, or stylistic rewrites. If uncertain, select 0. Return only one allowed integer index and no other text."
    },
    {
      role: "user",
      content: `Original query: ${JSON.stringify(originalQuery)}\nCandidates:\n${candidates}${correction}`
    }
  ];
}

function generatedText(output: unknown): string {
  if (!Array.isArray(output))
    throw new Error("Interpretation worker returned invalid generated text.");
  const first = output[0];
  if (!isRecord(first))
    throw new Error("Interpretation worker returned invalid generated text.");
  const generated = first.generated_text;
  if (typeof generated === "string") return generated;
  if (!Array.isArray(generated))
    throw new Error("Interpretation worker returned invalid generated text.");
  const last = generated.at(-1);
  if (!isRecord(last))
    throw new Error("Interpretation worker returned invalid generated text.");
  if (typeof last.content === "string") return last.content;
  throw new Error("Interpretation worker returned invalid generated text.");
}

function interpretationModelCachePath(): string {
  const marcPath = process.env.MARC_WORKSPACE_PATH;
  if (!marcPath)
    throw new Error("Memory inference worker requires workspace path.");
  return workerModelCachePath(marcPath, "interpretation", process.cwd());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
