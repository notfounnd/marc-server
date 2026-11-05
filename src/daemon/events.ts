import http from "node:http";
import { watch, type FSWatcher } from "node:fs";
import { memoryRebuildActiveInWorkspace } from "../core/memory/index.js";
import { rebuildThreadIndexInBackground } from "../core/workspace.js";
import type { WorkspaceInfo } from "../core/types.js";
import { isIgnorableWorkspaceChange, pathExists } from "./http.js";

const THREAD_INDEX_REVALIDATE_INTERVAL_MS = 30000;
const MEMORY_REBUILD_CHECK_INTERVAL_MS = 500;

type MemoryRebuildActivityReader = (
  workspace: WorkspaceInfo
) => Promise<boolean>;

type UiEventBusOptions = {
  memoryRebuildIntervalMs?: number;
  readMemoryRebuildActive?: MemoryRebuildActivityReader;
};

/**
 * Internal subscriber for any change inside a thread folder. It is not a client event, and
 * the subscriber decides what to do: an atomic SUMMARY.md write is reported on Windows under
 * its temporary name, so the subscriber checks for the summary itself.
 */
export type ThreadFolderListener = (
  workspace: WorkspaceInfo,
  threadId: string
) => void;

/** The thread id when a changed path (relative to the .marc folder) lies inside a thread folder. */
export function threadFolderOf(
  filename: string | Buffer | null
): string | undefined {
  const name = filename === null ? "" : filename.toString();
  return /^threads[\\/]([^\\/]+)[\\/]/.exec(name)?.[1];
}

export class UiEventBus {
  private readonly clients = new Set<http.ServerResponse>();
  private readonly workspaces = new Map<string, WorkspaceInfo>();
  private readonly watchers = new Map<string, FSWatcher>();
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
  private readonly threadFolderListeners = new Set<ThreadFolderListener>();
  private readonly background = new Set<Promise<unknown>>();
  private readonly revalidateTimers = new Map<string, NodeJS.Timeout>();
  private readonly lastRevalidateAt = new Map<string, number>();
  private readonly memoryRebuildStates = new Map<string, boolean>();
  private readonly memoryRebuildIntervalMs: number;
  private readonly readMemoryRebuildActive: MemoryRebuildActivityReader;
  private keepAlive?: NodeJS.Timeout;
  private memoryRebuildTimer?: NodeJS.Timeout;
  private memoryRebuildCheck?: Promise<void>;

  constructor(
    private readonly onClientCountChange?: () => void,
    options: UiEventBusOptions = {}
  ) {
    this.memoryRebuildIntervalMs =
      options.memoryRebuildIntervalMs ?? MEMORY_REBUILD_CHECK_INTERVAL_MS;
    this.readMemoryRebuildActive =
      options.readMemoryRebuildActive ?? memoryRebuildActiveInWorkspace;
  }

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
    this.startMemoryRebuildMonitor();

