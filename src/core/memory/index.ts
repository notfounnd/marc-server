export {
  LocalEmbeddingProvider,
  localModelCachePath
} from "./local-provider.js";
export {
  MemoryProviderManager,
  MEMORY_PROVIDER_IDLE_TIMEOUT_MS
} from "./provider-manager.js";
export {
  prepareMemoryInWorkspace,
  readMemoryStatusInWorkspace,
  rebuildMemoryInWorkspace,
  reconcileMemoryInWorkspace,
  recallMemoryInWorkspace
} from "./operations.js";
export {
  MEMORY_REBUILD_RESOURCE,
  memoryRebuildingStatus,
  memoryRebuildActiveInWorkspace
} from "./rebuild-coordination.js";
export { BackgroundMemoryReconciler } from "./background.js";
export {
  readWorkspaceSettingsInWorkspace,
  updateWorkspaceSettingsInWorkspace,
  workspaceSettingsPath,
  DEFAULT_MEMORY_EMBEDDING_BATCH_SIZE,
  MAX_MEMORY_EMBEDDING_BATCH_SIZE,
  MIN_MEMORY_EMBEDDING_BATCH_SIZE,
  isMemoryEmbeddingBatchSize
} from "./settings.js";
export {
  InMemoryMemoryVectorStore,
  LanceDbMemoryVectorStore,
  memoryManifestPath,
  memoryRootPath,
  readMemoryManifest
} from "./store.js";
export { scanThreadSummarySources } from "./summaries.js";
export type {
  EmbeddingProvider,
  EmbeddingProviderMetadata,
  MemoryManifest,
  MemoryRebuildMode,
  MemoryRecallResult,
  MemoryStatus,
  MemoryVectorRecord,
  MemoryVectorRow,
  MemoryVectorStore,
  ThreadSummarySource
} from "./types.js";
