import { randomUUID } from "node:crypto";
import { getWorkspaceInfo } from "../core/workspace.js";
import type { WorkspaceInfo } from "../core/types.js";
import type { IdentityFields, SessionIdentity } from "./session-identity.js";
import type { McpOptions } from "./types.js";

type DaemonConnection = {
  daemonUrl: string;
  token: string;
};

export async function notifyDaemon(
  workspace: WorkspaceInfo,
  options: McpOptions
): Promise<void> {
  const connection = daemonConnection(options);
  if (!connection) return;

  const response = await fetch(
    new URL("/api/workspaces", connection.daemonUrl),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${connection.token}`
      },
      body: JSON.stringify(workspace)
    }
  );

  if (response.ok) return;
  throw new Error(`Daemon registration failed: ${response.status}`);
}

export async function unregisterFromDaemon(
  workspace: WorkspaceInfo,
  options: McpOptions
): Promise<void> {
  const connection = requiredDaemonConnection(options);
  const response = await fetch(
    new URL(
      `/api/workspaces/${encodeURIComponent(workspace.id)}`,
      connection.daemonUrl
    ),
    {
      method: "DELETE",
      headers: { authorization: `Bearer ${connection.token}` },
      signal: AbortSignal.timeout(5_000)
    }
  );

  if (response.ok) return;
  if (response.status === 404) return;
  throw new Error(`Daemon unregister failed: ${response.status}`);
}

export async function startDaemonLeaseHeartbeat(
  options: McpOptions,
  identity: SessionIdentity
): Promise<() => Promise<void>> {
  const connection = daemonConnection(options);
  if (!connection) return async () => undefined;

  const workspace = await getWorkspaceInfo(options.workspace ?? process.cwd());
  const clientId = `mcp-${process.pid}-${randomUUID()}`;
  const pending = new Set<Promise<void>>();
  const renew = () => {
    const operation = renewDaemonLease(
      connection,
      clientId,
      workspace,
      identity.fields()
    ).catch(() => undefined);
    pending.add(operation);
    void operation.finally(() => pending.delete(operation));
  };
  renew();
  const timer = setInterval(renew, 15_000);
  timer.unref();
  const unsubscribe = identity.onIdentified(renew);
  let cleanup: Promise<void> | undefined;
  return () => {
    if (cleanup) return cleanup;
    clearInterval(timer);
    unsubscribe();
    cleanup = (async () => {
      await Promise.all([...pending]);
      try {
        await fetch(
          new URL(
            `/api/leases/${encodeURIComponent(clientId)}`,
            connection.daemonUrl
          ),
          {
            method: "DELETE",
            headers: { authorization: `Bearer ${connection.token}` },
            signal: AbortSignal.timeout(5_000)
          }
        );
      } catch {
        // Lease expiration is the fallback if the daemon is unavailable.
      }
    })();
    return cleanup;
  };
}

function daemonConnection(options: McpOptions): DaemonConnection | undefined {
  const daemonUrl = options.daemonUrl ?? process.env.MARC_DAEMON_URL;
  const token = options.token ?? process.env.MARC_TOKEN;
  return daemonUrl && token ? { daemonUrl, token } : undefined;
}

function requiredDaemonConnection(options: McpOptions): DaemonConnection {
  const connection = daemonConnection(options);
  if (connection) return connection;
  throw new Error("Cannot unregister workspace without daemonUrl and token.");
}

/**
 * Reports one thread activity to the daemon, which adopts or flags the session
 * slot. The caller must not await it: the tool result never depends on it.
 */
export async function observeSessionActivity(
  options: McpOptions,
  identity: SessionIdentity,
  activity: { workspaceRoot: string; threadId: string; agentId: string }
): Promise<void> {
  const connection = daemonConnection(options);
  const nativeSessionId = identity.nativeSessionId;
  if (!connection || nativeSessionId === undefined) return;

  const observedAt = new Date().toISOString();
  const workspace = await getWorkspaceInfo(activity.workspaceRoot);
  await fetch(new URL("/api/sessions/observe", connection.daemonUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${connection.token}`
    },
    signal: AbortSignal.timeout(5_000),
    body: JSON.stringify({
      workspaceId: workspace.id,
      threadId: activity.threadId,
      agentId: activity.agentId,
      observedAt,
      identity: {
        nativeSessionId,
        pid: identity.pid,
        ppid: identity.ppid,
        hostId: identity.hostId
      }
    })
  });
}

async function renewDaemonLease(
  connection: DaemonConnection,
  clientId: string,
  workspace: WorkspaceInfo,
  identity: IdentityFields
): Promise<void> {
  await fetch(
    new URL(
      `/api/leases/${encodeURIComponent(clientId)}`,
      connection.daemonUrl
    ),
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${connection.token}`
      },
      signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({
        workspaceId: workspace.id,
        clientType: "mcp",
        ttlMs: 45_000,
        ...identity
      })
    }
  );
}
