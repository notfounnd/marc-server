import type http from "node:http";
import {
  prepareMemoryInBackground,
  readWorkspaceSettings,
  rebuildMemoryInBackground,
  recallMemory,
  updateWorkspaceSettings
} from "../core/workspace-memory.js";
import { readWorkspaceStatus } from "../core/workspace.js";
import type { WorkspaceInfo, WorkspaceSettingsInput } from "../core/types.js";
import { json, readBody, text } from "./http.js";
import type { DaemonStore } from "./store.js";

type MemoryRouteContext = {
  events: {
    send(event: string, payload: unknown): void;
  };
  request: http.IncomingMessage;
  response: http.ServerResponse;
  store: DaemonStore;
};

type MemoryRecallBody = Partial<{
  limit: number;
  minScore: number;
  query: string;
}>;

type WorkspaceSettingsBody = Partial<{
  memory: Partial<{
    autoRebuild: boolean;
  }>;
}>;

export async function postWorkspaceMemoryRecall(
  context: MemoryRouteContext,
  workspaceId: string
): Promise<void> {
  const workspace = await workspaceOr404(context, workspaceId);
  if (!workspace) return;

  const input = memoryRecallInput(await readBody(context.request));
  if (!input) {
    text(context.response, 400, "Search query is required");
    return;
  }

  json(context.response, 200, await recallMemory(workspace.rootPath, input));
}

export async function getWorkspaceSettings(
  context: MemoryRouteContext,
  workspaceId: string
): Promise<void> {
  const workspace = await workspaceOr404(context, workspaceId);
  if (!workspace) return;

  json(context.response, 200, await readWorkspaceSettings(workspace.rootPath));
}

export async function postWorkspaceSettings(
  context: MemoryRouteContext,
  workspaceId: string
): Promise<void> {
  const workspace = await workspaceOr404(context, workspaceId);
  if (!workspace) return;

  const input = workspaceSettingsInput(await readBody(context.request));
  if (!input) {
    text(context.response, 400, "Invalid workspace settings payload");
    return;
  }

  const settings = await updateWorkspaceSettings(workspace.rootPath, input);
  context.events.send("workspace-changed", {
    workspaceId: workspace.id,
    at: new Date().toISOString()
  });
  json(context.response, 200, settings);
}

export async function postWorkspaceMemoryPrepare(
  context: MemoryRouteContext,
  workspaceId: string
): Promise<void> {
  const workspace = await workspaceOr404(context, workspaceId);
  if (!workspace) return;

  const health = await prepareMemoryInBackground(workspace.rootPath);
  context.events.send("workspace-changed", {
    workspaceId: workspace.id,
    at: new Date().toISOString()
  });
  json(context.response, 202, health);
}

export async function postWorkspaceMemoryRebuild(
  context: MemoryRouteContext,
  workspaceId: string
): Promise<void> {
  const workspace = await workspaceOr404(context, workspaceId);
  if (!workspace) return;

  const status = await readWorkspaceStatus(workspace.rootPath);
  if (!status.modules.memory.modelPrepared) {
    text(context.response, 409, "Memory model is not prepared");
    return;
  }

  const health = await rebuildMemoryInBackground(workspace.rootPath);
  context.events.send("workspace-changed", {
    workspaceId: workspace.id,
    at: new Date().toISOString()
  });
  json(context.response, 202, health);
}

function memoryRecallInput(
  body: unknown
): { limit?: number; minScore?: number; query: string } | undefined {
  if (!isRecord(body)) return undefined;
  const input = body as MemoryRecallBody;
  if (typeof input.query !== "string") return undefined;
  const query = input.query.trim();
  if (!query) return undefined;
  return {
    limit: optionalFiniteNumber(input.limit),
    minScore: optionalFiniteNumber(input.minScore),
    query
  };
}

function optionalFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function workspaceOr404(
  context: MemoryRouteContext,
  workspaceId: string
): Promise<WorkspaceInfo | undefined> {
  const workspace = await context.store.getWorkspace(
    decodeURIComponent(workspaceId)
  );
  if (workspace) return workspace;
  text(context.response, 404, "Workspace not found");
  return undefined;
}

function workspaceSettingsInput(
  body: unknown
): WorkspaceSettingsInput | undefined {
  if (!isRecord(body)) return undefined;
  const input = body as WorkspaceSettingsBody;
  const memory = isRecord(input.memory) ? input.memory : undefined;
  const autoRebuild = memory?.autoRebuild;
  if (autoRebuild === undefined) return { memory: {} };
  if (typeof autoRebuild !== "boolean") return undefined;
  return { memory: { autoRebuild } };
}
