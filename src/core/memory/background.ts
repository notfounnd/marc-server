import type {
  MemoryIndexHealth,
  WorkspaceInfo,
  WorkspaceSettings
} from "../types.js";
import {
  prepareMemoryInWorkspace,
  readMemoryStatusInWorkspace,
  reconcileMemoryInWorkspace,
  rebuildMemoryInWorkspace
} from "./operations.js";
import { memoryRebuildActiveInWorkspace } from "./rebuild-coordination.js";
import { DEFAULT_MEMORY_EMBEDDING_BATCH_SIZE } from "./settings.js";
import type {
  EmbeddingProvider,
  MemoryRebuildMode,
  MemoryVectorStore,
  QueryInterpretationProvider,
  RerankingProvider
} from "./types.js";

type ProviderFactory = () => EmbeddingProvider;
type RerankerFactory = () => RerankingProvider;
type InterpreterFactory = () => QueryInterpretationProvider;
type MemoryFailureKind = "prepare" | "rebuild";
type MemoryHealthSettings = {
  memory: {
    autoRebuild: boolean;
    embeddingBatchSize?: number;
  };
};

export class BackgroundMemoryReconciler {
  private preparePromise?: Promise<void>;
  private rebuildPromise?: Promise<void>;
  private lastPreparedAt?: string;
  private lastRebuildAt?: string;
  private lastError: string | null = null;
  private lastFailure?: MemoryFailureKind;

  constructor(
    private readonly info: WorkspaceInfo,
    private readonly createProvider: ProviderFactory,
    private readonly store?: MemoryVectorStore,
    private readonly createReranker: RerankerFactory = unavailableRerankingProvider,
    private readonly createInterpreter: InterpreterFactory = passThroughQueryInterpretationProvider
  ) {}

  async prepare(): Promise<void> {
    if (this.rebuildPromise) return this.rebuildPromise;
    if (this.preparePromise) return this.preparePromise;
    this.preparePromise = this.performPrepare();
    return this.preparePromise;
  }

  async rebuild(settings?: WorkspaceSettings): Promise<void> {
    return this.startRebuild("incremental", settings);
  }

  async rebuildFull(settings?: WorkspaceSettings): Promise<void> {
    return this.startRebuild("full", settings);
  }

  private async startRebuild(
    mode: MemoryRebuildMode,
    settings: WorkspaceSettings | undefined
  ): Promise<void> {
    if (this.preparePromise) return this.preparePromise;
    if (this.rebuildPromise) return this.rebuildPromise;
    this.rebuildPromise = this.performRebuild(mode, settings);
    return this.rebuildPromise;
  }

  async health(settings: MemoryHealthSettings): Promise<MemoryIndexHealth> {
    const base = await readMemoryStatusInWorkspace(this.info, {
      provider: this.createProvider(),
      interpreter: this.createInterpreter(),
      reranker: this.createReranker(),
      store: this.store
    });
    const rebuilding =
      Boolean(this.rebuildPromise) ||
      (await memoryRebuildActiveInWorkspace(this.info));
    const health = {
      status: base.status,
      ready: base.ready,
      stale: base.stale,
      modelPrepared: base.modelPrepared,
      rebuildReady: base.rebuildReady,
      rerankerPrepared: base.rerankerPrepared,
      interpreterPrepared: base.interpreterPrepared,
      retrieverPrepared: base.retrieverPrepared,
      searchReady: base.searchReady,
      summaryCount: base.summaryCount,
      indexedSummaryCount: base.indexedSummaryCount,
      preparing: Boolean(this.preparePromise),
      rebuilding,
      lastPreparedAt: this.lastPreparedAt,
      lastRebuildAt: this.lastRebuildAt,
      lastError: this.lastError,
      autoRebuild: settings.memory.autoRebuild,
      embeddingBatchSize:
        settings.memory.embeddingBatchSize ??
        DEFAULT_MEMORY_EMBEDDING_BATCH_SIZE,
      maintenance: base.maintenance,
      message: base.message
    };
    if (this.preparePromise) {
      return {
        ...health,
        status: "preparing",
        ready: false,
        message: "Memory model is preparing."
      };
    }
    if (rebuilding) {
      return {
        ...health,
        status: "rebuilding",
        ready: false,
        message: "Memory rebuild is running."
      };
    }
    if (this.lastFailure === "rebuild" && this.lastError) {
      return {
        ...health,
        status: "degraded",
        ready: false,
        message: "Memory rebuild failed."
      };
    }
    return health;
  }

  private async performPrepare(): Promise<void> {
    const provider = this.createProvider();
    const reranker = this.createReranker();
    const interpreter = this.createInterpreter();
    try {
      await prepareMemoryInWorkspace(this.info, {
        interpreter,
        provider,
        reranker
      });
      this.lastPreparedAt = new Date().toISOString();
      this.lastError = null;
      this.lastFailure = undefined;
    } catch (error) {
      this.lastError = errorMessage(error);
      this.lastFailure = "prepare";
      throw error;
    } finally {
      this.preparePromise = undefined;
    }
  }

  private async performRebuild(
    mode: MemoryRebuildMode,
    settings: WorkspaceSettings | undefined
  ): Promise<void> {
    const provider = this.createProvider();
    const reranker = this.createReranker();
    const interpreter = this.createInterpreter();
    const operation = memoryRebuildOperations[mode];
    try {
      const status = await readMemoryStatusInWorkspace(this.info, {
        provider,
        interpreter,
        reranker,
        store: this.store
      });
      if (!status.rebuildReady)
        throw new Error("Memory retrieval model is not prepared.");
      const rebuild = await operation(this.info, {
        provider,
        reranker,
        store: this.store,
        batchSize: settings?.memory.embeddingBatchSize
      });
      if (!rebuild.acquired) return;
      this.lastRebuildAt = new Date().toISOString();
      this.lastError = null;
      this.lastFailure = undefined;
    } catch (error) {
      this.lastError = errorMessage(error);
      this.lastFailure = "rebuild";
      throw error;
    } finally {
      this.rebuildPromise = undefined;
    }
  }
}

function passThroughQueryInterpretationProvider(): QueryInterpretationProvider {
  return {
    describe: () => ({
      id: "pass-through-interpreter",
      model: "none",
      name: "Pass-through query interpreter",
      quantized: false,
      runtime: "local",
      version: "0"
    }),
    dispose: async () => undefined,
    isPrepared: async () => true,
    prepare: async () => undefined,
    selectVariant: async () => "0"
  };
}

function unavailableRerankingProvider(): RerankingProvider {
  return {
    describe: () => ({
      id: "unavailable-reranker",
      model: "unavailable",
      name: "Unavailable reranker",
      quantized: false,
      runtime: "local",
      version: "0"
    }),
    dispose: async () => undefined,
    isPrepared: async () => false,
    prepare: async () => undefined,
    rerank: async () => [],
    splitPassages: async () => {
      throw new Error("Memory reranking model is not prepared.");
    }
  };
}

const memoryRebuildOperations = {
  incremental: reconcileMemoryInWorkspace,
  full: rebuildMemoryInWorkspace
} satisfies Record<MemoryRebuildMode, typeof rebuildMemoryInWorkspace>;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
