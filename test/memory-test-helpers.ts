import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  EmbeddingProvider,
  EmbeddingProviderMetadata,
  MemoryLexicalField,
  MemoryLexicalSearchHit,
  MemorySearchHit,
  MemoryVectorRecord,
  MemoryVectorRow,
  MemoryVectorStore,
  QueryInterpretationProvider,
  QueryInterpretationProviderMetadata,
  RerankingProvider,
  RerankingProviderMetadata
} from "../src/core/memory/types.js";
import type { WorkspaceInfo } from "../src/core/types.js";

export const providerMetadata: EmbeddingProviderMetadata = {
  id: "fake-local",
  name: "Fake Local Embeddings",
  model: "fake-memory-model",
  version: "1.0.0",
  dimensions: 3,
  distance: "cosine",
  quantized: false,
  runtime: "local"
};

export const rerankerMetadata: RerankingProviderMetadata = {
  id: "fake-reranker",
  name: "Fake reranker",
  model: "fake-reranker-model",
  version: "1.0.0",
  quantized: true,
  runtime: "local"
};

export class FakeEmbeddingProvider implements EmbeddingProvider {
  prepareCalls = 0;
  documentCalls = 0;
  queryCalls = 0;
  disposeCalls = 0;
  readonly queryTexts: string[] = [];

  constructor(
    private readonly metadata: EmbeddingProviderMetadata = providerMetadata,
    private readonly prepared = true
  ) {}

  describe(): EmbeddingProviderMetadata {
    return this.metadata;
  }

  isPrepared(): Promise<boolean> {
    return Promise.resolve(this.prepared);
  }

  async prepare(): Promise<void> {
    this.prepareCalls += 1;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    this.documentCalls += 1;
    return texts.map(vectorForText);
  }

  async embedQuery(text: string): Promise<number[]> {
    this.queryCalls += 1;
    this.queryTexts.push(text);
    return vectorForText(text);
  }

  async dispose(): Promise<void> {
    this.disposeCalls += 1;
  }
}

export class FakeRerankingProvider implements RerankingProvider {
  prepareCalls = 0;
  rerankCalls = 0;
  readonly rerankBatchSizes: number[] = [];
  readonly rerankedDocuments: string[][] = [];
  readonly rerankedQueries: string[] = [];
  disposeCalls = 0;

  constructor(
    private readonly scores: (
      query: string,
      documents: string[]
    ) => number[] = (_query, documents) => documents.map(() => 1),
    private readonly prepared = true
  ) {}

  describe(): RerankingProviderMetadata {
    return rerankerMetadata;
  }

  async isPrepared(): Promise<boolean> {
    return this.prepared;
  }

  async prepare(): Promise<void> {
    this.prepareCalls += 1;
  }

  async rerank(
    query: string,
    documents: string[],
    _batchSize: number
  ): Promise<number[]> {
    this.rerankCalls += 1;
    this.rerankBatchSizes.push(_batchSize);
    this.rerankedQueries.push(query);
    this.rerankedDocuments.push([...documents]);
    return this.scores(query, documents);
  }

  async splitPassages(texts: string[]): Promise<string[][]> {
    return texts.map((text) => [text]);
  }

  async dispose(): Promise<void> {
    this.disposeCalls += 1;
  }
}

export class FakeQueryInterpretationProvider implements QueryInterpretationProvider {
  prepareCalls = 0;
  disposeCalls = 0;
  readonly calls: Array<{
    feedback?: string;
    originalQuery: string;
    variants: string[];
  }> = [];

  constructor(
    private readonly outputs: string[] = ["0"],
    private readonly prepared = true
  ) {}

  describe(): QueryInterpretationProviderMetadata {
    return {
      id: "fake-interpreter",
      model: "fake-query-model",
      name: "Fake query interpreter",
      quantized: true,
      runtime: "local",
      version: "1"
    };
  }

  isPrepared(): Promise<boolean> {
    return Promise.resolve(this.prepared);
  }

  async prepare(): Promise<void> {
    this.prepareCalls += 1;
  }

  selectVariant(input: {
    feedback?: string;
    originalQuery: string;
    variants: string[];
  }): Promise<string> {
    this.calls.push(input);
    return Promise.resolve(this.outputs.shift() ?? "0");
  }

  async dispose(): Promise<void> {
    this.disposeCalls += 1;
  }
}

