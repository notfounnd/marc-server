import type { CallToolResult } from "@modelcontextprotocol/server";
import { daemonConnection, type DaemonConnection } from "./daemon.js";
import type { McpOptions } from "./types.js";

/**
 * The deadline notice of a supervised turn, as a tool response carries it. Only the warning and the stop
 * phases reach the turn: the kill ends the process, so it has nothing left to read.
 */
export type DeadlineField = { kind: "warning" | "stop"; message: string };

/** Where a tool response gets its notice. It is asked on each call, so the connection is read when needed. */
export type DeadlineSource = () => Promise<DeadlineField | undefined>;

/** The source of a server that has no turn to report on: no notice, and no request. */
export const NO_DEADLINE: DeadlineSource = async () => undefined;

/** The notice is read on every tool call of a turn, so it must not hold the call for long. */
export const NOTICE_TIMEOUT_MS = 1_500;

/**
 * The notice source of an MCP server. The daemon connection is the one the server resolves from its
 * options, the same one its own daemon calls use, with the environment as the fallback. The run id comes
 * from MARC_SUPERVISOR_RUN_ID in the given environment. Without a run id or a connection, there is no
 * notice and no request.
 */
export function deadlineSourceOf(
  options: McpOptions,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): DeadlineSource {
  return () =>
    deadlineFor(
      daemonConnection(options),
      env.MARC_SUPERVISOR_RUN_ID,
      fetchImpl
    );
}

/**
 * Reads the notice of one run from the daemon, with the connection's token, since the route sits behind
 * the daemon token like every API route. Best effort: when the daemon is down or answers anything else,
 * there is no notice and no error.
 */
export async function deadlineFor(
  connection: DaemonConnection | undefined,
  runId: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<DeadlineField | undefined> {
  if (!runId || !connection) return undefined;
  try {
    const url = new URL(
      `/api/supervision/runs/${encodeURIComponent(runId)}/notice`,
      connection.daemonUrl
    );
    const response = await fetchImpl(url, {
      headers: { authorization: `Bearer ${connection.token}` },
      signal: AbortSignal.timeout(NOTICE_TIMEOUT_MS)
    });
    if (!response.ok) return undefined;
    return fieldOf(await response.json());
  } catch {
    return undefined;
  }
}

function fieldOf(value: unknown): DeadlineField | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const notice = value as { kind?: unknown; message?: unknown };
  if (notice.kind !== "warning" && notice.kind !== "stop") return undefined;
  if (typeof notice.message !== "string") return undefined;
  return { kind: notice.kind, message: notice.message };
}

/**
 * Adds the notice to a tool response. A JSON object response gets a `deadline` field; any other response
 * gets the message as one more text block. Without a notice, or for a value that is not a tool response,
 * the result comes back unchanged.
 */
export function withDeadline(
  result: unknown,
  field: DeadlineField | undefined
): unknown {
  if (field === undefined) return result;
  if (!isToolResult(result)) return result;
  return { ...result, content: contentWith(result.content, field) };
}

function contentWith(
  content: CallToolResult["content"],
  field: DeadlineField
): CallToolResult["content"] {
  const [first, ...rest] = content;
  const object = jsonObjectOf(first);
  if (object === undefined) {
    return [...content, { type: "text", text: field.message }];
  }
  return [
    {
      type: "text",
      text: JSON.stringify({ ...object, deadline: field }, null, 2)
    },
    ...rest
  ];
}

function jsonObjectOf(
  block: CallToolResult["content"][number] | undefined
): Record<string, unknown> | undefined {
  if (block?.type !== "text") return undefined;
  const parsed: unknown = parseJson(block.text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }
  return parsed as Record<string, unknown>;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isToolResult(value: unknown): value is CallToolResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "content" in value &&
    Array.isArray(value.content)
  );
}
