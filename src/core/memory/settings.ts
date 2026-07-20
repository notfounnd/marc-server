import fs from "node:fs/promises";
import { safeJoin } from "../paths.js";
import type {
  WorkspaceInfo,
  WorkspaceSettings,
  WorkspaceSettingsInput
} from "../types.js";
import {
  withWorkspaceWriteLock,
  writeFileAtomically
} from "../write-coordination.js";

const SETTINGS_FILE = "marc.config.json";

export const DEFAULT_MEMORY_EMBEDDING_BATCH_SIZE = 4;
export const MIN_MEMORY_EMBEDDING_BATCH_SIZE = 2;
export const MAX_MEMORY_EMBEDDING_BATCH_SIZE = 16;

const DEFAULT_SETTINGS: WorkspaceSettings = {
  memory: {
    autoRebuild: true,
    embeddingBatchSize: DEFAULT_MEMORY_EMBEDDING_BATCH_SIZE
  }
};

type WorkspaceSettingsFile = Partial<{
  memory: Partial<{
    autoRebuild: boolean;
    embeddingBatchSize: number;
  }>;
}>;

export function isMemoryEmbeddingBatchSize(value: unknown): value is number {
  if (typeof value !== "number") return false;
  if (!Number.isInteger(value)) return false;
  if (value < MIN_MEMORY_EMBEDDING_BATCH_SIZE) return false;
  if (value > MAX_MEMORY_EMBEDDING_BATCH_SIZE) return false;
  return value % 2 === 0;
}

export function workspaceSettingsPath(info: WorkspaceInfo): string {
  return safeJoin(info.marcPath, SETTINGS_FILE);
}

export async function readWorkspaceSettingsInWorkspace(
  info: WorkspaceInfo
): Promise<WorkspaceSettings> {
  const content = await readSettingsContent(info);
  if (!content) return defaultSettings();
  return normalizeWorkspaceSettings(JSON.parse(content));
}

export async function updateWorkspaceSettingsInWorkspace(
  info: WorkspaceInfo,
  input: WorkspaceSettingsInput
): Promise<WorkspaceSettings> {
  const current = await readWorkspaceSettingsInWorkspace(info);
  const next = mergeWorkspaceSettings(current, input);
  await withWorkspaceWriteLock(info.marcPath, "workspace-settings", () =>
    writeFileAtomically(workspaceSettingsPath(info), renderSettings(next))
  );
  return next;
}

function mergeWorkspaceSettings(
  current: WorkspaceSettings,
  input: WorkspaceSettingsInput
): WorkspaceSettings {
  return {
    memory: {
      autoRebuild:
        typeof input.memory?.autoRebuild === "boolean"
          ? input.memory.autoRebuild
          : current.memory.autoRebuild,
      embeddingBatchSize: nextEmbeddingBatchSize(current, input)
    }
  };
}

function nextEmbeddingBatchSize(
  current: WorkspaceSettings,
  input: WorkspaceSettingsInput
): number {
  const next = input.memory?.embeddingBatchSize;
  if (next === undefined) return current.memory.embeddingBatchSize;
  if (isMemoryEmbeddingBatchSize(next)) return next;
  throw new Error(
    "Memory embedding batch size must be an even integer from 2 to 16."
  );
}

async function readSettingsContent(
  info: WorkspaceInfo
): Promise<string | undefined> {
  try {
    return await fs.readFile(workspaceSettingsPath(info), "utf8");
  } catch (error) {
    if (isNotFoundError(error)) return undefined;
    throw error;
  }
}

function renderSettings(settings: WorkspaceSettings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

function normalizeWorkspaceSettings(value: unknown): WorkspaceSettings {
  if (!isRecord(value)) return defaultSettings();
  const input = value as WorkspaceSettingsFile;
  const memory = isRecord(input.memory) ? input.memory : {};
  return {
    memory: {
      autoRebuild:
        typeof memory.autoRebuild === "boolean"
          ? memory.autoRebuild
          : DEFAULT_SETTINGS.memory.autoRebuild,
      embeddingBatchSize: isMemoryEmbeddingBatchSize(memory.embeddingBatchSize)
        ? memory.embeddingBatchSize
        : DEFAULT_SETTINGS.memory.embeddingBatchSize
    }
  };
}

function defaultSettings(): WorkspaceSettings {
  return {
    memory: {
      autoRebuild: DEFAULT_SETTINGS.memory.autoRebuild,
      embeddingBatchSize: DEFAULT_SETTINGS.memory.embeddingBatchSize
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotFoundError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