export class ScoreOverrideStore implements MemoryVectorStore {
  private records: MemoryVectorRecord[] = [];
  readonly lexicalFields: MemoryLexicalField[] = [];
  readonly searchOptions: Array<{ limit: number }> = [];

  constructor(
    private readonly scoresByThread: Record<string, number>,
    private readonly excludedVectorThreadIds = new Set<string>()
  ) {}

  exists(): Promise<boolean> {
    return Promise.resolve(this.records.length > 0);
  }

  listRecordIds(): Promise<string[]> {
    return Promise.resolve(this.records.map((record) => record.recordId));
  }

  readRows(): Promise<MemoryVectorRow[]> {
    return Promise.resolve(
      this.records.map((record) => ({ ...record, vector: [] }))
    );
  }

  async rebuild(
    _info: WorkspaceInfo,
    records: MemoryVectorRecord[],
    _vectors: number[][]
  ): Promise<void> {
    this.records = records;
  }

  reconcile(
    _info: WorkspaceInfo,
    rows: MemoryVectorRow[],
    removeRecordIds: string[]
  ): Promise<void> {
    const recordsById = new Map(
      this.records.map((record) => [record.recordId, record])
    );
    for (const row of rows) recordsById.set(row.recordId, row);
    for (const recordId of removeRecordIds) recordsById.delete(recordId);
    this.records = [...recordsById.values()];
    return Promise.resolve();
  }

  validateGeneration(): Promise<void> {
    return Promise.resolve();
  }

  searchVector(
    _info: WorkspaceInfo,
    _vector: number[],
    options: {
      generation?: string;
      kind?: "identity" | "passage";
      limit: number;
    }
  ): Promise<MemorySearchHit[]> {
    this.searchOptions.push(options);
    const hits = this.records
      .filter((record) => !this.excludedVectorThreadIds.has(record.threadId))
      .filter((record) => !options.kind || record.kind === options.kind)
      .map((record) => ({
        record,
        score: this.scoresByThread[record.threadId] ?? 0
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit);

    return Promise.resolve(hits);
  }

  searchLexical(
    _info: WorkspaceInfo,
    _query: string,
    _vector: number[],
    options: { field: MemoryLexicalField }
  ): Promise<MemoryLexicalSearchHit[]> {
    this.lexicalFields.push(options.field);
    return Promise.resolve([]);
  }
}

export async function tempWorkspace(): Promise<WorkspaceInfo> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "marc-memory-"));
  const marcPath = path.join(rootPath, ".marc");
  await fs.mkdir(path.join(marcPath, "threads"), { recursive: true });
  return {
    id: "memory-workspace",
    name: "memory-workspace",
    rootPath,
    marcPath
  };
}

export async function writeSummary(
  info: WorkspaceInfo,
  threadId: string,
  content: string
): Promise<void> {
  const threadPath = path.join(info.marcPath, "threads", threadId);
  await fs.mkdir(threadPath, { recursive: true });
  await fs.writeFile(path.join(threadPath, "SUMMARY.md"), content);
}

export async function writeThreadChat(
  info: WorkspaceInfo,
  threadId: string,
  title: string
): Promise<void> {
  const threadPath = path.join(info.marcPath, "threads", threadId);
  await fs.mkdir(threadPath, { recursive: true });
  await fs.writeFile(
    path.join(threadPath, "CHAT.md"),
    [`# ${title}`, "", `Thread: \`${threadId}\``].join("\n")
  );
}

export async function createThreadFolder(
  info: WorkspaceInfo,
  threadId: string
): Promise<void> {
  await fs.mkdir(path.join(info.marcPath, "threads", threadId), {
    recursive: true
  });
}

function vectorForText(text: string): number[] {
  const normalized = text.toLowerCase();
  const tokenScore = tokenCount(normalized, [
    "token",
    "daemon",
    "seguranca",
    "security",
    "rotacao",
    "rotation",
    "interface"
  ]);
  const uiScore = tokenCount(normalized, ["composer", "autocomplete", "ui"]);
  const workflowScore = tokenCount(normalized, [
    "bootstrap",
    "thread",
    "summary",
    "workflow"
  ]);
  return [tokenScore, uiScore, workflowScore];
}

function tokenCount(text: string, tokens: string[]): number {
  return tokens.reduce((total, token) => {
    if (!text.includes(token)) return total;
    return total + 1;
  }, 0);
}
