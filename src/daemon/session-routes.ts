import type http from "node:http";
import type { AgentsSource, SlotKey } from "../core/session-slots.js";
import type { AgentProfileSummary, WorkspaceInfo } from "../core/types.js";
import { listAgentProfiles } from "../core/workspace.js";
import { json, readBody, text } from "./http.js";
import type { ObservedIdentity } from "./presence.js";
import type {
  AcquireResult,
  HeartbeatInput,
  OwnerCall,
  OwnerResult
} from "./session-registry.js";
import {
  buildThreadSessionsView,
  probeFor,
  type SessionServices
} from "./session-views.js";
import type { DaemonStore } from "./store.js";

export type { SessionServices } from "./session-views.js";

export type SessionRouteContext = {
  request: http.IncomingMessage;
  response: http.ServerResponse;
  store: DaemonStore;
  sessions: SessionServices;
};

type RouteMatch = RegExpExecArray;

type ObservePayload = {
  workspaceId: string;
  threadId: string;
  agentId: string;
  observedAt: string;
  identity: ObservedIdentity;
};

type AcquirePayload = {
  workspaceId: string;
  threadId: string;
  profile: string;
  expectedGeneration: number;
};

type CallPayload = OwnerCall;

/** Registered in the daemon route table; method and pattern are checked before each handler. */
export const SESSION_ROUTES: Array<{
  method: string;
  pattern: RegExp;
  handle: (context: SessionRouteContext, match: RouteMatch) => Promise<void>;
}> = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/threads\/([^/]+)\/sessions$/,
    handle: getThreadSessions
  },
  {
    method: "POST",
    pattern: /^\/api\/sessions\/observe$/,
    handle: postSessionObserve
  },
  {
    method: "POST",
    pattern: /^\/api\/sessions\/acquire$/,
    handle: postSessionAcquire
  },
  {
    method: "POST",
    pattern: /^\/api\/sessions\/heartbeat$/,
    handle: postSessionHeartbeat
  },
  {
    method: "POST",
    pattern: /^\/api\/sessions\/release$/,
    handle: postSessionRelease
  }
];

/** Route: GET /api/workspaces/:id/threads/:threadId/sessions */
export async function getThreadSessions(
  context: SessionRouteContext,
  match: RouteMatch
): Promise<void> {
  const workspace = await workspaceFor(context, decodeURIComponent(match[1]));
  if (!workspace) return;
  const view = await buildThreadSessionsView(
    context.sessions,
    workspace,
    decodeURIComponent(match[2])
  );
  json(context.response, 200, view);
}

/** Route: POST /api/sessions/observe. Adoption is best effort; the next message_post resends. */
export async function postSessionObserve(
  context: SessionRouteContext
): Promise<void> {
  const payload = parseObservePayload(await readBody(context.request));
  if (!payload) return badRequest(context, "Invalid observe payload");
  const workspace = await workspaceFor(context, payload.workspaceId);
  if (!workspace) return;

  const profiles = await listAgentProfiles(workspace.rootPath);
  const role = profiles.find((profile) => profile.id === payload.agentId)?.role;
  const identity = await context.sessions.presence.resolveIdentity(
    payload.identity
  );
  const result = await context.sessions.registry.observe(
    {
      slot: slotOf(workspace, payload.threadId, payload.agentId),
      role,
      observedAt: payload.observedAt,
      identity
    },
    probeFor(context.sessions, workspace)
  );
  json(context.response, 200, result);
}

/** Route: POST /api/sessions/acquire. The owner token is returned only to the acquirer. */
export async function postSessionAcquire(
  context: SessionRouteContext
): Promise<void> {
  const payload = parseAcquirePayload(await readBody(context.request));
  if (!payload) return badRequest(context, "Invalid acquire payload");
  const workspace = await workspaceFor(context, payload.workspaceId);
  if (!workspace) return;

  const profiles = await listAgentProfiles(workspace.rootPath);
  const profileRefusal = acquireProfileRefusal(profiles, payload.profile);
  if (profileRefusal) {
    return json(context.response, 409, {
      decision: "refused",
      reason: profileRefusal
    });
  }
  const result: AcquireResult = await context.sessions.registry.acquire(
    {
      slot: slotOf(workspace, payload.threadId, payload.profile),
      expectedGeneration: payload.expectedGeneration,
      hostId: context.sessions.presence.hostId
    },
    probeFor(context.sessions, workspace)
  );
  respond(context, result);
}

/** Route: POST /api/sessions/heartbeat. Divergent token or generation is 409 and changes nothing. */
export async function postSessionHeartbeat(
  context: SessionRouteContext
): Promise<void> {
  const input = parseHeartbeatPayload(await readBody(context.request));
  if (!input) return badRequest(context, "Invalid heartbeat payload");
  const claimed = await withClientStartedAt(context.sessions, input);
  const result: OwnerResult =
    await context.sessions.registry.heartbeat(claimed);
  respond(context, result);
}

