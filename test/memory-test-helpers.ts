import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  EmbeddingProvider,
  EmbeddingProviderMetadata,
  MemorySearchHit,
  MemoryVectorRecord,
  MemoryVectorRow,
  MemoryVectorStore
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

export class FakeEmbeddingProvider implements EmbeddingProvider {
  prepareCalls = 0;
  documentCalls = 0;
  queryCalls = 0;
  disposeCalls = 0;

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
    return vectorForText(text);
  }

  async dispose(): Promise<void> {
    this.disposeCalls += 1;
  }
}

export class ScoreOverrideStore implements MemoryVectorStore {
  private records: MemoryVectorRecord[] = [];

  constructor(private readonly scoresByThread: Record<string, number>) {}

  exists(): Promise<boolean> {
    return Promise.resolve(this.records.length > 0);
  }

  listRecordIds(): Promise<string[]> {
    return Promise.resolve(this.records.map((record) => record.recordId));
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

  search(
    _info: WorkspaceInfo,
    _vector: number[],
    options: { limit: number; minScore: number }
  ): Promise<MemorySearchHit[]> {
    const hits = this.records
      .map((record) => ({
        record,
        score: this.scoresByThread[record.threadId] ?? 0
      }))
      .filter((hit) => hit.score >= options.minScore)
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit);

    return Promise.resolve(hits);
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
