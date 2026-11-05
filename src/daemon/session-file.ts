import {
  slotKey,
  type RegistryFile,
  type SessionBinding
} from "../core/session-slots.js";
import { isThreadExtras } from "./activation-file.js";
import { readMarked, type MarkedSpec } from "./marked-file.js";
import {
  markerPathFor,
  readOptionalFile,
  serializeMarker
} from "./registry-file.js";

/**
 * Reads and validates one thread state file (or the legacy sessions.json). An
 * unreadable or invalid file is reported as invalid and is never rewritten by a
 * reader. The marker is written before the data file. Its presence without the
 * data file means the state was lost, which fails closed until a human recovers it.
 */
export const REGISTRY_FILE_NAME = "sessions.json";
export const REGISTRY_META_FILE_NAME = "sessions.meta.json";

export type RegistryView =
  | { status: "ready"; file: RegistryFile }
  | { status: "invalid"; reason: string };

export function emptyRegistryFile(): RegistryFile {
  return { version: 1, generation: 0, slots: {} };
}

export const REGISTRY_SPEC: MarkedSpec<RegistryFile> = {
  validate: isRegistryFile,
  lostReason: "registry_lost"
};

export async function readRegistryView(
  filePath: string
): Promise<RegistryView> {
  const view = await readMarked(filePath, REGISTRY_SPEC);
  if (view.status === "invalid") return view;
  return { status: "ready", file: view.file ?? emptyRegistryFile() };
}

export function registryMetaPath(filePath: string): string {
  return markerPathFor(filePath);
}

export async function registryMetaExists(filePath: string): Promise<boolean> {
  const content = await readOptionalFile(registryMetaPath(filePath));
  return content !== undefined;
}

export function serializeRegistryMeta(initializedAt: string): string {
  return serializeMarker(initializedAt);
}

export function serializeRegistry(file: RegistryFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function isRegistryFile(value: unknown): value is RegistryFile {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    isCount(value.generation) &&
    isSlotRecord(value.slots) &&
    isThreadExtras(value)
  );
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
    (value.origin === "open" ||
      value.origin === "adopted" ||
      value.origin === "supervisor") &&
    isCount(value.generation) &&
    isOwner(value.owner) &&
    isText(value.boundAt) &&
    isOptionalText(value.observedAt) &&
    isOptionalText(value.endedAt) &&
    isConflicts(value.conflicts) &&
    isOptionalCost(value.lastCostUsd)
  );
}

function isOptionalCost(value: unknown): boolean {
  if (value === undefined) return true;
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
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
