import fs from "node:fs/promises";
import path from "node:path";
import type {
  ThreadIndexEntry,
  ThreadIndexHealth,
  ThreadIndexSnapshot,
  ThreadIndexStore,
  ThreadInfo,
  ThreadListOptions,
  ThreadListStatus,
} from "./types.js";

const INDEX_VERSION = 1;
const saveQueues = new Map<string, Promise<void>>();

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath: string): Promise<string> {
  return (await exists(filePath)) ? fs.readFile(filePath, "utf8") : "";
}

function parseClosedAt(summary: string, summaryMtime: Date): string {
  return /^Closed:\s+`?([^`\n]+)`?$/m.exec(summary)?.[1]?.trim() || summaryMtime.toISOString();
}

function sortThreads(threads: ThreadInfo[], status: ThreadListStatus): ThreadInfo[] {
  const byCreatedDesc = (a: ThreadInfo, b: ThreadInfo) => b.createdAt.localeCompare(a.createdAt);
  const byClosedDesc = (a: ThreadInfo, b: ThreadInfo) => (b.closedAt ?? "").localeCompare(a.closedAt ?? "");

  if (status === "closed") {
    return threads.sort(byClosedDesc);
  }

  if (status === "all") {
    return threads.sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return a.status === "open" ? byCreatedDesc(a, b) : byClosedDesc(a, b);
    });
  }

  return threads.sort(byCreatedDesc);
}

function publicThreads(snapshot: ThreadIndexSnapshot, options: ThreadListOptions = {}): ThreadInfo[] {
  const status = options.status ?? "open";
  const threads = snapshot.threads
    .filter((thread) => status === "all" || thread.status === status)
    .map(({ chatMtimeMs: _chatMtimeMs, summaryMtimeMs: _summaryMtimeMs, ...thread }) => thread);

  return sortThreads(threads, status);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class JsonThreadIndexStore implements ThreadIndexStore {
  constructor(private readonly indexPath: string) {}

  async load(): Promise<ThreadIndexSnapshot | undefined> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.indexPath, "utf8")) as ThreadIndexSnapshot;
      if (parsed.version !== INDEX_VERSION || !Array.isArray(parsed.threads)) return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }

  async save(snapshot: ThreadIndexSnapshot): Promise<void> {
    const previous = saveQueues.get(this.indexPath) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => this.writeSnapshot(snapshot))
      .finally(() => {
        if (saveQueues.get(this.indexPath) === next) {
          saveQueues.delete(this.indexPath);
        }
      });

    saveQueues.set(this.indexPath, next);
    await next;
  }

  private async writeSnapshot(snapshot: ThreadIndexSnapshot): Promise<void> {
    await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
    const tmpPath = `${this.indexPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(snapshot));
    await fs.rename(tmpPath, this.indexPath);
  }

  async clear(): Promise<void> {
    await fs.rm(this.indexPath, { force: true });
  }
}

export class ThreadIndexReconciler {
  constructor(
    private readonly threadsRoot: string,
    private readonly store: ThreadIndexStore,
  ) {}

  async list(options: ThreadListOptions = {}): Promise<ThreadInfo[]> {
    const snapshot = await this.reconcile();
    return publicThreads(snapshot, options);
  }

  async reconcile(): Promise<ThreadIndexSnapshot> {
    const previous = await this.store.load();
    const previousById = new Map((previous?.threads ?? []).map((thread) => [thread.id, thread]));
    const entries = await fs.readdir(this.threadsRoot, { withFileTypes: true });
    const nextThreads: ThreadIndexEntry[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const threadPath = path.join(this.threadsRoot, entry.name);
      const chatPath = path.join(threadPath, "CHAT.md");
      const summaryPath = path.join(threadPath, "SUMMARY.md");

      const chatStat = await fs.stat(chatPath).catch(() => undefined);
      if (!chatStat) continue;

      const summaryStat = await fs.stat(summaryPath).catch(() => undefined);
      const previousEntry = previousById.get(entry.name);
      if (
        previousEntry &&
        previousEntry.chatMtimeMs === chatStat.mtimeMs &&
        previousEntry.summaryMtimeMs === summaryStat?.mtimeMs
      ) {
        nextThreads.push(previousEntry);
        continue;
      }

      nextThreads.push(await this.readEntry(entry.name, threadPath, chatPath, chatStat.mtimeMs, summaryPath, summaryStat));
    }

    const snapshot: ThreadIndexSnapshot = {
      version: INDEX_VERSION,
      updatedAt: new Date().toISOString(),
      threads: nextThreads,
    };
    await this.store.save(snapshot);
    return snapshot;
  }

