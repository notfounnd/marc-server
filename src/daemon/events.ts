import http from "node:http";
import { watch, type FSWatcher } from "node:fs";
import { rebuildThreadIndexInBackground } from "../core/workspace.js";
import type { WorkspaceInfo } from "../core/types.js";
import { isIgnorableWorkspaceChange, pathExists } from "./http.js";

const THREAD_INDEX_REVALIDATE_INTERVAL_MS = 30000;

export class UiEventBus {
  private readonly clients = new Set<http.ServerResponse>();
  private readonly watchers = new Map<string, FSWatcher>();
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
  private readonly revalidateTimers = new Map<string, NodeJS.Timeout>();
  private readonly lastRevalidateAt = new Map<string, number>();
  private keepAlive?: NodeJS.Timeout;

  constructor(private readonly onClientCountChange?: () => void) {}

  clientCount(): number {
    return this.clients.size;
  }

  connect(response: http.ServerResponse): void {
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    });
    response.write(": connected\n\n");
    this.clients.add(response);
    this.onClientCountChange?.();
    this.keepAlive ??= setInterval(
      () => this.send("ping", { at: new Date().toISOString() }),
      25000
    );

    response.on("close", () => {
      this.clients.delete(response);
      if (!this.clients.size && this.keepAlive) {
        clearInterval(this.keepAlive);
        this.keepAlive = undefined;
      }
      this.onClientCountChange?.();
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
    if (!(await pathExists(workspace.marcPath))) return;

    try {
      const watcher = watch(
        workspace.marcPath,
        { recursive: true },
        (_eventType, filename) => {
          if (isIgnorableWorkspaceChange(filename)) return;

          const current = this.debounceTimers.get(workspace.id);
          if (current) clearTimeout(current);
          this.debounceTimers.set(
            workspace.id,
            setTimeout(() => {
              this.debounceTimers.delete(workspace.id);
              this.scheduleThreadIndexRebuild(workspace);
            }, 300)
          );
        }
      );
      this.watchers.set(workspace.id, watcher);
    } catch {
      // File watching is best-effort. The UI still has a slow fallback refresh.
    }
  }

  scheduleThreadIndexRebuild(workspace: WorkspaceInfo, delayMs = 0): void {
    const current = this.revalidateTimers.get(workspace.id);
    if (current) clearTimeout(current);
    this.revalidateTimers.set(
      workspace.id,
      setTimeout(() => {
        this.lastRevalidateAt.set(workspace.id, Date.now());
        void rebuildThreadIndexInBackground(workspace.rootPath)
          .catch(() => undefined)
          .finally(() => {
            this.revalidateTimers.delete(workspace.id);
            this.send("workspace-changed", {
              workspaceId: workspace.id,
              at: new Date().toISOString()
            });
          });
      }, delayMs)
    );
  }

  scheduleFallbackRebuild(workspace: WorkspaceInfo): void {
    const lastAt = this.lastRevalidateAt.get(workspace.id) ?? 0;
    if (
      Date.now() - lastAt < THREAD_INDEX_REVALIDATE_INTERVAL_MS ||
      this.revalidateTimers.has(workspace.id)
    )
      return;
    this.scheduleThreadIndexRebuild(workspace, 0);
  }

  unwatchWorkspace(workspaceId: string): void {
    this.watchers.get(workspaceId)?.close();
    this.watchers.delete(workspaceId);
    const timer = this.debounceTimers.get(workspaceId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(workspaceId);
    }
    const revalidateTimer = this.revalidateTimers.get(workspaceId);
    if (revalidateTimer) {
      clearTimeout(revalidateTimer);
      this.revalidateTimers.delete(workspaceId);
    }
    this.lastRevalidateAt.delete(workspaceId);
  }

  close(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.revalidateTimers.values()) {
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
    this.revalidateTimers.clear();
    this.lastRevalidateAt.clear();
  }
}