    response.on("close", () => {
      this.clients.delete(response);
      if (!this.clients.size && this.keepAlive) {
        clearInterval(this.keepAlive);
        this.keepAlive = undefined;
      }
      if (!this.clients.size) this.stopMemoryRebuildMonitor();
      this.onClientCountChange?.();
    });
  }

  send(event: string, payload: unknown): void {
    const body = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) {
      client.write(body);
    }
  }

  /** The refresh event of a thread whose state changed, whatever wrote the change. The panel reloads on it. */
  workspaceChanged(workspaceId: string, threadId: string): void {
    this.send("workspace-changed", {
      workspaceId,
      threadId,
      at: new Date().toISOString()
    });
  }

  async watchWorkspace(workspace: WorkspaceInfo): Promise<void> {
    this.workspaces.set(workspace.id, workspace);
    this.memoryRebuildStates.delete(workspace.id);
    if (this.clients.size) void this.refreshMemoryRebuildStates();

    this.watchers.get(workspace.id)?.close();
    if (!(await pathExists(workspace.marcPath))) return;

    try {
      const watcher = watch(
        workspace.marcPath,
        { recursive: true },
        (_eventType, filename) => {
          this.notifyThreadFolder(workspace, filename);
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

  /** Tracks a background job until it settles, so shutdown can wait for its writes. */
  private trackBackground(job: Promise<unknown>): void {
    this.background.add(job);
    void job.finally(() => this.background.delete(job));
  }

  /** Resolves once every background rebuild started before this call has finished writing. */
  async idle(): Promise<void> {
    await Promise.allSettled([...this.background]);
  }

  scheduleThreadIndexRebuild(workspace: WorkspaceInfo, delayMs = 0): void {
    const current = this.revalidateTimers.get(workspace.id);
    if (current) clearTimeout(current);
    this.revalidateTimers.set(
      workspace.id,
      setTimeout(() => {
        this.lastRevalidateAt.set(workspace.id, Date.now());
        this.trackBackground(
          rebuildThreadIndexInBackground(workspace.rootPath)
            .catch(() => undefined)
            .finally(() => {
              this.revalidateTimers.delete(workspace.id);
              this.sendWorkspaceChanged(workspace.id);
            })
        );
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

  /** Registers an internal listener for thread folder changes and returns the function that removes it. */
  onThreadFolderChange(listener: ThreadFolderListener): () => void {
    this.threadFolderListeners.add(listener);
    return () => {
      this.threadFolderListeners.delete(listener);
    };
  }

  private notifyThreadFolder(
    workspace: WorkspaceInfo,
    filename: string | Buffer | null
  ): void {
    const threadId = threadFolderOf(filename);
    if (!threadId) return;
    for (const listener of this.threadFolderListeners) {
      listener(workspace, threadId);
    }
  }

  unwatchWorkspace(workspaceId: string): void {
    this.workspaces.delete(workspaceId);
    this.memoryRebuildStates.delete(workspaceId);
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

  private startMemoryRebuildMonitor(): void {
    if (!this.clients.size) return;
    if (this.memoryRebuildTimer) return;

    this.memoryRebuildTimer = setInterval(
      () => void this.refreshMemoryRebuildStates(),
      this.memoryRebuildIntervalMs
    );
    this.memoryRebuildTimer.unref?.();
    void this.refreshMemoryRebuildStates();
  }

  private stopMemoryRebuildMonitor(): void {
    this.memoryRebuildStates.clear();
    const timer = this.memoryRebuildTimer;
    this.memoryRebuildTimer = undefined;
    if (!timer) return;

    clearInterval(timer);
  }

  private refreshMemoryRebuildStates(): Promise<void> {
    if (this.memoryRebuildCheck) return this.memoryRebuildCheck;

    this.memoryRebuildCheck = this.performMemoryRebuildRefresh();
    return this.memoryRebuildCheck;
  }

  private async performMemoryRebuildRefresh(): Promise<void> {
    try {
      const workspaces = Array.from(this.workspaces.values());
      await Promise.all(
        workspaces.map((workspace) => this.refreshMemoryRebuildState(workspace))
      );
    } finally {
      this.memoryRebuildCheck = undefined;
    }
  }

  private async refreshMemoryRebuildState(
    workspace: WorkspaceInfo
  ): Promise<void> {
    const rebuilding = await this.readMemoryRebuildState(workspace);
    const previous = this.memoryRebuildStates.get(workspace.id);
    this.memoryRebuildStates.set(workspace.id, rebuilding);
    if (previous === rebuilding) return;
    if (previous === undefined && !rebuilding) return;

    this.sendWorkspaceChanged(workspace.id);
  }

  private async readMemoryRebuildState(
    workspace: WorkspaceInfo
  ): Promise<boolean> {
    try {
      return await this.readMemoryRebuildActive(workspace);
    } catch {
      return false;
    }
  }

  private sendWorkspaceChanged(workspaceId: string): void {
    this.send("workspace-changed", {
      workspaceId,
      at: new Date().toISOString()
    });
  }

  close(): void {
    this.stopMemoryRebuildMonitor();
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
    this.workspaces.clear();
    this.watchers.clear();
    this.debounceTimers.clear();
    this.revalidateTimers.clear();
    this.lastRevalidateAt.clear();
    this.memoryRebuildStates.clear();
  }
}
