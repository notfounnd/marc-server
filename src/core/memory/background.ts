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
import {
  DEFAULT_MEMORY_EMBEDDING_BATCH_SIZE,
  DEFAULT_MEMORY_SEARCH_RETRY_DEPTH
} from "./settings.js";
import type {
  EmbeddingProvider,
  MemoryRebuildMode,
  MemoryVectorStore
} from "./types.js";

type ProviderFactory = () => EmbeddingProvider;
type MemoryFailureKind = "prepare" | "rebuild";
type MemoryHealthSettings = {
  memory: {
    autoRebuild: boolean;
    embeddingBatchSize?: number;
    searchRetryDepth?: number;
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
    private readonly store?: MemoryVectorStore
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
      searchRetryDepth:
        settings.memory.searchRetryDepth ?? DEFAULT_MEMORY_SEARCH_RETRY_DEPTH,
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
    try {
      await prepareMemoryInWorkspace(provider);
      this.lastPreparedAt = new Date().toISOString();
      this.lastError = null;
      this.lastFailure = undefined;
    } catch (error) {
      this.lastError = errorMessage(error);
      this.lastFailure = "prepare";
      throw error;
    } finally {
      await provider.dispose().catch(() => undefined);
      this.preparePromise = undefined;
    }
  }

  private async performRebuild(
    mode: MemoryRebuildMode,
    settings: WorkspaceSettings | undefined
  ): Promise<void> {
    const provider = this.createProvider();
    const operation = memoryRebuildOperations[mode];
    let operationStarted = false;
    try {
      const status = await readMemoryStatusInWorkspace(this.info, {
        provider,
        store: this.store
      });
      if (status.status === "model_missing") {
        throw new Error("Memory model is not prepared.");
      }
      operationStarted = true;
      const rebuild = await operation(this.info, {
        provider,
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
      if (!operationStarted) await provider.dispose().catch(() => undefined);
      this.rebuildPromise = undefined;
    }
  }
}

const memoryRebuildOperations = {
  incremental: reconcileMemoryInWorkspace,
  full: rebuildMemoryInWorkspace
} satisfies Record<MemoryRebuildMode, typeof rebuildMemoryInWorkspace>;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
