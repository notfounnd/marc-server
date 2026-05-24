import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_RETRY_DELAY_MS = 20;
const DEFAULT_STALE_AFTER_MS = 300_000;
const DEFAULT_TIMEOUT_MS = 10_000;

export type WorkspaceWriteLockOptions = {
  retryDelayMs?: number;
  staleAfterMs?: number;
  timeoutMs?: number;
};

export function threadWriteResource(threadId: string): string {
  return `thread:${threadId}`;
}

export function agentWriteResource(agentId: string): string {
  return `agent:${agentId}`;
}

type LockOwner = {
  pid: number;
  resource: string;
  token: string;
};

type HeldLock = {
  release: () => Promise<void>;
};

export function workspaceWriteLockPath(
  marcPath: string,
  resource: string
): string {
  const name = resource.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 48);
  const hash = createHash("sha256").update(resource).digest("hex").slice(0, 16);
  return path.join(marcPath, "cache", "write-locks", `${name}-${hash}.lock`);
}

export async function withWorkspaceWriteLock<T>(
  marcPath: string,
  resource: string,
  writer: () => Promise<T>,
  options: WorkspaceWriteLockOptions = {}
): Promise<T> {
  const lock = await acquireWorkspaceWriteLock(marcPath, resource, options);

  try {
    return await writer();
  } finally {
    await lock.release();
  }
}

export async function writeFileAtomically(
  filePath: string,
  content: string
): Promise<void> {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );
  await fs.mkdir(directory, { recursive: true });

  try {
    await fs.writeFile(temporaryPath, content, "utf8");
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function acquireWorkspaceWriteLock(
  marcPath: string,
  resource: string,
  options: WorkspaceWriteLockOptions
): Promise<HeldLock> {
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  const lockPath = workspaceWriteLockPath(marcPath, resource);
  const owner: LockOwner = {
    pid: process.pid,
    resource,
    token: randomUUID()
  };
  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  while (Date.now() <= deadline) {
    const acquired = await tryAcquireLock(lockPath, owner);
    if (acquired) {
      return heldLock(lockPath, owner, staleAfterMs);
    }

    await removeStaleLock(lockPath, staleAfterMs);
    await delay(retryDelayMs);
  }

  throw new Error(`Timed out acquiring write lock for ${resource}.`);
}

async function tryAcquireLock(
  lockPath: string,
  owner: LockOwner
): Promise<boolean> {
  try {
    await fs.mkdir(lockPath);
  } catch (error) {
    if (isLockContentionError(error)) return false;
    throw error;
  }

  try {
    await fs.writeFile(
      path.join(lockPath, "owner.json"),
      JSON.stringify(owner),
      "utf8"
    );
    return true;
  } catch (error) {
    await fs.rm(lockPath, { force: true, recursive: true });
    throw error;
  }
}

function heldLock(
  lockPath: string,
  owner: LockOwner,
  staleAfterMs: number
): HeldLock {
  const heartbeat = setInterval(
    () => {
      void refreshLock(lockPath);
    },
    Math.max(10, Math.floor(staleAfterMs / 3))
  );
  heartbeat.unref();
  let released = false;

  return {
    async release(): Promise<void> {
      if (released) return;
      released = true;
      clearInterval(heartbeat);

      const ownsLock = await hasLockOwner(lockPath, owner.token);
      if (!ownsLock) return;
      await fs.rm(lockPath, { force: true, recursive: true });
    }
  };
}

async function refreshLock(lockPath: string): Promise<void> {
  const now = new Date();
  await fs.utimes(lockPath, now, now).catch(() => undefined);
}

async function hasLockOwner(lockPath: string, token: string): Promise<boolean> {
  try {
    const owner = JSON.parse(
      await fs.readFile(path.join(lockPath, "owner.json"), "utf8")
    ) as LockOwner;
    return owner.token === token;
  } catch {
    return false;
  }
}

async function removeStaleLock(
  lockPath: string,
  staleAfterMs: number
): Promise<void> {
  const stats = await fs.stat(lockPath).catch(() => undefined);
  if (!stats) return;
  if (Date.now() - stats.mtimeMs <= staleAfterMs) return;

  const stalePath = `${lockPath}.stale-${randomUUID()}`;
  const moved = await moveLock(lockPath, stalePath);
  if (!moved) return;
  await fs.rm(stalePath, { force: true, recursive: true });
}

async function moveLock(lockPath: string, stalePath: string): Promise<boolean> {
  try {
    await fs.rename(lockPath, stalePath);
    return true;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return false;
    if (hasErrorCode(error, "EPERM")) return false;
    if (hasErrorCode(error, "EACCES")) return false;
    throw error;
  }
}

function isLockContentionError(error: unknown): boolean {
  return (
    hasErrorCode(error, "EEXIST") ||
    hasErrorCode(error, "EPERM") ||
    hasErrorCode(error, "EACCES")
  );
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (error as NodeJS.ErrnoException).code === code;
}

async function delay(durationMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}
