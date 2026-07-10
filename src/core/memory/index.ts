export {
  LocalEmbeddingProvider,
  localModelCachePath
} from "./local-provider.js";
export {
  prepareMemoryInWorkspace,
  readMemoryStatusInWorkspace,
  rebuildMemoryInWorkspace,
  recallMemoryInWorkspace
} from "./operations.js";
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
