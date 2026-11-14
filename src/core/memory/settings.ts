import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_CYCLES_PER_STAGE,
  isCyclesPerStage,
  type RawActivity
} from "../activation-cycles.js";
import { safeJoin } from "../paths.js";
import type {
  WorkspaceDocumentSource,
  WorkspaceInfo,
  WorkspaceSettings,
  WorkspaceSettingsInput
} from "../types.js";
import { SETTINGS_FILE } from "../workspace-settings-file.js";
import {
  withWorkspaceWriteLock,
  writeFileAtomically
} from "../write-coordination.js";

export const DEFAULT_MEMORY_EMBEDDING_BATCH_SIZE = 4;
export const MIN_MEMORY_EMBEDDING_BATCH_SIZE = 2;
export const MAX_MEMORY_EMBEDDING_BATCH_SIZE = 16;

const DEFAULT_SETTINGS: WorkspaceSettings = {
  memory: {
    autoRebuild: true,
    embeddingBatchSize: DEFAULT_MEMORY_EMBEDDING_BATCH_SIZE,
    documentSources: []
  },
  activation: { cyclesPerStage: DEFAULT_CYCLES_PER_STAGE },
  listening: { defaultOn: false }
};

type WorkspaceSettingsFile = Partial<{
  memory: Partial<{
    autoRebuild: boolean;
    embeddingBatchSize: number;
    documentSources: unknown;
  }>;
  activation: unknown;
  listening: unknown;
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

/**
 * Saves the settings. The activation and listening sections are passed through as the file holds them
 * unless the input carries a value for them, so a memory save never drops or rewrites either one.
 */
export async function updateWorkspaceSettingsInWorkspace(
  info: WorkspaceInfo,
  input: WorkspaceSettingsInput
): Promise<WorkspaceSettings> {
  const current = await readWorkspaceSettingsInWorkspace(info);
  const next = mergeWorkspaceSettings(current, input);
  const raw = await readRawActivityInWorkspace(info);
  const activation = activationToWrite(raw, input);
  const kept = await readRawListeningInWorkspace(info);
  const listening = listeningToWrite(kept, input, next);
  await withWorkspaceWriteLock(info.marcPath, "workspace-settings", () =>
    writeFileAtomically(
      workspaceSettingsPath(info),
      renderSettings(next, activation, listening)
    )
  );
  return next;
}

/** The listening section as the file holds it. Unreadable JSON has no section to keep. */
async function readRawListeningInWorkspace(
  info: WorkspaceInfo
): Promise<unknown> {
  const content = await readSettingsContent(info);
  if (content === undefined) return undefined;
  return rawListeningOf(content);
}

function rawListeningOf(content: string): unknown {
  try {
    const parsed: unknown = JSON.parse(content);
    return isRecord(parsed) ? parsed.listening : undefined;
  } catch {
    return undefined;
  }
}

function listeningToWrite(
  kept: unknown,
  input: WorkspaceSettingsInput,
  next: WorkspaceSettings
): unknown {
  if (input.listening === undefined) return kept;
  const base = isRecord(kept) ? kept : {};
  return { ...base, defaultOn: next.listening.defaultOn };
}

/** The activation section as the file holds it. Unreadable JSON has no section to keep. */
export async function readRawActivityInWorkspace(
  info: WorkspaceInfo
): Promise<RawActivity> {
  const content = await readSettingsContent(info);
  if (content === undefined) {
    return { status: "readable", activation: undefined };
  }
  return rawActivityOf(content);
}

function rawActivityOf(content: string): RawActivity {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { status: "unreadable" };
  }
  if (!isRecord(parsed)) return { status: "unreadable" };
  return { status: "readable", activation: parsed.activation };
}

function activationToWrite(
  raw: RawActivity,
  input: WorkspaceSettingsInput
): unknown {
  const kept = raw.status === "readable" ? raw.activation : undefined;
  const values = input.activation;
  if (values === undefined) return kept;
  const base = isRecord(kept) ? kept : {};
  return { ...base, ...values };
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
      embeddingBatchSize: nextEmbeddingBatchSize(current, input),
      documentSources: current.memory.documentSources
    },
    activation: { cyclesPerStage: nextCyclesPerStage(current, input) },
    listening: { defaultOn: nextListeningDefaultOn(current, input) }
  };
}