  private async readEntry(
    id: string,
    threadPath: string,
    chatPath: string,
    chatMtimeMs: number,
    summaryPath: string,
    summaryStat?: { mtime: Date; mtimeMs: number },
  ): Promise<ThreadIndexEntry> {
    const markdown = await readTextIfExists(chatPath);
    const title = /^#\s+(.+)$/m.exec(markdown)?.[1] ?? id;
    const createdAt = /^Created:\s+`(.+)`$/m.exec(markdown)?.[1] ?? "";

    if (summaryStat) {
      const summary = await readTextIfExists(summaryPath);
      return {
        id,
        title,
        path: threadPath,
        createdAt,
        status: "closed",
        closedAt: parseClosedAt(summary, summaryStat.mtime),
        summaryPath,
        chatMtimeMs,
        summaryMtimeMs: summaryStat.mtimeMs,
      };
    }

    return {
      id,
      title,
      path: threadPath,
      createdAt,
      status: "open",
      chatMtimeMs,
    };
  }
}

export class BackgroundThreadIndexReconciler {
  private rebuildPromise?: Promise<ThreadIndexSnapshot>;
  private lastError: string | null = null;
  private lastRebuildAt?: string;

  constructor(
    private readonly threadsRoot: string,
    private readonly store: ThreadIndexStore,
  ) {}

  async list(options: ThreadListOptions = {}): Promise<ThreadInfo[]> {
    const snapshot = await this.store.load();
    if (!snapshot) {
      return publicThreads(await this.rebuild(), options);
    }

    return publicThreads(snapshot, options);
  }

  async rebuild(): Promise<ThreadIndexSnapshot> {
    if (this.rebuildPromise) return this.rebuildPromise;

    const reconciler = new ThreadIndexReconciler(this.threadsRoot, this.store);
    this.rebuildPromise = reconciler
      .reconcile()
      .then((snapshot) => {
        this.lastError = null;
        this.lastRebuildAt = snapshot.updatedAt;
        return snapshot;
      })
      .catch((error: unknown) => {
        this.lastError = errorMessage(error);
        throw error;
      })
      .finally(() => {
        this.rebuildPromise = undefined;
      });

    return this.rebuildPromise;
  }

  async health(): Promise<ThreadIndexHealth> {
    const snapshot = await this.store.load();

    if (this.rebuildPromise) {
      return {
        status: "rebuilding",
        rebuilding: true,
        lastRebuildAt: this.lastRebuildAt ?? snapshot?.updatedAt,
        lastError: this.lastError,
        threadCount: snapshot?.threads.length ?? 0,
      };
    }

    if (this.lastError) {
      return {
        status: snapshot ? "degraded" : "unavailable",
        rebuilding: false,
        lastRebuildAt: this.lastRebuildAt ?? snapshot?.updatedAt,
        lastError: this.lastError,
        threadCount: snapshot?.threads.length ?? 0,
      };
    }

    return {
      status: snapshot ? "ready" : "unavailable",
      rebuilding: false,
      lastRebuildAt: this.lastRebuildAt ?? snapshot?.updatedAt,
      lastError: null,
      threadCount: snapshot?.threads.length ?? 0,
    };
  }
}

export function threadIndexPath(marcPath: string): string {
  return path.join(marcPath, "cache", "thread-index.json");
}
