import type {
  MemoryIndexHealth,
  WorkspaceInfo,
  WorkspaceSettings
} from "../types.js";
import {
  prepareMemoryInWorkspace,
  readMemoryStatusInWorkspace,
  rebuildMemoryInWorkspace
} from "./operations.js";
import { memoryRebuildActiveInWorkspace } from "./rebuild-coordination.js";
import type { EmbeddingProvider, MemoryVectorStore } from "./types.js";

type ProviderFactory = () => EmbeddingProvider;
type MemoryFailureKind = "prepare" | "rebuild";

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

  async rebuild(): Promise<void> {
    if (this.preparePromise) return this.preparePromise;
    if (this.rebuildPromise) return this.rebuildPromise;
    this.rebuildPromise = this.performRebuild();
    return this.rebuildPromise;
  }

  async health(settings: WorkspaceSettings): Promise<MemoryIndexHealth> {
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

  private async performRebuild(): Promise<void> {
    const provider = this.createProvider();
    try {
      const status = await readMemoryStatusInWorkspace(this.info, {
        provider,
        store: this.store
      });
      if (status.status === "model_missing") {
        throw new Error("Memory model is not prepared.");
      }
      const rebuild = await rebuildMemoryInWorkspace(this.info, {
        provider,
        store: this.store
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
      await provider.dispose().catch(() => undefined);
      this.rebuildPromise = undefined;
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
