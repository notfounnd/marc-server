import { FakeEmbeddingProvider } from "./memory-test-helpers.js";
import type {
  MemoryLexicalSearchHit,
  MemoryVectorRecord,
  MemoryVectorRow,
  MemoryVectorStore
} from "../src/core/memory/types.js";
import type { WorkspaceInfo } from "../src/core/types.js";

export class Deferred {
  promise: Promise<void>;
  resolve!: () => void;

  constructor() {
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }
}

export class PreparedProvider extends FakeEmbeddingProvider {
  constructor(
    private preparedState: boolean,
    private readonly gate?: Deferred
  ) {
    super();
  }

  isPrepared(): Promise<boolean> {
    return Promise.resolve(this.preparedState);
  }

  async prepare(): Promise<void> {
    this.prepareCalls += 1;
    await this.gate?.promise;
    this.preparedState = true;
  }
}

export class GatedStore implements MemoryVectorStore {
  rebuildCalls = 0;
  readRowsCalls = 0;
  reconcileCalls = 0;
  private readonly generations = new Map<string, MemoryVectorRow[]>();
  private latestGeneration?: string;

  constructor(
    private gate?: Deferred,
    private failure?: Error
  ) {}

  setGate(gate?: Deferred): void {
    this.gate = gate;
  }

  setFailure(failure?: Error): void {
    this.failure = failure;
  }

  exists(_info: WorkspaceInfo, generation?: string): Promise<boolean> {
    return Promise.resolve(this.rows(generation).length > 0);
  }

  listRecordIds(_info: WorkspaceInfo, generation?: string): Promise<string[]> {
    return Promise.resolve(
      this.rows(generation).map((record) => record.recordId)
    );
  }

  readRows(
    _info: WorkspaceInfo,
    generation?: string
  ): Promise<MemoryVectorRow[]> {
    this.readRowsCalls += 1;
    return Promise.resolve(this.rows(generation));
  }

  async rebuild(
    _info: WorkspaceInfo,
    records: MemoryVectorRecord[],
    vectors: number[][],
    generation = "legacy"
  ): Promise<void> {
    this.rebuildCalls += 1;
    await this.gate?.promise;
    if (this.failure) throw this.failure;
    const rows = records.map((record, index) => ({
      ...record,
      vector: vectors[index] ?? []
    }));
    this.generations.set(generation, rows);
    this.latestGeneration = generation;
  }

  async reconcile(
    _info: WorkspaceInfo,
    rows: MemoryVectorRow[],
    removeRecordIds: string[]
  ): Promise<void> {
    this.reconcileCalls += 1;
    await this.gate?.promise;
    if (this.failure) throw this.failure;
    const recordsById = new Map(
      this.rows().map((record) => [record.recordId, record])
    );
    for (const row of rows) recordsById.set(row.recordId, row);
    for (const recordId of removeRecordIds) recordsById.delete(recordId);
    const generation = this.latestGeneration ?? "legacy";
    this.generations.set(generation, [...recordsById.values()]);
  }

  validateGeneration(): Promise<void> {
    return Promise.resolve();
  }

  searchVector(): Promise<[]> {
    return Promise.resolve([]);
  }

  searchLexical(): Promise<MemoryLexicalSearchHit[]> {
    return Promise.resolve([]);
  }

  private rows(generation?: string): MemoryVectorRow[] {
    const selected = generation ?? this.latestGeneration;
    if (!selected) return [];
    return this.generations.get(selected) ?? [];
  }
}

export async function waitFor(assertion: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
