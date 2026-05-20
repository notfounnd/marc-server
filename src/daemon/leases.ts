import http from "node:http";
import type { DaemonConfig, DaemonLease } from "../core/types.js";
import { json, readBody } from "./http.js";
import type { UiEventBus } from "./events.js";

type LeasePayload = {
  agentId?: unknown;
  workspaceId?: unknown;
  clientType?: unknown;
  ttlMs?: unknown;
};

type LeaseRequestInput = {
  request: http.IncomingMessage;
  response: http.ServerResponse;
  url: URL;
  leases: Map<string, DaemonLease>;
  trackExternalActivity: () => void;
};

type AutoIdleInput = {
  config: DaemonConfig;
  server: http.Server;
  events: UiEventBus;
  leases: Map<string, DaemonLease>;
  syncRuntimeState: () => Promise<void>;
  getLastExternalActivityAt: () => string;
};

export async function handleLeaseRequest(
  input: LeaseRequestInput
): Promise<boolean> {
  const leaseMatch = /^\/api\/leases\/([^/]+)$/.exec(input.url.pathname);
  if (!leaseMatch) return false;

  if (input.request.method === "PUT") {
    const body = (await readBody(input.request)) as LeasePayload;
    const clientId = decodeURIComponent(leaseMatch[1]);
    const lease = upsertLease(input.leases, clientId, body);
    input.trackExternalActivity();
    json(input.response, 200, { lease });
    return true;
  }

  if (input.request.method === "DELETE") {
    input.leases.delete(decodeURIComponent(leaseMatch[1]));
    input.trackExternalActivity();
    json(input.response, 200, { deleted: true });
    return true;
  }

  return false;
}

export function pruneExpiredLeases(leases: Map<string, DaemonLease>): void {
  const now = Date.now();
  for (const [clientId, lease] of leases) {
    if (Date.parse(lease.expiresAt) > now) continue;
    leases.delete(clientId);
  }
}

export function installAutoIdleShutdown(input: AutoIdleInput): void {
  if (input.config.mode !== "detached") return;
  if (input.config.autoIdleMs <= 0) return;

  const idleTimer = setInterval(
    () => {
      pruneExpiredLeases(input.leases);
      void input.syncRuntimeState();
      const idleForMs =
        Date.now() - Date.parse(input.getLastExternalActivityAt());
      if (idleForMs < input.config.autoIdleMs) return;
      if (input.leases.size > 0) return;
      if (input.events.clientCount() > 0) return;
      input.server.close();
    },
    Math.min(input.config.autoIdleMs, 30_000)
  );

  input.server.on("close", () => clearInterval(idleTimer));
}

function upsertLease(
  leases: Map<string, DaemonLease>,
  clientId: string,
  body: LeasePayload
): DaemonLease {
  const previous = leases.get(clientId);
  const now = new Date();
  const ttlMs =
    typeof body.ttlMs === "number" && Number.isFinite(body.ttlMs)
      ? body.ttlMs
      : 45_000;
  const lease: DaemonLease = {
    clientId,
    agentId:
      typeof body.agentId === "string" ? body.agentId : previous?.agentId,
    workspaceId:
      typeof body.workspaceId === "string"
        ? body.workspaceId
        : previous?.workspaceId,
    clientType:
      body.clientType === "mcp" || body.clientType === "ui"
        ? body.clientType
        : "unknown",
    startedAt: previous?.startedAt ?? now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString()
  };
  leases.set(clientId, lease);
  return lease;
}
