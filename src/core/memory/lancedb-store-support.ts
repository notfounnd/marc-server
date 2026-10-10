import fs from "node:fs/promises";
import { safeJoin } from "../paths.js";
import type { WorkspaceInfo } from "../types.js";
import { memoryRootPath } from "./storage-paths.js";
import type {
  MemoryLexicalField,
  MemoryVectorRecord,
  MemoryVectorRow
} from "./types.js";

export const LEGACY_TABLE_NAME = "summary_embeddings";
const GENERATION_TABLE_PREFIX = "summary_embeddings_";
export const LEXICAL_COLUMNS: Record<MemoryLexicalField, string> = {
  title: "lexicalTitle",
  summary: "lexicalSummary",
  titlePrefix: "lexicalTitlePrefix"
};
export const REQUIRED_LEXICAL_INDEXES = Object.values(LEXICAL_COLUMNS).map(
  (column) => `${column}_idx`
);

type LanceDbModule = typeof import("@lancedb/lancedb");
type LanceDbConnection = Awaited<ReturnType<LanceDbModule["connect"]>>;
type LanceDbTable = Awaited<ReturnType<LanceDbConnection["openTable"]>>;

type LanceDbStoredRow = Omit<
  MemoryVectorRecord,
  "closedAt" | "sectionTitle"
> & {
  closedAt: string | null;
  lexicalSummary: string;
  lexicalTitle: string;
  lexicalTitlePrefix: string;
  sectionTitle: string | null;
  vector: number[];
};

export type LanceDbSearchRow = LanceDbStoredRow & {
  _distance?: number;
  _score?: number;
};

export function tableName(generation?: string): string {
  if (!generation) return LEGACY_TABLE_NAME;
  return `${GENERATION_TABLE_PREFIX}${generation}`;
}

export async function connectLanceDb(
  info: WorkspaceInfo
): Promise<LanceDbConnection> {
  const lancedb = await lanceDbModule();
  await fs.mkdir(memoryRootPath(info), { recursive: true });
  return lancedb.connect(memoryRootPath(info));
}

export function lanceDbModule(): Promise<typeof import("@lancedb/lancedb")> {
  return import("@lancedb/lancedb");
}

export async function createLexicalIndexes(table: LanceDbTable): Promise<void> {
  const lancedb = await lanceDbModule();
  const common = {
    asciiFolding: true,
    baseTokenizer: "simple" as const,
    lowercase: true,
    removeStopWords: false,
    stem: false,
    withPosition: false
  };
  await table.createIndex(LEXICAL_COLUMNS.title, {
    config: lancedb.Index.fts(common)
  });
  await table.createIndex(LEXICAL_COLUMNS.summary, {
    config: lancedb.Index.fts(common)
  });
  await table.createIndex(LEXICAL_COLUMNS.titlePrefix, {
    config: lancedb.Index.fts(common)
  });
}

export function lanceDbRow(
  record: MemoryVectorRecord,
  vector: number[]
): LanceDbStoredRow {
  const lexical = record.kind === "identity";
  return {
    ...record,
    closedAt: record.closedAt ?? null,
    lexicalSummary: record.text,
    lexicalTitle: lexical ? record.title : "",
    lexicalTitlePrefix: lexical ? titlePrefixes(record.title) : "",
    sectionTitle: record.sectionTitle ?? null,
    vector
  };
}

export async function lanceDbArrowTable(
  rows: LanceDbStoredRow[]
): Promise<import("apache-arrow").Table> {
  const [arrow, lancedb] = await Promise.all([
    import("apache-arrow"),
    lanceDbModule()
  ]);
  const vector = rows.find((row) => row.vector.length > 0)?.vector;
  if (!vector) throw new Error("Memory generation requires non-empty vectors.");
  const textFields = [
    "recordId",
    "threadId",
    "title",
    "closedAt",
    "summaryPath",
    "relativeSummaryPath",
    "reference",
    "kind",
    "sectionTitle",
    "text",
    "embeddingText",
    "lexicalSummary",
    "lexicalTitle",
    "lexicalTitlePrefix"
  ];
  const schema = new arrow.Schema([
    ...textFields.map((name) => new arrow.Field(name, new arrow.Utf8(), true)),
    new arrow.Field(
      "vector",
      new arrow.FixedSizeList(
        vector.length,
        new arrow.Field("item", new arrow.Float32(), true)
      ),
      true
    )
  ]);
  return lancedb.makeArrowTable(rows, { schema });
}

export function memoryVectorRowFromStored(row: unknown): MemoryVectorRow {
  const stored = row as LanceDbStoredRow;
  return {
    ...memoryVectorRecordFromStored(stored),
    vector: Array.from(stored.vector ?? [])
  };
}

export function memoryVectorRecordFromStored(row: unknown): MemoryVectorRecord {
  const stored = row as LanceDbStoredRow;
  return {
    recordId: stored.recordId,
    threadId: stored.threadId,
    title: stored.title,
    closedAt: stored.closedAt ?? undefined,
    summaryPath: stored.summaryPath,
    relativeSummaryPath: stored.relativeSummaryPath,
    reference: stored.reference,
    kind: stored.kind,
    sectionTitle: stored.sectionTitle ?? undefined,
    text: stored.text,
    embeddingText: stored.embeddingText
  };
}

export async function optimizeActiveTable(
  db: LanceDbConnection,
  activeTable: string | undefined
): Promise<number> {
  if (!activeTable) return 0;
  const table = await db.openTable(activeTable).catch(() => undefined);
  if (!table) return 0;
  const result = await table.optimize({ cleanupOlderThan: new Date() });
  return oldVersionsRemoved(result);
}

export function isManagedTable(name: string): boolean {
  return name === LEGACY_TABLE_NAME || name.startsWith(GENERATION_TABLE_PREFIX);
}

export function generationFromTableName(name: string): string {
  if (name === LEGACY_TABLE_NAME) return "legacy";
  return name.slice(GENERATION_TABLE_PREFIX.length);
}

export async function directorySize(root: string): Promise<number> {
  const entries = await fs
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  let total = 0;
  for (const entry of entries) {
    const entryPath = safeJoin(root, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(entryPath);
      continue;
    }
    if (!entry.isFile()) continue;
    total += (await fs.stat(entryPath)).size;
  }
  return total;
}

export function recordIdPredicate(recordIds: string[]): string {
  return `recordId IN (${recordIds.map(sqlString).join(", ")})`;
}

export function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function recordIdFromRow(row: unknown): string[] {
  if (!isRecord(row)) return [];
  if (typeof row.recordId !== "string") return [];
  return [row.recordId];
}

export function distanceToScore(distance?: number): number {
  if (typeof distance !== "number") return 0;
  return Math.max(0, 1 - distance);
}

function titlePrefixes(title: string): string {
  const tokens = title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu);
  if (!tokens) return "";
  const prefixes = tokens.flatMap((token) => tokenPrefixes(token));
  return [...new Set(prefixes)].join(" ");
}

function tokenPrefixes(token: string): string[] {
  if (token.length < 3) return [];
  return Array.from({ length: token.length - 2 }, (_unused, index) =>
    token.slice(0, index + 3)
  );
}

function oldVersionsRemoved(result: unknown): number {
  if (!isRecord(result)) return 0;
  const direct = result.oldVersionsRemoved;
  if (typeof direct === "number") return direct;
  const cleanup = result.cleanup;
  if (!isRecord(cleanup)) return 0;
  return typeof cleanup.oldVersionsRemoved === "number"
    ? cleanup.oldVersionsRemoved
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
