import { MemoryDeepError } from "./deep-errors.js";
import type { MemoryDeepInput } from "./deep-types.js";
import type { MemorySourceType } from "./sources/contract.js";

export const DEFAULT_DEEP_LIMIT = 5;
export const MAX_DEEP_LIMIT = 20;

const SOURCE_TYPES: readonly MemorySourceType[] = [
  "summary",
  "artifact",
  "rules",
  "document",
  "chat"
];

/** Source types that a thread scope can hold. Rules and documents belong to their own groups. */
const THREAD_SOURCE_TYPES: readonly MemorySourceType[] = [
  "summary",
  "artifact",
  "chat"
];

export type NormalizedDeepInput = {
  limit: number;
  sourceTypes?: MemorySourceType[];
};

/** Validates the limit and the source types. The core checks them again, because the CLI skips zod. */
export function normalizeDeepInput(
  input: MemoryDeepInput
): NormalizedDeepInput {
  const limit = input.limit ?? DEFAULT_DEEP_LIMIT;
  if (!isDeepLimit(limit)) {
    throw new MemoryDeepError(
      "invalid_limit",
      `memory_deep limit must be an integer from 1 to ${MAX_DEEP_LIMIT}.`
    );
  }
  const sourceTypes = input.sourceTypes;
  if (sourceTypes === undefined) return { limit };
  if (!isValidSourceTypeList(sourceTypes)) {
    throw new MemoryDeepError(
      "invalid_source_types",
      "memory_deep sourceTypes must be a non-empty list of summary, artifact, chat, rules or document."
    );
  }
  if (input.threadId !== undefined && !sourceTypes.every(isThreadSourceType)) {
    throw new MemoryDeepError(
      "invalid_source_types",
      "With threadId, memory_deep sourceTypes must be summary, artifact or chat."
    );
  }
  return { limit, sourceTypes: [...sourceTypes] };
}

function isDeepLimit(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_DEEP_LIMIT;
}

function isValidSourceTypeList(sourceTypes: readonly string[]): boolean {
  if (sourceTypes.length === 0) return false;
  return sourceTypes.every(isSourceType);
}

function isSourceType(value: string): value is MemorySourceType {
  return SOURCE_TYPES.some((sourceType) => sourceType === value);
}

function isThreadSourceType(value: MemorySourceType): boolean {
  return THREAD_SOURCE_TYPES.includes(value);
}
