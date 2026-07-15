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
  workspaceSettingsPath
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
  MemoryRecallResult,
  MemoryStatus,
  MemoryVectorRecord,
  MemoryVectorStore,
  ThreadSummarySource
} from "./types.js";
