import type http from "node:http";
import { isRecord } from "../core/activation-rules.js";
import type { ActivationRouteContext } from "./activation-routes.js";
import { json } from "./http.js";

/** A refusal with its reason and status. Every activation route answers refusals this way. */
export function refuse(
  response: http.ServerResponse,
  reason: string,
  status: number
): void {
  json(response, status, { decision: "refused", reason });
}

/** The malformed-body answer of the activation routes. */
export function invalidBody(response: http.ServerResponse): void {
  json(response, 400, { errors: [{ field: "body", code: "invalid_type" }] });
}

/** The workspace-changed event the UI listens to, scoped to the thread when one is named. */
export function emitChanged(
  context: ActivationRouteContext,
  workspaceId: string,
  threadId?: string
): void {
  context.events.send("workspace-changed", {
    workspaceId,
    ...(threadId ? { threadId } : {}),
    at: new Date().toISOString()
  });
}

/** Non-empty text fields only. Anything else is not a request this route can judge. */
export function textFieldsOf<K extends string>(
  body: unknown,
  keys: readonly K[]
): Record<K, string> | undefined {
  if (!isRecord(body)) return undefined;
  const values = keys.map((key) => body[key]);
  if (!values.every(isNonEmptyText)) return undefined;
  return Object.fromEntries(
    keys.map((key, index) => [key, values[index]])
  ) as Record<K, string>;
}

function isNonEmptyText(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}
