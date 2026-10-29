import {
  DEFAULT_SEARCH_LAYERS,
  type MemoryLayer
} from "../src/core/memory/sources/contract.js";
import { InMemoryMemoryVectorStore } from "../src/core/memory/store.js";
import type {
  MemoryLexicalField,
  MemoryLexicalSearchHit,
  MemoryManifest,
  MemoryRecordKind,
  MemorySearchHit,
  MemoryStatus,
  MemoryVectorRecord,
  MemoryVectorRow,
  MemoryVectorStore
} from "../src/core/memory/types.js";
import { cosineSimilarity } from "../src/core/memory/vector-math.js";
import type { WorkspaceInfo } from "../src/core/types.js";

export type DeepFixtureOptions = {
  /** Passages whose text contains this term are returned by the lexical channel. */
  lexicalTerm?: string;
  /** Passages whose text contains this term are left out of the vector channel. */
  vectorExcludedTerm?: string;
};

/**
 * An in-memory store whose vector and lexical channels can be steered by a term. A test can put a
 * passage in the lexical channel alone. All other calls delegate to the in-memory store.
 */
export class DeepFixtureStore implements MemoryVectorStore {
  private readonly memory = new InMemoryMemoryVectorStore();

  constructor(private readonly fixture: DeepFixtureOptions = {}) {}

  exists(info: WorkspaceInfo, generation?: string): Promise<boolean> {
    return this.memory.exists(info, generation);
  }

  listRecordIds(info: WorkspaceInfo, generation?: string): Promise<string[]> {
    return this.memory.listRecordIds(info, generation);
  }

  readRows(
    info: WorkspaceInfo,
    generation?: string,
    options?: { layers?: readonly MemoryLayer[]; threadId?: string }
  ): Promise<MemoryVectorRow[]> {
    return this.memory.readRows(info, generation, options);
  }

  rebuild(
    info: WorkspaceInfo,
    records: MemoryVectorRecord[],
    vectors: number[][],
    generation?: string
  ): Promise<void> {
    return this.memory.rebuild(info, records, vectors, generation);
  }

  reconcile(
    info: WorkspaceInfo,
    rows: MemoryVectorRow[],
    removeRecordIds: string[]
  ): Promise<void> {
    return this.memory.reconcile(info, rows, removeRecordIds);
  }

  validateGeneration(info: WorkspaceInfo, generation: string): Promise<void> {
    return this.memory.validateGeneration(info, generation);
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
    const rows = await this.readRows(info, options.generation, {
      layers: options.layers ?? DEFAULT_SEARCH_LAYERS
    });
    return rows
      .filter((row) => options.kind === undefined || row.kind === options.kind)
      .filter((row) => !this.isVectorExcluded(row.text))
      .map((row) => ({
        record: row,
        score: cosineSimilarity(vector, row.vector)
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit);
  }

  async searchLexical(
    info: WorkspaceInfo,
    _queryText: string,
    vector: number[],
    options: {
      field: MemoryLexicalField;
      generation?: string;
      layers?: readonly MemoryLayer[];
      limit: number;
    }
  ): Promise<MemoryLexicalSearchHit[]> {
    const rows = await this.readRows(info, options.generation, {
      layers: options.layers ?? DEFAULT_SEARCH_LAYERS
    });
    return rows
      .filter((row) => this.isLexicalMatch(row.text))
      .map((row) => ({
        field: options.field,
        record: row,
        score: 1,
        vectorScore: cosineSimilarity(vector, row.vector)
      }))
      .slice(0, options.limit);
  }

  private isVectorExcluded(text: string): boolean {
    const term = this.fixture.vectorExcludedTerm ?? "";
    return term.length > 0 && text.includes(term);
  }

  private isLexicalMatch(text: string): boolean {
    const term = this.fixture.lexicalTerm ?? "";
    return term.length > 0 && text.includes(term);
  }
}

/** A record with defaults for every field that the deep tests do not set. */
export function recordFixture(
  overrides: Partial<MemoryVectorRecord> & {
    recordId: string;
    threadId: string;
    kind: MemoryRecordKind;
    text: string;
  }
): MemoryVectorRecord {
  const sourcePath = `threads/${overrides.threadId}/SUMMARY.md`;
  return {
    title: overrides.threadId,
    summaryPath: sourcePath,
    relativeSummaryPath: sourcePath,
    reference: `marc://$${overrides.threadId}`,
    embeddingText: overrides.text,
    sourceType: "summary",
    layer: 0,
    sourcePath,
    authority: "decision",
    lineStart: 1,
    lineEnd: 3,
    sourceSha256: "source-sha",
    passageOrdinal: 1,
    passageSha256: `${overrides.recordId}-sha`,
    passageId: `${sourcePath}#${overrides.recordId}`,
    ...overrides
  };
}

export function statusFixture(
  overrides: Partial<MemoryStatus> = {}
): MemoryStatus {
  return {
    status: "ready",
    ready: true,
    stale: false,
    modelPrepared: true,
    retrieverPrepared: true,
    rerankerPrepared: true,
    interpreterPrepared: true,
    rebuildReady: true,
    searchReady: true,
    summaryCount: 0,
    indexedSummaryCount: 0,
    missingSummaryIds: [],
    staleSummaryIds: [],
    extraSummaryIds: [],
    message: "ready",
    ...overrides
  };
}

/** A thread summary with one result line. Its sections become passages in the index. */
export function summaryMarkdown(threadId: string, body: string): string {
  return [
    `# Summary - ${threadId}`,
    "",
    `Thread: \`${threadId}\``,
    "",
    "## Result",
    "",
    `- ${body}`
  ].join("\n");
}

/** Reads the manifest records of one thread, for assertions on what the index holds. */
export function recordsOfThread(
  manifest: MemoryManifest | undefined,
  threadId: string
): MemoryManifest["records"] {
  return (manifest?.records ?? []).filter(
    (record) => record.threadId === threadId
  );
}

export function passageRows(
  rows: readonly MemoryVectorRow[]
): MemoryVectorRow[] {
  return rows.filter((row) => row.kind === "passage");
}
