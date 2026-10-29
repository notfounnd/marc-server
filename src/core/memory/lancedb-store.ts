import fs from "node:fs/promises";
import type { WorkspaceInfo } from "../types.js";
import {
  connectLanceDb,
  createLexicalIndexes,
  directorySize,
  distanceToScore,
  generationFromTableName,
  isManagedTable,
  lanceDbArrowTable,
  lanceDbModule,
  lanceDbRow,
  LEGACY_TABLE_NAME,
  LEXICAL_COLUMNS,
  layerPredicate,
  type LanceDbSearchRow,
  memoryVectorRecordFromStored,
  memoryVectorRowFromStored,
  optimizeActiveTable,
  recordIdFromRow,
  recordIdPredicate,
  REQUIRED_LEXICAL_INDEXES,
  searchPredicate,
  tableName,
  threadPredicate
} from "./lancedb-store-support.js";
import { MEMORY_MANIFEST_FILE, memoryRootPath } from "./storage-paths.js";
import {
  DEFAULT_SEARCH_LAYERS,
  type MemoryLayer,
  type MemoryLexicalField,
  type MemoryLexicalSearchHit,
  type MemorySearchHit,
  type MemoryStorePurgeResult,
  type MemoryVectorRecord,
  type MemoryVectorRow,
  type MemoryVectorStore
} from "./types.js";
import { cosineSimilarity } from "./vector-math.js";

export class LanceDbMemoryVectorStore implements MemoryVectorStore {
  async exists(info: WorkspaceInfo, generation?: string): Promise<boolean> {
    if (generation) {
      const db = await connectLanceDb(info);
      return db
        .openTable(tableName(generation))
        .then(() => true)
        .catch(() => false);
    }
    const root = memoryRootPath(info);
    const entries = await fs.readdir(root).catch(() => []);
    return entries.some((entry) => entry !== MEMORY_MANIFEST_FILE);
  }

  async listRecordIds(
    info: WorkspaceInfo,
    generation?: string
  ): Promise<string[]> {
    if (!(await this.exists(info, generation))) return [];
    const db = await connectLanceDb(info);
    const table = await db.openTable(tableName(generation));
    const rows = await table.query().toArray();
    return rows.flatMap(recordIdFromRow);
  }

  async readRows(
    info: WorkspaceInfo,
    generation?: string,
    options?: { layers?: readonly MemoryLayer[]; threadId?: string }
  ): Promise<MemoryVectorRow[]> {
    if (!(await this.exists(info, generation))) return [];
    const layers = options?.layers;
    if (layers && !layers.length) return [];
    const db = await connectLanceDb(info);
    const table = await db.openTable(tableName(generation));
    const predicates = [
      layers === undefined ? undefined : layerPredicate(layers),
      options?.threadId === undefined
        ? undefined
        : threadPredicate(options.threadId)
    ].filter((predicate): predicate is string => predicate !== undefined);
    const query =
      predicates.length === 0
        ? table.query()
        : table.query().where(predicates.join(" AND "));
    return (await query.toArray()).map(memoryVectorRowFromStored);
  }

  async rebuild(
    info: WorkspaceInfo,
    records: MemoryVectorRecord[],
    vectors: number[][],
    generation?: string
  ): Promise<void> {
    if (!records.length) return;
    const db = await connectLanceDb(info);
    const rows = records.map((record, index) =>
      lanceDbRow(record, vectors[index] ?? [])
    );
    const arrowTable = await lanceDbArrowTable(rows);
    const table = await db.createTable(tableName(generation), arrowTable, {
      mode: "overwrite"
    });
    await createLexicalIndexes(table);
  }

  async reconcile(
    info: WorkspaceInfo,
    rows: MemoryVectorRow[],
    removeRecordIds: string[]
  ): Promise<void> {
    const exists = await this.exists(info);
    if (!exists) return this.createInitialTable(info, rows);
    const db = await connectLanceDb(info);
    const table = await db.openTable(LEGACY_TABLE_NAME);
    if (rows.length)
      await table
        .mergeInsert("recordId")
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute(rows);
    if (!removeRecordIds.length) return;
    await table.delete(recordIdPredicate(removeRecordIds));
  }

