import http from "node:http";
import { watch, type FSWatcher } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import { DaemonStore } from "./store.js";
import { renderUi } from "./ui.js";
import {
  appendMessage,
  attachArtifactToMessage,
  listAgentProfiles,
  listThreads,
  readMessageArtifact,
  readRules,
  readThread,
  registerAgent,
} from "../core/workspace.js";
import type { DaemonConfig, ThreadListStatus, WorkspaceInfo } from "../core/types.js";

function json(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

function text(response: http.ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function publicDirCandidates(): string[] {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(moduleDir, "..", "public"),
  ];
}

async function serveStatic(url: URL, response: http.ServerResponse): Promise<boolean> {
  const requestPath = decodeURIComponent(url.pathname);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");

  for (const publicDir of publicDirCandidates()) {
    const candidate = path.resolve(publicDir, relativePath);
    const relative = path.relative(publicDir, candidate);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      continue;
    }

    if (await pathExists(candidate)) {
      response.writeHead(200, { "content-type": contentType(candidate) });
      response.end(await fs.readFile(candidate));
      return true;
    }

    const indexPath = path.join(publicDir, "index.html");
    if (!requestPath.startsWith("/api/") && await pathExists(indexPath)) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(await fs.readFile(indexPath));
      return true;
    }
  }

  return false;
}

async function readBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function authorized(request: http.IncomingMessage, url: URL, token: string): boolean {
  const auth = request.headers.authorization;
  return auth === `Bearer ${token}` || request.headers["x-marc-token"] === token || url.searchParams.get("token") === token;
}

function isWorkspaceInfo(value: unknown): value is WorkspaceInfo {
  const candidate = value as Partial<WorkspaceInfo>;
  return Boolean(candidate?.id && candidate.name && candidate.rootPath && candidate.marcPath);
}

function threadListStatus(value: string | null): ThreadListStatus {
  return value === "closed" || value === "all" ? value : "open";
}

function isIgnorableWorkspaceChange(filename: string | Buffer | null): boolean {
  if (!filename) return false;
  const normalized = filename.toString().replaceAll("\\", "/");
  return normalized === "cache" || normalized.startsWith("cache/");
}

class UiEventBus {
  private readonly clients = new Set<http.ServerResponse>();
  private readonly watchers = new Map<string, FSWatcher>();
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
  private keepAlive?: NodeJS.Timeout;

  connect(response: http.ServerResponse): void {
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    });
    response.write(": connected\n\n");
    this.clients.add(response);
    this.keepAlive ??= setInterval(() => this.send("ping", { at: new Date().toISOString() }), 25000);

    response.on("close", () => {
      this.clients.delete(response);
      if (!this.clients.size && this.keepAlive) {
        clearInterval(this.keepAlive);
        this.keepAlive = undefined;
      }
    });
  }

  send(event: string, payload: unknown): void {
    const body = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) {
      client.write(body);
    }
  }

  async watchWorkspace(workspace: WorkspaceInfo): Promise<void> {
    this.watchers.get(workspace.id)?.close();

    if (!(await pathExists(workspace.marcPath))) {
      return;
    }

    try {
      const watcher = watch(workspace.marcPath, { recursive: true }, (_eventType, filename) => {
        if (isIgnorableWorkspaceChange(filename)) return;

        const current = this.debounceTimers.get(workspace.id);
        if (current) clearTimeout(current);
        this.debounceTimers.set(
          workspace.id,
          setTimeout(() => {
            this.send("workspace-changed", {
              workspaceId: workspace.id,
              at: new Date().toISOString(),
            });
          }, 300),
        );
      });
      this.watchers.set(workspace.id, watcher);
    } catch {
      // File watching is best-effort. The UI still has a slow fallback refresh.
    }
  }

  unwatchWorkspace(workspaceId: string): void {
    this.watchers.get(workspaceId)?.close();
    this.watchers.delete(workspaceId);
    const timer = this.debounceTimers.get(workspaceId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(workspaceId);
    }
  }

  close(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    if (this.keepAlive) {
      clearInterval(this.keepAlive);
    }
    this.clients.clear();
    this.watchers.clear();
    this.debounceTimers.clear();
  }
}

