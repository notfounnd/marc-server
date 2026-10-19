import type { WorkspaceInfo, WorkspaceSettings } from "../../types.js";
import { readArtifactSources } from "./artifact.js";
import { readChatSources } from "./chat.js";
import {
  MEMORY_SOURCE_LAYERS,
  type MemoryLayer,
  type MemorySource,
  type MemorySourceType
} from "./contract.js";
import { readDocumentSources } from "./document.js";
import { readRulesSources } from "./rules.js";
import { readSummarySources } from "./summary.js";

export type MemorySourceReader = (
  info: WorkspaceInfo,
  settings: WorkspaceSettings
) => Promise<MemorySource[]>;

export const memorySourceReaders: Record<MemorySourceType, MemorySourceReader> =
  {
    summary: readSummarySources,
    artifact: readArtifactSources,
    rules: readRulesSources,
    document: readDocumentSources,
    chat: readChatSources
  };

export const INDEXED_LAYERS: readonly MemoryLayer[] = [0];

const SOURCE_TYPE_ORDER: readonly MemorySourceType[] = [
  "summary",
  "artifact",
  "rules",
  "document",
  "chat"
];

// Readers for the requested layers, in fixed type order, each group sorted by
// sourcePath.
export async function readIndexedSources(
  info: WorkspaceInfo,
  settings: WorkspaceSettings,
  layers: readonly MemoryLayer[] = INDEXED_LAYERS
): Promise<MemorySource[]> {
  const types = SOURCE_TYPE_ORDER.filter((type) =>
    layers.includes(MEMORY_SOURCE_LAYERS[type])
  );
  const groups = await Promise.all(
    types.map((type) => memorySourceReaders[type](info, settings))
  );
  return groups.flatMap((group) =>
    [...group].sort((left, right) =>
      left.sourcePath.localeCompare(right.sourcePath)
    )
  );
}
