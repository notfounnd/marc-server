import type {
  MemoryBand,
  MemoryIndexHealth,
  MemoryQueryInterpretation,
  MemoryRecallHit,
  MemoryRecallResult,
  Thread
} from "./types.js";

export const MEMORY_SEARCH_STORAGE_KEY = "marcMemorySearchState";
/** The number of hits the panel keeps and the snapshot stores. */
export const MEMORY_SEARCH_UI_LIMIT = 50;

const MEMORY_SEARCH_SCHEMA_VERSION = 7;
const MEMORY_BANDS: readonly MemoryBand[] = ["high", "medium", "low"];
const MAX_STORED_NEXT_ACTIONS = 5;
const MAX_STORED_TEXT_LENGTH = 360;

export type MemorySearchStorage = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

type MemorySearchApiPost = <T>(path: string, body: unknown) => Promise<T>;

export type MemorySearchSnapshot = {
  workspaceId: string;
  query: string;
  result: MemoryRecallResult;
};

type StoredMemorySearchState = MemorySearchSnapshot & {
  savedAt: string;
  schemaVersion: number;
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

/** A hit without a thread id (rules and document groups) has no thread to find. */
export function findMemorySearchThread(
  hit: MemoryRecallHit,
  threads: Thread[]
): Thread | undefined {
  if (!hit.threadId) return undefined;
  return threads.find((thread) => thread.id === hit.threadId);
}

/** Only a hit with a thread id can be selected as the open thread. */
export function isMemorySearchHitSelected(
  hit: MemoryRecallHit,
  selectedThreadId: string | undefined
): boolean {
  if (!hit.threadId) return false;
  return hit.threadId === selectedThreadId;
}

export function isMemorySearchClosedHit(
  hit: Pick<MemoryRecallHit, "closedAt" | "summaryPath">
): boolean {
  return Boolean(hit.closedAt || hit.summaryPath);
}

/**
 * Splits the results for the panel: high and medium bands stay in the main list, and
 * low band hits go to the collapsed block. Order inside each list is kept.
 */
export function splitMemorySearchBands(results: readonly MemoryRecallHit[]): {
  primary: MemoryRecallHit[];
  lessLikely: MemoryRecallHit[];
} {
  return {
    primary: results.filter((hit) => hit.band !== "low"),
    lessLikely: results.filter((hit) => hit.band === "low")
  };
}

export function memorySearchTooltip(
  hit: Pick<MemoryRecallHit, "matchedText">,
  title: string
): string {
  const matchedText = hit.matchedText.trim();
  if (matchedText) return matchedText;
  return title;
}

/** The recall request of the UI: one search at the default depth (0), the same as the M0 path. */
export function memorySearchRecallInput(
  originalQuery: string,
  interpretation?: MemoryQueryInterpretation,
  initialMode: "auto" | "literal" = "auto"
): {
  limit: number;
  query: string;
  queryMode: "auto" | "literal";
} {
  if (!interpretation) {
    return {
      limit: MEMORY_SEARCH_UI_LIMIT,
      query: originalQuery,
      queryMode: initialMode
    };
  }
  return {
    limit: MEMORY_SEARCH_UI_LIMIT,
    query: interpretation.effectiveQuery,
    queryMode: "literal"
  };
}

export async function recallMemorySearch({
  apiPost,
  initialMode = "auto",
  interpretation,
  query,
  workspaceId
}: {
  apiPost: MemorySearchApiPost;
  initialMode?: "auto" | "literal";
  interpretation?: MemoryQueryInterpretation;
  query: string;
  workspaceId: string;
}): Promise<MemoryRecallResult> {
  const recalled = await apiPost<MemoryRecallResult>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/memory/recall`,
    memorySearchRecallInput(query, interpretation, initialMode)
  );
  return {
    ...recalled,
    interpretation: interpretation ?? recalled.interpretation,
    query
  };
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
  if (typeof value.abstained !== "boolean") return false;
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

/**
 * A hit of a thread group carries its thread id and summary path; a rules or document hit
 * carries neither, only its reference (the path shown to the user).
 */
function isMemoryRecallHit(value: unknown): value is MemoryRecallHit {
  if (!isRecord(value)) return false;
  if (value.threadId !== undefined && typeof value.threadId !== "string")
    return false;
  if (typeof value.title !== "string") return false;
  if (value.summaryPath !== undefined && typeof value.summaryPath !== "string")
    return false;
  if (typeof value.reference !== "string") return false;
  if (typeof value.matchedText !== "string") return false;
  if (typeof value.score !== "number") return false;
  if (typeof value.reason !== "string") return false;
  if (!isMemoryBand(value.band)) return false;
  return true;
}

function isMemoryBand(value: unknown): value is MemoryBand {
  return MEMORY_BANDS.some((band) => band === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