  async validateGeneration(
    info: WorkspaceInfo,
    generation: string
  ): Promise<void> {
    const db = await connectLanceDb(info);
    const table = await db.openTable(tableName(generation));
    const indexes = await table.listIndices();
    const names = new Set(indexes.map((index) => index.name));
    const missing = REQUIRED_LEXICAL_INDEXES.filter((name) => !names.has(name));
    if (!missing.length) return;
    throw new Error(
      `Memory generation is missing indexes: ${missing.join(", ")}.`
    );
  }

  async searchVector(
    info: WorkspaceInfo,
    vector: number[],
    options: {
      generation?: string;
      kind?: "identity" | "passage";
      layers?: readonly MemoryLayer[];
      limit: number;
    }
  ): Promise<MemorySearchHit[]> {
    const layers = options.layers ?? DEFAULT_SEARCH_LAYERS;
    if (!layers.length) return [];
    const db = await connectLanceDb(info);
    const table = await db.openTable(tableName(options.generation));
    const query = table
      .vectorSearch(vector)
      .distanceType("cosine")
      .where(searchPredicate({ kind: options.kind, layers }));
    const rows = (await query.limit(options.limit).toArray()) as Array<
      MemoryVectorRecord & { _distance?: number }
    >;
    return (rows ?? []).map((row) => ({
      record: memoryVectorRecordFromStored(row),
      score: distanceToScore(row._distance)
    }));
  }

  async searchLexical(
    info: WorkspaceInfo,
    queryText: string,
    vector: number[],
    options: {
      field: MemoryLexicalField;
      generation?: string;
      layers?: readonly MemoryLayer[];
      limit: number;
    }
  ): Promise<MemoryLexicalSearchHit[]> {
    const layers = options.layers ?? DEFAULT_SEARCH_LAYERS;
    if (!layers.length) return [];
    const db = await connectLanceDb(info);
    const table = await db.openTable(tableName(options.generation));
    const lancedb = await lanceDbModule();
    const column = LEXICAL_COLUMNS[options.field];
    const query = new lancedb.MatchQuery(queryText, column, {
      operator: lancedb.Operator.Or
    });
    const rows = (await table
      .query()
      .where(layerPredicate(layers))
      .fullTextSearch(query)
      .limit(options.limit)
      .toArray()) as LanceDbSearchRow[];
    return rows.map((row) => ({
      field: options.field,
      record: memoryVectorRecordFromStored(row),
      score: typeof row._score === "number" ? row._score : 0,
      vectorScore: cosineSimilarity(vector, Array.from(row.vector ?? []))
    }));
  }

  async purgeUnused(
    info: WorkspaceInfo,
    activeGeneration?: string
  ): Promise<MemoryStorePurgeResult> {
    const root = memoryRootPath(info);
    const before = await directorySize(root);
    const db = await connectLanceDb(info);
    const activeTable = activeGeneration
      ? tableName(activeGeneration)
      : undefined;
    const tableNames = await db.tableNames();
    const generationsRemoved: string[] = [];
    for (const name of tableNames) {
      if (!isManagedTable(name)) continue;
      if (name === activeTable) continue;
      await db.dropTable(name);
      generationsRemoved.push(generationFromTableName(name));
    }
    const oldVersionsRemoved = await optimizeActiveTable(db, activeTable);
    const after = await directorySize(root);
    return {
      bytesRemoved: Math.max(0, before - after),
      generationsRemoved,
      oldVersionsRemoved
    };
  }

  private async createInitialTable(
    info: WorkspaceInfo,
    rows: MemoryVectorRow[]
  ): Promise<void> {
    if (!rows.length) return;
    const db = await connectLanceDb(info);
    const arrowTable = await lanceDbArrowTable(
      rows.map((row) => lanceDbRow(row, row.vector))
    );
    const table = await db.createTable(LEGACY_TABLE_NAME, arrowTable);
    await createLexicalIndexes(table);
  }
}
