import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  ALLOW,
  DENY,
  PERMISSION_POLL_MS,
  PERMISSION_PROMPT_TOOL_NAME,
  PERMISSION_TIMEOUT_MS,
  decisionTextOf,
  denyWith,
  type PermissionDecision
} from "../core/supervision-permissions.js";
import { daemonConnection, type DaemonConnection } from "./daemon.js";
import type { McpOptions } from "./types.js";

/** The longest one HTTP call to the daemon may take. The decision is read again on the next poll. */
const CALL_TIMEOUT_MS = 5_000;

/** The arguments Claude sends to its permission prompt tool. */
export type PromptInput = {
  tool_name: string;
  input?: unknown;
  tool_use_id: string;
};

/** Everything the tool reads from its process, injected so that the tests drive the same flow. */
export type PermissionDeps = {
  env: Record<string, string | undefined>;
  connection: DaemonConnection | undefined;
  pid: number;
  ppid: number;
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  timeoutMs: number;
  pollMs: number;
};

type Reply =
  | { kind: "answer"; status: number; body: unknown }
  | { kind: "unreachable" };

type Created =
  | { kind: "created"; requestId: string }
  | { kind: "refused"; decision: PermissionDecision };

type Poll =
  | { kind: "open" }
  | { kind: "decided"; decision: PermissionDecision };

const PROMPT_SCHEMA = z.object({
  tool_name: z.string(),
  input: z.unknown(),
  tool_use_id: z.string()
});

/**
 * Asks the daemon for a decision on one permission prompt of a supervised turn, and waits for it. The run
 * comes from the process environment, and the pid and parent pid are the process's own. Every outcome is a
 * decision: an unsupervised call, a refusal, a timeout or an unreachable daemon is a deny with its reason.
 */
export async function permissionDecisionOf(
  input: PromptInput,
  deps: PermissionDeps
): Promise<PermissionDecision> {
  const runId = deps.env.MARC_SUPERVISOR_RUN_ID;
  const connection = deps.connection;
  if (runId === undefined || runId === "") return denyWith(DENY.notSupervised);
  if (connection === undefined) return denyWith(DENY.notSupervised);
  const created = createdOf(
    await call(deps, connection, "POST", runPath(runId), {
      pid: deps.pid,
      ppid: deps.ppid,
      toolName: input.tool_name,
      input: input.input,
      toolUseId: input.tool_use_id
    })
  );
  if (created.kind === "refused") return created.decision;
  return awaitDecision(deps, connection, runId, created.requestId);
}

/** Polls the decision until it arrives or the time limit passes. The turn is never sent again. */
async function awaitDecision(
  deps: PermissionDeps,
  connection: DaemonConnection,
  runId: string,
  requestId: string
): Promise<PermissionDecision> {
  const started = deps.now();
  for (;;) {
    if (deps.now() - started >= deps.timeoutMs) return denyWith(DENY.timeout);
    const path = `${runPath(runId)}/${encodeURIComponent(requestId)}`;
    const poll = pollOf(await call(deps, connection, "GET", path));
    if (poll.kind === "decided") return poll.decision;
    await deps.sleep(deps.pollMs);
  }
}

function runPath(runId: string): string {
  return `/api/supervision/runs/${encodeURIComponent(runId)}/permissions`;
}

async function call(
  deps: PermissionDeps,
  connection: DaemonConnection,
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<Reply> {
  const init: RequestInit = {
    method,
    headers: {
      authorization: `Bearer ${connection.token}`,
      "content-type": "application/json"
    },
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS)
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  try {
    const response = await deps.fetch(
      new URL(path, connection.daemonUrl),
      init
    );
    const parsed = await response.json().catch(() => undefined);
    return { kind: "answer", status: response.status, body: parsed };
  } catch {
    return { kind: "unreachable" };
  }
}

/** The create reply: 201 carries the request; a refusal of the claim is not supervised; a server error is unavailable. */
function createdOf(reply: Reply): Created {
  if (reply.kind === "unreachable") return refused(DENY.daemonUnavailable);
  if (reply.status === 201) return requestIdOf(reply.body);
  if (reply.status >= 500) return refused(DENY.daemonUnavailable);
  return refused(DENY.notSupervised);
}

function requestIdOf(body: unknown): Created {
  const requestId = recordOf(body).requestId;
  if (typeof requestId === "string") return { kind: "created", requestId };
  return refused(DENY.daemonUnavailable);
}

function refused(message: string): Created {
  return { kind: "refused", decision: denyWith(message) };
}

/** The poll reply: a 404 means the request or its run is gone; a 200 carries the status the table reads. */
function pollOf(reply: Reply): Poll {
  if (reply.kind === "unreachable") return decided(DENY.daemonUnavailable);
  if (reply.status === 404) return decided(DENY.notSupervised);
  if (reply.status !== 200) return decided(DENY.daemonUnavailable);
  const handler = POLL_STATUS.get(statusOf(reply.body));
  if (handler === undefined) return decided(DENY.daemonUnavailable);
  return handler(recordOf(reply.body));
}

/** The status of a poll reply, mapped by a table: open keeps waiting, allow and deny settle the decision. */
const POLL_STATUS = new Map<string, (body: Record<string, unknown>) => Poll>([
  ["open", () => ({ kind: "open" })],
  ["allow", () => decided(ALLOW)],
  ["deny", (body) => decided(denyWith(messageOf(body)))]
]);

function statusOf(body: unknown): string {
  const status = recordOf(body).status;
  if (typeof status === "string") return status;
  return "";
}

function messageOf(body: Record<string, unknown>): string {
  if (typeof body.message === "string") return body.message;
  return DENY.notSupervised;
}

function decided(decision: PermissionDecision | string): Poll {
  if (typeof decision === "string") {
    return { kind: "decided", decision: denyWith(decision) };
  }
  return { kind: "decided", decision };
}

function recordOf(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) return {};
  return value as Record<string, unknown>;
}

/** The tool's result: one text block with the JSON decision, and no structured content. */
export function permissionResultOf(decision: PermissionDecision): {
  content: [{ type: "text"; text: string }];
} {
  return { content: [{ type: "text", text: decisionTextOf(decision) }] };
}

function liveDepsOf(options: McpOptions): PermissionDeps {
  return {
    env: process.env,
    connection: daemonConnection(options),
    pid: process.pid,
    ppid: process.ppid,
    fetch: globalThis.fetch,
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    timeoutMs: PERMISSION_TIMEOUT_MS,
    pollMs: PERMISSION_POLL_MS
  };
}

/** Any failure the flow did not foresee is a deny, never an error the client would read as an invalid result. */
async function decisionOf(
  input: PromptInput,
  options: McpOptions
): Promise<PermissionDecision> {
  try {
    return await permissionDecisionOf(input, liveDepsOf(options));
  } catch {
    return denyWith(DENY.daemonUnavailable);
  }
}

/**
 * Registers the permission prompt tool. It is not a gated tool: it takes no bootstrap envelope, no deadline
 * notice and no rate limit, because its result is the client's own decision and nothing else.
 */
export function registerPermissionPromptTool(
  server: McpServer,
  options: McpOptions
): void {
  server.registerTool(
    PERMISSION_PROMPT_TOOL_NAME,
    {
      description:
        "Decides a permission prompt of a turn started by the mARC supervisor. Only that turn can use it; the human decides in the mARC panel.",
      inputSchema: PROMPT_SCHEMA
    },
    async (input) => permissionResultOf(await decisionOf(input, options))
  );
}
