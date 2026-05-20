import http from "node:http";
import { URL } from "node:url";
import type { DaemonConfig, DaemonLease } from "../core/types.js";
import { UiEventBus } from "./events.js";
import { authorized, json, serveStatic, text } from "./http.js";
import {
  createRuntimeState,
  patchDaemonRuntimeState,
  removeDaemonRuntimeState,
  writeDaemonRuntimeState
} from "./lifecycle.js";
import {
  handleLeaseRequest,
  installAutoIdleShutdown,
  pruneExpiredLeases
} from "./leases.js";
import { handleDaemonRoute } from "./routes.js";
import { daemonStatus } from "./status.js";
import { DaemonStore } from "./store.js";
import { renderUi } from "./ui.js";

export async function createDaemonServer(
  config: DaemonConfig
): Promise<http.Server> {
  const store = await DaemonStore.open(config.dataDir);
  const leases = new Map<string, DaemonLease>();
  const startedAt = new Date().toISOString();
  let lastActivityAt = startedAt;
  let lastExternalActivityAt = startedAt;

  async function syncRuntimeState(): Promise<void> {
    if (config.mode !== "detached") return;
    await patchDaemonRuntimeState(config.dataDir, {
      lastActivityAt,
      activeUiClients: events.clientCount(),
      leases: Array.from(leases.values())
    });
  }

  function trackActivity(): void {
    lastActivityAt = new Date().toISOString();
    void syncRuntimeState();
  }

  function trackExternalActivity(): void {
    lastExternalActivityAt = new Date().toISOString();
    trackActivity();
  }

  const events = new UiEventBus(trackActivity);
  for (const workspace of await store.listWorkspaces()) {
    await events.watchWorkspace(workspace);
  }

  async function serveUi(
    url: URL,
    response: http.ServerResponse
  ): Promise<void> {
    const staticServed = await serveStatic(url, response);
    if (staticServed) return;
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderUi());
  }

  async function handleStatus(response: http.ServerResponse): Promise<void> {
    pruneExpiredLeases(leases);
    await syncRuntimeState();
    json(
      response,
      200,
      await daemonStatus({
        config,
        store,
        events,
        leases,
        startedAt,
        lastExternalActivityAt
      })
    );
  }

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(
        request.url ?? "/",
        `http://${request.headers.host ?? "localhost"}`
      );
      if (request.method !== "GET" || url.pathname !== "/api/status") {
        trackExternalActivity();
      }

      if (request.method === "GET" && !url.pathname.startsWith("/api/")) {
        await serveUi(url, response);
        return;
      }

      if (!url.pathname.startsWith("/api/")) {
        text(response, 404, "Not found");
        return;
      }

      if (!authorized(request, url, config.token)) {
        text(response, 401, "Unauthorized");
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/events") {
        events.connect(response);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/status") {
        await handleStatus(response);
        return;
      }

      if (
        await handleLeaseRequest({
          request,
          response,
          url,
          leases,
          trackExternalActivity
        })
      )
        return;

      if (request.method === "GET" && url.pathname === "/api/workspaces") {
        json(response, 200, await store.listWorkspaces());
        return;
      }

      const handled = await handleDaemonRoute({
        events,
        request,
        response,
        store,
        url
      });
      if (handled) return;

      text(response, 404, "Not found");
    } catch (error) {
      text(
        response,
        500,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  installAutoIdleShutdown({
    config,
    server,
    events,
    leases,
    syncRuntimeState,
    getLastExternalActivityAt: () => lastExternalActivityAt
  });

  server.on("close", () => {
    events.close();
  });
  return server;
}

export async function runDaemon(config: DaemonConfig): Promise<http.Server> {
  const server = await createDaemonServer(config);
  await new Promise<void>((resolve) =>
    server.listen(config.port, config.host, resolve)
  );
  if (config.mode === "detached") {
    await writeDaemonRuntimeState(await createRuntimeState(config));
    server.on("close", () => {
      void removeDaemonRuntimeState(config.dataDir);
    });
  }
  console.log(`mARC daemon listening on http://${config.host}:${config.port}`);
  console.log(`Token: ${config.token}`);
  return server;
}
