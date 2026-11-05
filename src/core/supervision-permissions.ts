/**
 * The permission prompt of a supervised turn. The turn asks its client's permission tool, which is a tool of
 * the workspace's mARC MCP server, and the daemon answers from the human's decision in the panel.
 */

/** The name the workspace's client configuration gives the mARC MCP server. The launch and the tool read this one place. */
export const MARC_MCP_SERVER_NAME = "mcp-marc";

/** The tool name inside the mARC MCP server. */
export const PERMISSION_PROMPT_TOOL_NAME = "permission_prompt";

/** The name Claude Code takes in --permission-prompt-tool: mcp__<server>__<tool>. */
export const PERMISSION_PROMPT_TOOL = `mcp__${MARC_MCP_SERVER_NAME}__${PERMISSION_PROMPT_TOOL_NAME}`;

/** The flags a supervised turn adds last, after the fixed ones, so the prompt tool is always the last value. */
export function permissionLaunchArgs(): string[] {
  return ["--permission-prompt-tool", PERMISSION_PROMPT_TOOL];
}

/** How long a permission request waits for the human before it is denied. */
export const PERMISSION_TIMEOUT_MS = 10 * 60_000;

/** The interval between two reads of the decision. Short, so that no HTTP response waits for minutes. */
export const PERMISSION_POLL_MS = 2_000;

/** The longest summary of a request's input that the panel shows. */
export const PERMISSION_SUMMARY_CHARS = 200;

/** The deny messages. The agent reads them, so each names the reason and nothing else. */
export const DENY = {
  timeout: "timeout",
  daemonUnavailable: "daemon_unavailable",
  notSupervised: "not a supervised turn",
  userDenied: "denied by the user"
} as const;

export type PermissionDecision =
  | { behavior: "allow" }
  | { behavior: "deny"; message: string };

export const ALLOW: PermissionDecision = { behavior: "allow" };

export function denyWith(message: string): PermissionDecision {
  return { behavior: "deny", message };
}

/** The text the tool returns: one text block holding the JSON the client reads. */
export function decisionTextOf(decision: PermissionDecision): string {
  return JSON.stringify(decision);
}

/** A bounded summary of a tool input, for the panel. The whole input is never kept. */
export function summaryOf(input: unknown): string {
  const text = JSON.stringify(input) ?? "";
  return text.slice(0, PERMISSION_SUMMARY_CHARS);
}

/** The body the MCP process sends to the daemon: its own pid and parent pid, and what the turn asks. */
export type PermissionRequestBody = {
  pid: number;
  ppid: number;
  toolName: string;
  input: unknown;
  toolUseId: string;
};

/** The fields of a request the panel shows. No token, no run id and no process data. */
export type PermissionRequestView = {
  requestId: string;
  toolName: string;
  summary: string;
  createdAt: string;
  expiresAt: string;
};

/** Reads the body of a create request, or undefined when a field is missing or has the wrong type. */
export function requestBodyOf(
  value: unknown
): PermissionRequestBody | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const body = value as Record<string, unknown>;
  const valid =
    Number.isInteger(body.pid) &&
    Number.isInteger(body.ppid) &&
    typeof body.toolName === "string" &&
    typeof body.toolUseId === "string" &&
    "input" in body;
  if (!valid) return undefined;
  return {
    pid: body.pid as number,
    ppid: body.ppid as number,
    toolName: body.toolName as string,
    input: body.input,
    toolUseId: body.toolUseId as string
  };
}

/** The decision the human makes in the panel. Anything else is not a decision. */
export function panelDecisionOf(value: unknown): "allow" | "deny" | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const decision = (value as Record<string, unknown>).decision;
  if (decision === "allow" || decision === "deny") return decision;
  return undefined;
}
