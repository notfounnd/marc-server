import { randomUUID } from "node:crypto";
import {
  DENY,
  PERMISSION_TIMEOUT_MS,
  summaryOf,
  type PermissionRequestView
} from "../core/supervision-permissions.js";

export type PermissionStatus = "open" | "allow" | "deny";

/** One request as the daemon keeps it in memory. It is never written to a file, so a restart denies it. */
export type PermissionRecord = {
  requestId: string;
  runId: string;
  workspaceId: string;
  threadId: string;
  toolName: string;
  summary: string;
  createdAt: string;
  expiresAt: string;
  expiresAtMs: number;
  status: PermissionStatus;
  message: string | undefined;
};

export type OpenInput = {
  runId: string;
  workspaceId: string;
  threadId: string;
  toolName: string;
  input: unknown;
};

/** What the MCP process reads: the status, and the deny message when the status is deny. */
export type QueryReply = { status: PermissionStatus; message?: string };

export type DecideInput = {
  workspaceId: string;
  threadId: string;
  requestId: string;
  decision: "allow" | "deny";
};

export type DecideOutcome =
  | { outcome: "decided"; status: PermissionStatus }
  | { outcome: "conflict"; status: PermissionStatus }
  | { outcome: "not_found" };

export type PermissionStore = {
  open(input: OpenInput): PermissionRecord;
  query(runId: string, requestId: string): QueryReply | undefined;
  decide(input: DecideInput): DecideOutcome;
  /** Denies every open request of the run with this message. Called at the deadline and at the end of a turn. */
  denyOpen(runId: string, message: string): void;
  /** The open requests of a run, for the panel. Nothing else of them leaves the store. */
  openFor(runId: string): PermissionRequestView[];
};

export type PermissionStoreDeps = {
  /** The clock, in epoch milliseconds. */
  now: () => number;
  newId?: () => string;
  timeoutMs?: number;
  /**
   * Told when a request changes, whoever changed it: created, decided by the panel, or denied at its deadline
   * or at the end of its turn. The panel refreshes on it, so the request shows without a manual refresh.
   */
  changed?: (workspaceId: string, threadId: string) => void;
  /** Runs a callback after a delay. The default is a timer that does not keep the daemon alive. */
  schedule?: (fire: () => void, ms: number) => void;
};

function defaultSchedule(fire: () => void, ms: number): void {
  setTimeout(fire, ms).unref();
}

/** The status and message a decision from the panel sets. A deny from the panel says the user denied it. */
const DECISION_RESULT: Record<
  "allow" | "deny",
  { status: PermissionStatus; message: string | undefined }
> = {
  allow: { status: "allow", message: undefined },
  deny: { status: "deny", message: DENY.userDenied }
};

export function createPermissionStore(
  deps: PermissionStoreDeps
): PermissionStore {
  const records = new Map<string, PermissionRecord>();
  const newId = deps.newId ?? (() => randomUUID());
  const timeoutMs = deps.timeoutMs ?? PERMISSION_TIMEOUT_MS;
  const announce = deps.changed ?? (() => undefined);
  const schedule = deps.schedule ?? defaultSchedule;

  /** Settles every request whose deadline has passed. The run of an expired request is denied as a whole. */
  function sweep(): void {
    const now = deps.now();
    for (const record of records.values()) {
      if (record.status !== "open") continue;
      if (now < record.expiresAtMs) continue;
      denyRun(record.runId, DENY.timeout);
    }
  }

  /** Denies the open requests of a run, and announces each one it changes. */
  function denyRun(runId: string, message: string): void {
    for (const record of records.values()) {
      if (record.runId !== runId) continue;
      if (record.status !== "open") continue;
      record.status = "deny";
      record.message = message;
      announce(record.workspaceId, record.threadId);
    }
  }

  return {
    open(input) {
      sweep();
      const createdAtMs = deps.now();
      const record: PermissionRecord = {
        requestId: newId(),
        runId: input.runId,
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        toolName: input.toolName,
        summary: summaryOf(input.input),
        createdAt: new Date(createdAtMs).toISOString(),
        expiresAt: new Date(createdAtMs + timeoutMs).toISOString(),
        expiresAtMs: createdAtMs + timeoutMs,
        status: "open",
        message: undefined
      };
      records.set(record.requestId, record);
      announce(record.workspaceId, record.threadId);
      // The deadline is settled by a timer too, so the request is denied on time when nothing else reads it.
      schedule(sweep, timeoutMs);
      return record;
    },
    query(runId, requestId) {
      sweep();
      const record = records.get(requestId);
      if (record === undefined || record.runId !== runId) return undefined;
      return { status: record.status, message: record.message };
    },
    decide(input) {
      sweep();
      const record = records.get(input.requestId);
      if (record === undefined) return { outcome: "not_found" };
      if (record.workspaceId !== input.workspaceId)
        return { outcome: "not_found" };
      if (record.threadId !== input.threadId) return { outcome: "not_found" };
      if (record.status !== "open") {
        return { outcome: "conflict", status: record.status };
      }
      const result = DECISION_RESULT[input.decision];
      record.status = result.status;
      record.message = result.message;
      announce(record.workspaceId, record.threadId);
      return { outcome: "decided", status: result.status };
    },
    denyOpen(runId, message) {
      denyRun(runId, message);
    },
    openFor(runId) {
      sweep();
      return [...records.values()]
        .filter((record) => record.runId === runId && record.status === "open")
        .map((record) => ({
          requestId: record.requestId,
          toolName: record.toolName,
          summary: record.summary,
          createdAt: record.createdAt,
          expiresAt: record.expiresAt
        }));
    }
  };
}
