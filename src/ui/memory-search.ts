import type {
  MemoryIndexHealth,
  MemoryQueryInterpretation,
  MemoryRecallHit,
  MemoryRecallResult,
  Thread
} from "./types.js";
import {
  isMemorySearchRetryDepth,
  MEMORY_SEARCH_UI_LIMIT,
  type MemorySearchRetryDepth
} from "./memory-search-depth.js";

export const MEMORY_SEARCH_STORAGE_KEY = "marcMemorySearchState";

const MEMORY_SEARCH_SCHEMA_VERSION = 5;
const MAX_STORED_NEXT_ACTIONS = 5;
const MAX_STORED_TEXT_LENGTH = 360;

export type MemorySearchStorage = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

type MemorySearchApiPost = <T>(path: string, body: unknown) => Promise<T>;

export type MemorySearchSnapshot = {
  configuredDepth: MemorySearchRetryDepth;
  lastExecutedDepth: MemorySearchRetryDepth;
  workspaceId: string;
  query: string;
  result: MemoryRecallResult;
};

type StoredMemorySearchState = MemorySearchSnapshot & {
  savedAt: string;
  schemaVersion: number;
};

type MemorySearchDepthRun = {
  lastExecutedDepth: MemorySearchRetryDepth;
  result: MemoryRecallResult;
};

export function isCurrentMemorySearchRequest(
  requestId: number,
  currentRequestId: number,
  requestWorkspaceId: string,
  currentWorkspaceId: string | undefined
): boolean {
  return (
    requestId === currentRequestId && requestWorkspaceId === currentWorkspaceId
  );
}

export function isMemorySearchAvailable(
  health: Pick<MemoryIndexHealth, "searchReady"> | undefined
): boolean {
  if (!health) return false;
  return health.searchReady;
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

export function memorySearchRecallInput(
  originalQuery: string,
  depth: MemorySearchRetryDepth,
  interpretation?: MemoryQueryInterpretation,
  initialMode: "auto" | "literal" = "auto"
): {
  depth: MemorySearchRetryDepth;
  limit: number;
  query: string;
  queryMode: "auto" | "literal";
} {
  if (!interpretation) {
    return {
      depth,
      limit: MEMORY_SEARCH_UI_LIMIT,
      query: originalQuery,
      queryMode: initialMode
    };
  }
  return {
    depth,
    limit: MEMORY_SEARCH_UI_LIMIT,
    query: interpretation.effectiveQuery,
    queryMode: "literal"
  };
}

export async function recallMemorySearchDepths({
  apiPost,
  depths,
  initialMode = "auto",
  interpretation,
  query,
  workspaceId
}: {
  apiPost: MemorySearchApiPost;
  depths: MemorySearchRetryDepth[];
  initialMode?: "auto" | "literal";
  interpretation?: MemoryQueryInterpretation;
  query: string;
  workspaceId: string;
}): Promise<MemorySearchDepthRun> {
  let latestResult: MemoryRecallResult | undefined;
  let lastExecutedDepth: MemorySearchRetryDepth | undefined;
  let stableInterpretation = interpretation;
  for (const depth of depths) {
    const recalled = await apiPost<MemoryRecallResult>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/memory/recall`,
      memorySearchRecallInput(query, depth, stableInterpretation, initialMode)
    );
    lastExecutedDepth = depth;
    if (!stableInterpretation) stableInterpretation = recalled.interpretation;
    latestResult = {
      ...recalled,
      interpretation: stableInterpretation,
      query
    };
    if (latestResult.results.length) {
      return { lastExecutedDepth, result: latestResult };
    }
  }
  if (!latestResult || lastExecutedDepth === undefined) {
    throw new Error("Memory search requires at least one depth.");
  }
  return { lastExecutedDepth, result: latestResult };
}

export function alternateMemorySearchQuery(
  interpretation: MemoryQueryInterpretation
): string | undefined {
  const alternate = interpretation.correctionApplied
    ? interpretation.originalQuery
    : interpretation.suggestedQuery;
  if (!alternate) return undefined;
  if (alternate === interpretation.effectiveQuery) return undefined;
  return alternate;
}

export function readStoredMemorySearchState(
  storage: MemorySearchStorage,
  workspaceId: string | undefined
): MemorySearchSnapshot | undefined {
  if (!workspaceId) return undefined;
  const raw = storage.getItem(MEMORY_SEARCH_STORAGE_KEY);
  const parsed = parseStoredMemorySearchState(raw);
  const legacy = parsed ? undefined : parseJson(raw ?? "");
  if (
    !parsed &&
    isRecord(legacy) &&
    typeof legacy.schemaVersion === "number" &&
    legacy.schemaVersion < MEMORY_SEARCH_SCHEMA_VERSION
  ) {
    storage.removeItem(MEMORY_SEARCH_STORAGE_KEY);
  }
  if (!parsed) return undefined;
  if (parsed.workspaceId !== workspaceId) return undefined;
  return {
    configuredDepth: parsed.configuredDepth,
    lastExecutedDepth: parsed.lastExecutedDepth,
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
  if (!isMemorySearchRetryDepth(parsed.configuredDepth)) return undefined;
  if (!isMemorySearchRetryDepth(parsed.lastExecutedDepth)) return undefined;
  if (!isMemoryRecallResult(parsed.result)) return undefined;
  return {
    configuredDepth: parsed.configuredDepth,
    lastExecutedDepth: parsed.lastExecutedDepth,
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
    nextActions: result.nextActions.slice(0, MAX_STORED_NEXT_ACTIONS),
    results: result.results.slice(0, MEMORY_SEARCH_UI_LIMIT).map(compactHit)
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
  if (!isMemoryQueryInterpretation(value.interpretation)) return false;
  if (!isRecord(value.indexStatus)) return false;
  if (!Array.isArray(value.results)) return false;
  if (!Array.isArray(value.nextActions)) return false;
  return value.results.every(isMemoryRecallHit);
}

function isMemoryQueryInterpretation(
  value: unknown
): value is MemoryQueryInterpretation {
  if (!isRecord(value)) return false;
  if (typeof value.originalQuery !== "string") return false;
  if (typeof value.effectiveQuery !== "string") return false;
  if (typeof value.correctionApplied !== "boolean") return false;
  if (value.mode !== "auto" && value.mode !== "literal") return false;
  if (
    value.suggestedQuery !== undefined &&
    typeof value.suggestedQuery !== "string"
  )
    return false;
  return true;
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