/**
 * A heartbeat that names only the pid gets the process start time from the agents source, so
 * the owner can read as online without an MCP observe. An unknown pid leaves the input as it is.
 */
async function withClientStartedAt(
  services: SessionServices,
  input: HeartbeatInput
): Promise<HeartbeatInput> {
  if (input.clientPid === undefined || input.clientStartedAt !== undefined) {
    return input;
  }
  const startedAt = listedStartedAt(
    await services.presence.agents(),
    input.clientPid
  );
  if (startedAt === undefined) return input;
  return { ...input, clientStartedAt: startedAt };
}

function listedStartedAt(
  agents: AgentsSource,
  pid: number
): number | undefined {
  if (agents.status !== "available") return undefined;
  return agents.processes.find((process) => process.pid === pid)?.startedAt;
}

/** Route: POST /api/sessions/release. Ends the owner; the binding stays for resume. */
export async function postSessionRelease(
  context: SessionRouteContext
): Promise<void> {
  const call = parseCallPayload(await readBody(context.request));
  if (!call) return badRequest(context, "Invalid release payload");
  const result: OwnerResult = await context.sessions.registry.release(call);
  respond(context, result);
}

function acquireProfileRefusal(
  profiles: AgentProfileSummary[],
  profileId: string
): string | undefined {
  const profile = profiles.find((candidate) => candidate.id === profileId);
  if (!profile) return "profile_unknown";
  if (profile.role === "user") return "user_profile";
  return undefined;
}

function slotOf(
  workspace: WorkspaceInfo,
  threadId: string,
  profile: string
): SlotKey {
  return { workspaceId: workspace.id, threadId, profile };
}

/** Refusals are 409, so a caller can tell a refused owner call from a success. */
function respond(
  context: SessionRouteContext,
  result: { decision: string }
): void {
  const status = result.decision === "refused" ? 409 : 200;
  json(context.response, status, result);
}

async function workspaceFor(
  context: SessionRouteContext,
  workspaceId: string
): Promise<WorkspaceInfo | undefined> {
  const workspace = await context.store.getWorkspace(workspaceId);
  if (workspace) return workspace;
  text(context.response, 404, "Workspace not found");
  return undefined;
}

function badRequest(context: SessionRouteContext, message: string): void {
  text(context.response, 400, message);
}

function parseObservePayload(body: unknown): ObservePayload | undefined {
  if (!isRecord(body)) return undefined;
  const identity = parseIdentity(body.identity);
  if (!identity || !isText(body.observedAt)) return undefined;
  if (Number.isNaN(Date.parse(body.observedAt))) return undefined;
  if (!isText(body.workspaceId) || !isText(body.threadId)) return undefined;
  if (!isText(body.agentId)) return undefined;
  return {
    workspaceId: body.workspaceId,
    threadId: body.threadId,
    agentId: body.agentId,
    observedAt: body.observedAt,
    identity
  };
}

function parseIdentity(value: unknown): ObservedIdentity | undefined {
  if (!isRecord(value)) return undefined;
  if (!isText(value.nativeSessionId) || !isText(value.hostId)) return undefined;
  if (!isInteger(value.pid) || !isInteger(value.ppid)) return undefined;
  return {
    nativeSessionId: value.nativeSessionId,
    pid: value.pid,
    ppid: value.ppid,
    hostId: value.hostId
  };
}

function parseAcquirePayload(body: unknown): AcquirePayload | undefined {
  if (!isRecord(body)) return undefined;
  if (!isText(body.workspaceId) || !isText(body.threadId)) return undefined;
  if (!isText(body.profile) || !isInteger(body.expectedGeneration)) {
    return undefined;
  }
  return {
    workspaceId: body.workspaceId,
    threadId: body.threadId,
    profile: body.profile,
    expectedGeneration: body.expectedGeneration
  };
}

function parseCallPayload(body: unknown): CallPayload | undefined {
  if (!isRecord(body)) return undefined;
  if (!isText(body.workspaceId) || !isText(body.threadId)) return undefined;
  if (!isText(body.profile) || !isText(body.ownerToken)) return undefined;
  if (!isInteger(body.generation)) return undefined;
  return {
    slot: {
      workspaceId: body.workspaceId,
      threadId: body.threadId,
      profile: body.profile
    },
    generation: body.generation,
    ownerToken: body.ownerToken
  };
}

/** Heartbeat may claim the owner's pid and startedAt; the registry refuses a disagreement. */
function parseHeartbeatPayload(body: unknown): HeartbeatInput | undefined {
  const call = parseCallPayload(body);
  if (!call || !isRecord(body)) return undefined;
  if (!isOptionalInteger(body.clientPid)) return undefined;
  if (!isOptionalNumber(body.clientStartedAt)) return undefined;
  return {
    ...call,
    clientPid: body.clientPid as number | undefined,
    clientStartedAt: body.clientStartedAt as number | undefined
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function isOptionalInteger(value: unknown): boolean {
  return value === undefined || Number.isInteger(value);
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === "number";
}
