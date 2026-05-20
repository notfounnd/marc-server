import { readWorkspaceStatus } from "../core/workspace.js";
import type {
  DaemonConfig,
  DaemonLease,
  WorkspaceInfo
} from "../core/types.js";
import { DaemonStore } from "./store.js";
import { UiEventBus } from "./events.js";

type DaemonStatusInput = {
  config: DaemonConfig;
  store: DaemonStore;
  events: UiEventBus;
  leases: Map<string, DaemonLease>;
  startedAt: string;
  lastExternalActivityAt: string;
};

export async function daemonStatus(input: DaemonStatusInput): Promise<unknown> {
  const workspaces = await input.store.listWorkspaces();
  const workspaceStatuses = await Promise.all(
    workspaces.map(readWorkspaceThreadIndexStatus)
  );
  const degraded = workspaceStatuses.some(
    ([, status]) =>
      status.status === "degraded" || status.status === "unavailable"
  );
  const now = Date.now();
  const idleForMs = Math.max(0, now - Date.parse(input.lastExternalActivityAt));

  return {
    ok: !degraded,
    sqlite: input.store.sqliteAvailable(),
    modules: {
      daemon: {
        status: "ready",
        pid: process.pid,
        mode: input.config.mode,
        uptimeMs: Math.max(0, now - Date.parse(input.startedAt)),
        url: `http://${input.config.host}:${input.config.port}`,
        dataDir: input.config.dataDir,
        tokenPath: input.config.tokenPath,
        fingerprint: input.config.fingerprint,
        autoIdleMs: input.config.autoIdleMs,
        idleForMs,
        activeUiClients: input.events.clientCount(),
        leases: Array.from(input.leases.values())
      },
      workspaceRegistry: { status: "ready", workspaceCount: workspaces.length },
      threadIndex: {
        status: degraded ? "degraded" : "ready",
        workspaces: Object.fromEntries(workspaceStatuses)
      }
    }
  };
}

async function readWorkspaceThreadIndexStatus(workspace: WorkspaceInfo) {
  const status = await readWorkspaceStatus(workspace.rootPath);
  return [workspace.id, status.modules.threadIndex] as const;
}