export async function createDaemonServer(config: DaemonConfig): Promise<http.Server> {
  const store = await DaemonStore.open(config.dataDir);
  const events = new UiEventBus();
  for (const workspace of await store.listWorkspaces()) {
    await events.watchWorkspace(workspace);
  }

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "GET" && !url.pathname.startsWith("/api/")) {
        if (await serveStatic(url, response)) {
          return;
        }
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(renderUi());
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
        json(response, 200, { ok: true, sqlite: store.sqliteAvailable() });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/workspaces") {
        json(response, 200, await store.listWorkspaces());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/workspaces") {
        const body = await readBody(request);
        if (!isWorkspaceInfo(body)) {
          text(response, 400, "Invalid workspace payload");
          return;
        }
        const workspace = await store.upsertWorkspace(body);
        await events.watchWorkspace(workspace);
        events.send("workspace-registered", { workspaceId: workspace.id, at: new Date().toISOString() });
        json(response, 200, workspace);
        return;
      }

      const workspaceRootMatch = /^\/api\/workspaces\/([^/]+)$/.exec(url.pathname);
      if (request.method === "DELETE" && workspaceRootMatch) {
        const workspaceId = decodeURIComponent(workspaceRootMatch[1]);
        const workspace = await store.removeWorkspace(workspaceId);
        if (!workspace) {
          text(response, 404, "Workspace not found");
          return;
        }
        events.unwatchWorkspace(workspaceId);
        events.send("workspace-unregistered", { workspaceId, at: new Date().toISOString() });
        json(response, 200, { removed: workspace });
        return;
      }

      const threadListMatch = /^\/api\/workspaces\/([^/]+)\/threads$/.exec(url.pathname);
      if (request.method === "GET" && threadListMatch) {
        const workspace = await store.getWorkspace(decodeURIComponent(threadListMatch[1]));
        if (!workspace) {
          text(response, 404, "Workspace not found");
          return;
        }
        json(response, 200, await listThreads(workspace.rootPath, { status: threadListStatus(url.searchParams.get("status")) }));
        return;
      }

      const rulesMatch = /^\/api\/workspaces\/([^/]+)\/rules$/.exec(url.pathname);
      if (request.method === "GET" && rulesMatch) {
        const workspace = await store.getWorkspace(decodeURIComponent(rulesMatch[1]));
        if (!workspace) {
          text(response, 404, "Workspace not found");
          return;
        }
        json(response, 200, { markdown: await readRules(workspace.rootPath) });
        return;
      }

      const agentsMatch = /^\/api\/workspaces\/([^/]+)\/agents$/.exec(url.pathname);
      if (request.method === "GET" && agentsMatch) {
        const workspace = await store.getWorkspace(decodeURIComponent(agentsMatch[1]));
        if (!workspace) {
          text(response, 404, "Workspace not found");
          return;
        }
        json(response, 200, await listAgentProfiles(workspace.rootPath, { includeMarkdown: true }));
        return;
      }

      const threadMatch = /^\/api\/workspaces\/([^/]+)\/threads\/([^/]+)$/.exec(url.pathname);
      if (request.method === "GET" && threadMatch) {
        const workspace = await store.getWorkspace(decodeURIComponent(threadMatch[1]));
        if (!workspace) {
          text(response, 404, "Workspace not found");
          return;
        }
        json(response, 200, await readThread(workspace.rootPath, decodeURIComponent(threadMatch[2])));
        return;
      }

      if (request.method === "POST" && threadMatch) {
        const workspace = await store.getWorkspace(decodeURIComponent(threadMatch[1]));
        if (!workspace) {
          text(response, 404, "Workspace not found");
          return;
        }

        const body = await readBody(request) as Partial<{ agentId: string; displayName: string; role: string; message: string }>;
        if (!body.agentId || !body.message) {
          text(response, 400, "agentId and message are required");
          return;
        }

        await registerAgent(workspace.rootPath, {
          id: body.agentId,
          role: body.role ?? "user",
          model: "human",
          description: "Posted from the mARC web UI.",
        });

        const message = await appendMessage(workspace.rootPath, decodeURIComponent(threadMatch[2]), {
          agentId: body.agentId,
          role: body.role ?? "user",
          body: body.message,
        });
        events.send("workspace-changed", {
          workspaceId: workspace.id,
          threadId: decodeURIComponent(threadMatch[2]),
          at: new Date().toISOString(),
        });
        json(response, 200, message);
        return;
      }

      const readMessageArtifactMatch = /^\/api\/workspaces\/([^/]+)\/threads\/([^/]+)\/messages\/([^/]+)\/artifacts\/([^/]+)$/.exec(url.pathname);
      if (request.method === "GET" && readMessageArtifactMatch) {
        const workspace = await store.getWorkspace(decodeURIComponent(readMessageArtifactMatch[1]));
        if (!workspace) {
          text(response, 404, "Workspace not found");
          return;
        }

        json(
          response,
          200,
          await readMessageArtifact(
            workspace.rootPath,
            decodeURIComponent(readMessageArtifactMatch[2]),
            decodeURIComponent(readMessageArtifactMatch[3]),
            decodeURIComponent(readMessageArtifactMatch[4]),
          ),
        );
        return;
      }

      const messageArtifactMatch = /^\/api\/workspaces\/([^/]+)\/threads\/([^/]+)\/messages\/([^/]+)\/artifacts$/.exec(url.pathname);
      if (request.method === "POST" && messageArtifactMatch) {
        const workspace = await store.getWorkspace(decodeURIComponent(messageArtifactMatch[1]));
        if (!workspace) {
          text(response, 404, "Workspace not found");
          return;
        }

        const threadId = decodeURIComponent(messageArtifactMatch[2]);
        const messageId = decodeURIComponent(messageArtifactMatch[3]);
        const body = await readBody(request) as Partial<{ fileName: string; content: string }>;
        if (!body.fileName || !body.content) {
          text(response, 400, "fileName and content are required");
          return;
        }

        const thread = await readThread(workspace.rootPath, threadId);
        const message = thread.messages?.find((item) => item.id === messageId);
        if (!message) {
          text(response, 404, "Message not found");
          return;
        }
        if (message.role !== "user") {
          text(response, 403, "Artifacts can only be attached to UI user messages");
          return;
        }

        const artifact = await attachArtifactToMessage(workspace.rootPath, threadId, messageId, body.fileName, body.content);
        events.send("workspace-changed", {
          workspaceId: workspace.id,
          threadId,
          at: new Date().toISOString(),
        });
        json(response, 200, { artifact });
        return;
      }

      text(response, 404, "Not found");
    } catch (error) {
      text(response, 500, error instanceof Error ? error.message : String(error));
    }
  });

  server.on("close", () => events.close());
  return server;
}

export async function runDaemon(config: DaemonConfig): Promise<http.Server> {
  const server = await createDaemonServer(config);
  await new Promise<void>((resolve) => server.listen(config.port, config.host, resolve));
  console.log(`mARC daemon listening on http://${config.host}:${config.port}`);
  console.log(`Token: ${config.token}`);
  return server;
}
