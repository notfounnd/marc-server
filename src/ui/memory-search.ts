import type {
  MemoryIndexHealth,
  MemoryRecallHit,
  MemoryRecallResult,
  Thread
} from "./types.js";

export const MEMORY_SEARCH_STORAGE_KEY = "marcMemorySearchState";

const MEMORY_SEARCH_SCHEMA_VERSION = 1;
const MAX_STORED_RESULTS = 5;
const MAX_STORED_TEXT_LENGTH = 360;

export type MemorySearchStorage = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

export type MemorySearchSnapshot = {
  workspaceId: string;
  query: string;
  result: MemoryRecallResult;
};

type StoredMemorySearchState = MemorySearchSnapshot & {
  savedAt: string;
  schemaVersion: number;
};

export function isMemorySearchAvailable(
  health: Pick<MemoryIndexHealth, "status"> | undefined
): boolean {
  if (!health) return false;
  return health.status === "ready" || health.status === "stale";
}

export function findMemorySearchThread(
  hit: MemoryRecallHit,
  threads: Thread[]
): Thread | undefined {
  return threads.find((thread) => thread.id === hit.threadId);
}

export function isMemorySearchClosedHit(
  hit: Pick<MemoryRecallHit, "closedAt" | "summaryPath">
): boolean {
  return Boolean(hit.closedAt || hit.summaryPath);
}

export function memorySearchTooltip(
  hit: Pick<MemoryRecallHit, "matchedText">,
  title: string
): string {
  const matchedText = hit.matchedText.trim();
  if (matchedText) return matchedText;
  return title;
}

export function readStoredMemorySearchState(
  storage: MemorySearchStorage,
  workspaceId: string | undefined
): MemorySearchSnapshot | undefined {
  if (!workspaceId) return undefined;
  const parsed = parseStoredMemorySearchState(
    storage.getItem(MEMORY_SEARCH_STORAGE_KEY)
  );
  if (!parsed) return undefined;
  if (parsed.workspaceId !== workspaceId) return undefined;
  return {
    query: parsed.query,
    result: parsed.result,
    workspaceId: parsed.workspaceId
  };
}

export function writeStoredMemorySearchState(
  storage: MemorySearchStorage,
  snapshot: MemorySearchSnapshot
): void {
  storage.setItem(
    MEMORY_SEARCH_STORAGE_KEY,
    JSON.stringify({
      ...snapshot,
      result: compactMemoryRecallResult(snapshot.result),
      savedAt: new Date().toISOString(),
      schemaVersion: MEMORY_SEARCH_SCHEMA_VERSION
    })
  );
}

function parseStoredMemorySearchState(
  raw: string | null
): StoredMemorySearchState | undefined {
  if (!raw) return undefined;
  const parsed = parseJson(raw);
  if (!isRecord(parsed)) return undefined;
  if (parsed.schemaVersion !== MEMORY_SEARCH_SCHEMA_VERSION) return undefined;
  if (typeof parsed.workspaceId !== "string") return undefined;
  if (typeof parsed.query !== "string") return undefined;
  if (typeof parsed.savedAt !== "string") return undefined;
  if (!isMemoryRecallResult(parsed.result)) return undefined;
  return {
    query: parsed.query,
    result: compactMemoryRecallResult(parsed.result),
    savedAt: parsed.savedAt,
    schemaVersion: MEMORY_SEARCH_SCHEMA_VERSION,
    workspaceId: parsed.workspaceId
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function compactMemoryRecallResult(
  result: MemoryRecallResult
): MemoryRecallResult {
  return {
    ...result,
    nextActions: result.nextActions.slice(0, MAX_STORED_RESULTS),
    results: result.results.slice(0, MAX_STORED_RESULTS).map(compactHit)
  };
}

function compactHit(hit: MemoryRecallHit): MemoryRecallHit {
  return {
    ...hit,
    matchedText: truncateText(hit.matchedText),
    reason: truncateText(hit.reason)
  };
}

function truncateText(text: string): string {
  if (text.length <= MAX_STORED_TEXT_LENGTH) return text;
  return text.slice(0, MAX_STORED_TEXT_LENGTH);
}

function isMemoryRecallResult(value: unknown): value is MemoryRecallResult {
  if (!isRecord(value)) return false;
  if (typeof value.query !== "string") return false;
  if (!isRecord(value.indexStatus)) return false;
  if (!Array.isArray(value.results)) return false;
  if (!Array.isArray(value.nextActions)) return false;
  return value.results.every(isMemoryRecallHit);
}

function isMemoryRecallHit(value: unknown): value is MemoryRecallHit {
  if (!isRecord(value)) return false;
  if (typeof value.threadId !== "string") return false;
  if (typeof value.title !== "string") return false;
  if (typeof value.summaryPath !== "string") return false;
  if (typeof value.reference !== "string") return false;
  if (typeof value.matchedText !== "string") return false;
  if (typeof value.score !== "number") return false;
  if (typeof value.reason !== "string") return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
