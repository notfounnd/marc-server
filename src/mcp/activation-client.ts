import type { WorkspaceInfo } from "../core/types.js";
import { daemonConnection } from "./daemon.js";
import type { McpOptions } from "./types.js";

export type ActivationReply =
  | { ok: true; status: number; body: unknown }
  | { ok: false; reason: string };

/** The stamp calls of a message post. They never hold the post longer than this. */
export const STAMP_TIMEOUT_MS = 1_500;

/** The advance is a human-visible decision, so it waits longer than a stamp. */
export const ADVANCE_TIMEOUT_MS = 5_000;

/**
 * One POST to the daemon's activation routes. Any HTTP answer is returned with its status, so the
 * caller decides what it means. A missing daemon, an unreachable one, or a timeout is a failure.
 */
export async function postActivation(
  options: McpOptions,
  route: string,
  body: unknown,
  timeoutMs: number
): Promise<ActivationReply> {
  const connection = daemonConnection(options);
  if (connection === undefined) {
    return { ok: false, reason: "daemon_not_configured" };
  }
  const fetcher = options.activationFetch ?? fetch;
  try {
    const response = await fetcher(new URL(route, connection.daemonUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${connection.token}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
    return { ok: true, status: response.status, body: await jsonOf(response) };
  } catch {
    return { ok: false, reason: "daemon_unreachable" };
  }
}

/** The route of one activation call of a thread in this workspace. */
export function activationRouteOf(
  info: WorkspaceInfo,
  threadId: string,
  suffix: string
): string {
  const workspace = encodeURIComponent(info.id);
  const thread = encodeURIComponent(threadId);
  return `/api/workspaces/${workspace}/threads/${thread}/activation/${suffix}`;
}

async function jsonOf(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
