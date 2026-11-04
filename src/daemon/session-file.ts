import fs from "node:fs/promises";
import path from "node:path";
import {
  slotKey,
  type RegistryFile,
  type SessionBinding
} from "../core/session-slots.js";

/**
 * Reads, validates and serializes sessions.json. An unreadable or invalid file
 * is reported as invalid and is never rewritten by a reader. The meta marker is
 * written before the first registry. Its presence without sessions.json means the
 * registry was lost, which fails closed until a human recovers it.
 */
export const REGISTRY_FILE_NAME = "sessions.json";
export const REGISTRY_META_FILE_NAME = "sessions.meta.json";
const UNPARSEABLE = Symbol("unparseable");

export type RegistryView =
  | { status: "ready"; file: RegistryFile }
  | { status: "invalid"; reason: string };

export function emptyRegistryFile(): RegistryFile {
  return { version: 1, generation: 0, slots: {} };
}

export async function readRegistryView(
  filePath: string
): Promise<RegistryView> {
  const content = await readOptionalFile(filePath);
  if (content !== undefined) return parseRegistry(content);
  if (await registryMetaExists(filePath)) {
    return { status: "invalid", reason: "registry_lost" };
  }
  return { status: "ready", file: emptyRegistryFile() };
}

export function registryMetaPath(filePath: string): string {
  return path.join(path.dirname(filePath), REGISTRY_META_FILE_NAME);
}

export async function registryMetaExists(filePath: string): Promise<boolean> {
  const content = await readOptionalFile(registryMetaPath(filePath));
  return content !== undefined;
}

export function serializeRegistryMeta(initializedAt: string): string {
  return `${JSON.stringify({ version: 1, initializedAt }, null, 2)}\n`;
}

export function serializeRegistry(file: RegistryFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function isRegistryFile(value: unknown): value is RegistryFile {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    isCount(value.generation) &&
    isSlotRecord(value.slots)
  );
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function parseRegistry(content: string): RegistryView {
  const parsed = parseJson(content);
  if (parsed === UNPARSEABLE) {
    return { status: "invalid", reason: "unreadable_json" };
  }
  if (!isRegistryFile(parsed)) {
    return { status: "invalid", reason: "invalid_shape" };
  }
  return { status: "ready", file: parsed };
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return UNPARSEABLE;
  }
}

function isSlotRecord(value: unknown): value is Record<string, SessionBinding> {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([key, binding]) => isBinding(binding) && slotKey(binding) === key
  );
}

function isBinding(value: unknown): value is SessionBinding {
  if (!isRecord(value)) return false;
  return (
    isText(value.workspaceId) &&
    isText(value.threadId) &&
    isText(value.profile) &&
    value.client === "claude-code" &&
    isText(value.nativeSessionId) &&
    isOptionalText(value.envSessionId) &&
    isOptionalText(value.previousSessionId) &&
    isOptionalText(value.sessionChangedAt) &&
    isText(value.hostId) &&
    (value.origin === "open" || value.origin === "adopted") &&
    isCount(value.generation) &&
    isOwner(value.owner) &&
    isText(value.boundAt) &&
    isOptionalText(value.observedAt) &&
    isOptionalText(value.endedAt) &&
    isConflicts(value.conflicts)
  );
}

function isOwner(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isOptionalInteger(value.clientPid) &&
    isOptionalNumber(value.clientStartedAt) &&
    isOptionalText(value.ownerToken) &&
    isOptionalText(value.reservedAt) &&
    isOptionalText(value.lastHeartbeatAt)
  );
}

function isConflicts(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) => isRecord(entry) && isText(entry.sessionId) && isText(entry.at)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isOptionalText(value: unknown): boolean {
  return value === undefined || isText(value);
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === "number";
}

function isOptionalInteger(value: unknown): boolean {
  return value === undefined || Number.isInteger(value);
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}
