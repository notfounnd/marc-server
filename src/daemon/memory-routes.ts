import type http from "node:http";
import { recallMemory } from "../core/workspace.js";
import { json, readBody, text } from "./http.js";
import type { DaemonStore } from "./store.js";

type MemoryRouteContext = {
  request: http.IncomingMessage;
  response: http.ServerResponse;
  store: DaemonStore;
};

type MemoryRecallBody = Partial<{
  limit: number;
  minScore: number;
  query: string;
}>;

export async function postWorkspaceMemoryRecall(
  context: MemoryRouteContext,
  workspaceId: string
): Promise<void> {
  const workspace = await context.store.getWorkspace(
    decodeURIComponent(workspaceId)
  );
  if (!workspace) {
    text(context.response, 404, "Workspace not found");
    return;
  }

  const input = memoryRecallInput(await readBody(context.request));
  if (!input) {
    text(context.response, 400, "Search query is required");
    return;
  }

  json(context.response, 200, await recallMemory(workspace.rootPath, input));
}

function memoryRecallInput(
  body: unknown
): { limit?: number; minScore?: number; query: string } | undefined {
  if (!isRecord(body)) return undefined;
  if (typeof body.query !== "string") return undefined;
  const query = body.query.trim();
  if (!query) return undefined;
  return {
    limit: optionalFiniteNumber(body.limit),
    minScore: optionalFiniteNumber(body.minScore),
    query
  };
}

function optionalFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function isRecord(value: unknown): value is MemoryRecallBody {
  return typeof value === "object" && value !== null;
}
