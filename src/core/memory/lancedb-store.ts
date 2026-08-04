import fs from "node:fs/promises";
import type { WorkspaceInfo } from "../types.js";
import {
  connectLanceDb,
  createLexicalIndexes,
  directorySize,
  distanceToScore,
  generationFromTableName,
  isManagedTable,
  lanceDbModule,
  lanceDbRow,
  LEGACY_TABLE_NAME,
  LEXICAL_COLUMNS,
  type LanceDbSearchRow,
  memoryVectorRecordFromStored,
  memoryVectorRowFromStored,
  optimizeActiveTable,
  recordIdFromRow,
  recordIdPredicate,
  REQUIRED_LEXICAL_INDEXES,
  sqlString,
  tableName
} from "./lancedb-store-support.js";
import { MEMORY_MANIFEST_FILE, memoryRootPath } from "./storage-paths.js";
import type {
  MemoryLexicalField,
  MemoryLexicalSearchHit,
  MemorySearchHit,
  MemoryStorePurgeResult,
  MemoryVectorRecord,
  MemoryVectorRow,
  MemoryVectorStore
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
    generation?: string
  ): Promise<MemoryVectorRow[]> {
    if (!(await this.exists(info, generation))) return [];
    const db = await connectLanceDb(info);
    const table = await db.openTable(tableName(generation));
    return (await table.query().toArray()).map(memoryVectorRowFromStored);
  }

  async rebuild(
    info: WorkspaceInfo,
    records: MemoryVectorRecord[],
    vectors: number[][],
    generation?: string
  ): Promise<void> {
    const db = await connectLanceDb(info);
    const rows = records.map((record, index) =>
      lanceDbRow(record, vectors[index] ?? [])
    );
    const table = await db.createTable(tableName(generation), rows, {
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
      limit: number;
    }
  ): Promise<MemorySearchHit[]> {
    const db = await connectLanceDb(info);
    const table = await db.openTable(tableName(options.generation));
    const query = table.vectorSearch(vector).distanceType("cosine");
    if (options.kind) query.where(`kind = ${sqlString(options.kind)}`);
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
      limit: number;
    }
  ): Promise<MemoryLexicalSearchHit[]> {
    const db = await connectLanceDb(info);
    const table = await db.openTable(tableName(options.generation));
    const lancedb = await lanceDbModule();
    const column = LEXICAL_COLUMNS[options.field];
    const query = new lancedb.MatchQuery(queryText, column, {
      operator: lancedb.Operator.Or
    });
    const rows = (await table
      .query()
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
    const table = await db.createTable(
      LEGACY_TABLE_NAME,
      rows.map((row) => lanceDbRow(row, row.vector))
    );
    await createLexicalIndexes(table);
  }
}
