import { execFile } from "node:child_process";
import os from "node:os";
import type {
  AgentsSource,
  ClientProcess,
  McpLeaseSource
} from "../core/session-slots.js";
import { workspaceWriteLockActive } from "../core/write-coordination.js";
import type { DaemonLease } from "../core/types.js";

export const AGENTS_TIMEOUT_MS = 5_000;
export const AGENTS_CACHE_MS = 2_000;
export const LISTENING_STALE_MS = 30_000;

export type AgentsRunner = () => Promise<string>;

export type PresenceDependencies = {
  hostId: string;
  now: () => number;
  runAgents: AgentsRunner;
  lockActive: (
    marcPath: string,
    resource: string,
    staleAfterMs: number
  ) => Promise<boolean>;
};

/** Identity sent by the MCP process: the ppid is the client process when it is Claude Code. */
export type ObservedIdentity = {
  nativeSessionId: string;
  pid: number;
  ppid: number;
  hostId: string;
};

export type ResolvedIdentity = {
  nativeSessionId: string;
  envSessionId?: string;
  clientPid: number;
  clientStartedAt?: number;
  hostId: string;
};

export type SessionPresence = {
  hostId: string;
  now(): number;
  agents(): Promise<AgentsSource>;
  listening(
    marcPath: string,
    threadId: string,
    sessionId: string
  ): Promise<boolean>;
  mcpLeases(
    leases: Iterable<DaemonLease>,
    workspaceId: string
  ): McpLeaseSource[];
  resolveIdentity(identity: ObservedIdentity): Promise<ResolvedIdentity>;
};

type IdentifiedLease = DaemonLease & {
  nativeSessionId: string;
  pid: number;
  hostId: string;
};

type CachedAgents = { at: number; pending: Promise<AgentsSource> };

export function createSessionPresence(
  overrides: Partial<PresenceDependencies> = {}
): SessionPresence {
  const deps: PresenceDependencies = {
    hostId: os.hostname(),
    now: () => Date.now(),
    runAgents: runClaudeAgents,
    lockActive: (marcPath, resource, staleAfterMs) =>
      workspaceWriteLockActive(marcPath, resource, { staleAfterMs }),
    ...overrides
  };
  let cache: CachedAgents | undefined;

  function agents(): Promise<AgentsSource> {
    const at = deps.now();
    if (cache && at - cache.at < AGENTS_CACHE_MS) return cache.pending;
    const pending = readAgents(deps.runAgents);
    cache = { at, pending };
    return pending;
  }

  return {
    hostId: deps.hostId,
    now: () => deps.now(),
    agents,
    listening: (marcPath, threadId, sessionId) =>
      deps.lockActive(
        marcPath,
        `wait:${threadId}:${sessionId}`,
        LISTENING_STALE_MS
      ),
    mcpLeases: (leases, workspaceId) =>
      mcpLeaseSources(leases, workspaceId, deps.now()),
    resolveIdentity: async (identity) =>
      resolveIdentityFrom(await agents(), identity)
  };
}

/** Runs `claude agents --json` without a shell; the only process spawned here. */
export function runClaudeAgents(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "claude",
      ["agents", "--json"],
      { shell: false, windowsHide: true, timeout: AGENTS_TIMEOUT_MS },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      }
    );
  });
}

async function readAgents(runner: AgentsRunner): Promise<AgentsSource> {
  try {
    return parseAgentsOutput(await runner());
  } catch {
    return { status: "unavailable", reason: "command_failed" };
  }
}

/**
 * An entry without a pid is not a live process and is skipped. An entry with a pid
 * that does not validate, or any entry that is not an object, makes the inventory
 * incomplete: absence cannot be proven from it, so the source is unavailable.
 */
export function parseAgentsOutput(output: string): AgentsSource {
  const parsed = parseJson(output);
  if (!Array.isArray(parsed)) {
    return { status: "unavailable", reason: "invalid_output" };
  }
  if (!parsed.every(isCompleteEntry)) {
    return { status: "unavailable", reason: "incomplete_inventory" };
  }
  return {
    status: "available",
    processes: parsed.filter(isClientRecord).map(toClientProcess)
  };
}

/**
 * The process at ppid is authoritative for the session ID and startedAt, so a
 * /clear inside Claude Code is seen. The environment ID is kept for diagnosis.
 */
export function resolveIdentityFrom(
  agents: AgentsSource,
  identity: ObservedIdentity
): ResolvedIdentity {
  const base: ResolvedIdentity = {
    nativeSessionId: identity.nativeSessionId,
    clientPid: identity.ppid,
    hostId: identity.hostId
  };
  const listed = listedProcess(agents, identity.ppid);
  if (!listed) return base;
  return {
    ...base,
    nativeSessionId: listed.sessionId,
    envSessionId:
      listed.sessionId === identity.nativeSessionId
        ? undefined
        : identity.nativeSessionId,
    clientStartedAt: listed.startedAt
  };
}

export function mcpLeaseSources(
  leases: Iterable<DaemonLease>,
  workspaceId: string,
  nowMs: number
): McpLeaseSource[] {
  return [...leases]
    .filter((lease): lease is IdentifiedLease =>
      isIdentifiedLease(lease, workspaceId, nowMs)
    )
    .map((lease) => ({
      nativeSessionId: lease.nativeSessionId,
      pid: lease.pid,
      hostId: lease.hostId
    }));
}

function listedProcess(
  agents: AgentsSource,
  pid: number
): ClientProcess | undefined {
  if (agents.status !== "available") return undefined;
  return agents.processes.find((process) => process.pid === pid);
}

function isIdentifiedLease(
  lease: DaemonLease,
  workspaceId: string,
  nowMs: number
): boolean {
  if (lease.workspaceId !== workspaceId) return false;
  if (lease.identifiedAt === undefined) return false;
  if (lease.nativeSessionId === undefined) return false;
  if (lease.pid === undefined || lease.hostId === undefined) return false;
  return Date.parse(lease.expiresAt) > nowMs;
}

function isCompleteEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!hasPid(value)) return true;
  return isClientRecord(value);
}

function hasPid(record: Record<string, unknown>): boolean {
  return record.pid !== undefined && record.pid !== null;
}

function isClientRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.pid) &&
    typeof value.startedAt === "number" &&
    typeof value.sessionId === "string"
  );
}

function toClientProcess(record: Record<string, unknown>): ClientProcess {
  return {
    pid: record.pid as number,
    startedAt: record.startedAt as number,
    sessionId: record.sessionId as string,
    status: typeof record.status === "string" ? record.status : ""
  };
}

function parseJson(output: string): unknown {
  try {
    return JSON.parse(output) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