function nextListeningDefaultOn(
  current: WorkspaceSettings,
  input: WorkspaceSettingsInput
): boolean {
  const next = input.listening?.defaultOn;
  if (typeof next !== "boolean") return current.listening.defaultOn;
  return next;
}

function nextCyclesPerStage(
  current: WorkspaceSettings,
  input: WorkspaceSettingsInput
): number {
  const next = input.activation?.cyclesPerStage;
  if (next === undefined) return current.activation.cyclesPerStage;
  if (isCyclesPerStage(next)) return next;
  throw new Error("Cycles per stage must be an integer from 1 to 20.");
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

function renderSettings(
  settings: WorkspaceSettings,
  activation: unknown,
  listening: unknown
): string {
  const document = {
    memory: settings.memory,
    ...(activation === undefined ? {} : { activation }),
    ...(listening === undefined ? {} : { listening })
  };
  return `${JSON.stringify(document, null, 2)}\n`;
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
        : DEFAULT_SETTINGS.memory.embeddingBatchSize,
      documentSources: normalizeDocumentSources(memory.documentSources)
    },
    activation: { cyclesPerStage: cyclesOf(input.activation) },
    listening: listeningOf(input.listening)
  };
}

/** The value a readable file holds, or the default. The authorized value is decided by the daemon. */
function cyclesOf(value: unknown): number {
  if (!isRecord(value)) return DEFAULT_CYCLES_PER_STAGE;
  return isCyclesPerStage(value.cyclesPerStage)
    ? value.cyclesPerStage
    : DEFAULT_CYCLES_PER_STAGE;
}

/** A preference, not an authorization: a file value that is not a boolean reads as the default. */
function listeningOf(value: unknown): WorkspaceSettings["listening"] {
  if (!isRecord(value))
    return { defaultOn: DEFAULT_SETTINGS.listening.defaultOn };
  return {
    defaultOn:
      typeof value.defaultOn === "boolean"
        ? value.defaultOn
        : DEFAULT_SETTINGS.listening.defaultOn
  };
}

function defaultSettings(): WorkspaceSettings {
  return {
    memory: {
      autoRebuild: DEFAULT_SETTINGS.memory.autoRebuild,
      embeddingBatchSize: DEFAULT_SETTINGS.memory.embeddingBatchSize,
      documentSources: []
    },
    activation: { cyclesPerStage: DEFAULT_CYCLES_PER_STAGE },
    listening: { defaultOn: DEFAULT_SETTINGS.listening.defaultOn }
  };
}

// Lexical checks only, so a malformed settings file never throws. An entry
// that fails any check is dropped; a non-array value becomes [].
function normalizeDocumentSources(value: unknown): WorkspaceDocumentSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => documentSourceEntry(entry));
}

function documentSourceEntry(value: unknown): WorkspaceDocumentSource[] {
  if (!isRecord(value)) return [];
  const documentPath = value.path;
  if (typeof documentPath !== "string" || !documentPath.trim()) return [];
  const authority = documentAuthority(value.authority);
  if (!authority) return [];
  if (!isWorkspaceRelativePath(documentPath)) return [];
  return [{ path: documentPath, authority }];
}

function documentAuthority(
  value: unknown
): WorkspaceDocumentSource["authority"] | undefined {
  if (value === "normative" || value === "reference") return value;
  return undefined;
}

function isWorkspaceRelativePath(documentPath: string): boolean {
  if (isAbsoluteOrDriveOrUnc(documentPath)) return false;
  const normalized = path.normalize(documentPath);
  if (normalized.startsWith("..")) return false;
  const segments = normalized.split(/[\\/]+/);
  if (segments[0] === ".marc") return false;
  return !segments.includes("node_modules");
}

function isAbsoluteOrDriveOrUnc(documentPath: string): boolean {
  return (
    path.isAbsolute(documentPath) ||
    /^[A-Za-z]:/.test(documentPath) ||
    /^[\\/]{2}/.test(documentPath)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotFoundError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
