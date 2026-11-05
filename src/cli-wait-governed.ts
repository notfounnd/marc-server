import fs from "node:fs";
import path from "node:path";
import { reservationKey } from "./core/activation-reservation-records.js";
import type {
  PortCheck,
  PortFailure,
  PortReplies,
  ReservationDecision,
  ReservationPort,
  ReservationReply
} from "./core/thread-wait.js";
import { connectDaemon, productionDaemonFiles } from "./cli-open-discovery.js";
import { OpenError } from "./cli-open-output.js";
import { createDaemonClient, type DaemonAccess } from "./cli-open-session.js";

/**
 * The inputs of the governed port. The data directory and the daemon URL follow `marc open`:
 * the flag, then the environment, then the workspace's .marc-daemon when it exists.
 */
export type GovernedConfig = {
  workspaceRoot: string;
  workspaceId: string;
  threadId: string;
  mention: string;
  holder: string | undefined;
  runId: string;
  /** The waiter's own pid, sent with each reservation. Defaults to this process, which is the waiter. */
  pid?: number;
  dataDir: string | undefined;
  daemonUrl: string | undefined;
  env: NodeJS.ProcessEnv;
};

type Connected = { access?: DaemonAccess };

type ReplyBody = {
  decision: ReservationDecision;
  stage: string;
  cycle?: number;
  reason?: string;
};

type Sent = { ok: true; body: unknown } | PortFailure;

const RESERVATION_TIMEOUT_MS = 5_000;
const DECISIONS: readonly string[] = ["granted", "held", "refused"];

/** The daemon port of a governed wait. Every failure is a value, so the loop never throws on it. */
export function createGovernedPort(config: GovernedConfig): ReservationPort {
  const connected: Connected = {};
  return {
    check: () => probe(config, connected),
    reserve: (messageIds) => reserveAll(config, connected, messageIds)
  };
}

/** Probes the daemon on every governed tick, so a daemon that goes away ends the wait at once. */
async function probe(
  config: GovernedConfig,
  connected: Connected
): Promise<PortCheck> {
  if (config.holder === undefined) return failure("error", "session_required");
  const captured: Connected = {};
  try {
    await connectDaemon(
      {
        explicitUrl:
          config.daemonUrl ?? (config.env.MARC_DAEMON_URL || undefined),
        dataDir: dataDirOf(config),
        env: config.env
      },
      productionDaemonFiles,
      (access) => {
        captured.access = access;
        return createDaemonClient(access);
      }
    );
  } catch (error) {
    return failure("daemon_unavailable", reasonOf(error));
  }
  connected.access = captured.access;
  return { ok: true };
}

async function reserveAll(
  config: GovernedConfig,
  connected: Connected,
  messageIds: readonly string[]
): Promise<PortReplies> {
  const holder = config.holder;
  if (holder === undefined) return failure("error", "session_required");
  const access = connected.access ?? (await reconnect(config, connected));
  if (access === undefined)
    return failure("daemon_unavailable", "daemon_unreachable");
  const replies: ReservationReply[] = [];
  for (const messageId of messageIds) {
    const reply = await reserveOne(config, access, holder, messageId);
    if (!reply.ok) return reply;
    replies.push(reply.value);
  }
  return { ok: true, replies };
}

async function reconnect(
  config: GovernedConfig,
  connected: Connected
): Promise<DaemonAccess | undefined> {
  const gate = await probe(config, connected);
  if (!gate.ok) return undefined;
  return connected.access;
}

type ReplyResult = { ok: true; value: ReservationReply } | PortFailure;

async function reserveOne(
  config: GovernedConfig,
  access: DaemonAccess,
  holder: string,
  messageId: string
): Promise<ReplyResult> {
  const sent = await send(access, reservationsPath(config), {
    messageId,
    recipient: config.mention,
    holder,
    runId: config.runId,
    pid: config.pid ?? process.pid
  });
  if (!sent.ok) return sent;
  if (!isReplyBody(sent.body)) {
    return failure("daemon_unavailable", "reservation_reply_invalid");
  }
  return {
    ok: true,
    value: {
      messageId,
      decision: sent.body.decision,
      stage: sent.body.stage,
      cycle: sent.body.cycle,
      reason: sent.body.reason,
      reservation: reservationKey({ messageId, recipient: config.mention })
    }
  };
}

async function send(
  access: DaemonAccess,
  pathname: string,
  body: unknown
): Promise<Sent> {
  try {
    const response = await fetch(new URL(pathname, access.baseUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${access.token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RESERVATION_TIMEOUT_MS)
    });
    if (response.status !== 200) {
      return failure(
        "daemon_unavailable",
        `reservation_http_${response.status}`
      );
    }
    return { ok: true, body: await response.json() };
  } catch {
    return failure("daemon_unavailable", "daemon_request_failed");
  }
}

function reservationsPath(config: GovernedConfig): string {
  const workspace = encodeURIComponent(config.workspaceId);
  const thread = encodeURIComponent(config.threadId);
  return `/api/workspaces/${workspace}/threads/${thread}/activation/reservations`;
}

function isReplyBody(value: unknown): value is ReplyBody {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    DECISIONS.includes(String(record.decision)) &&
    typeof record.stage === "string"
  );
}

function dataDirOf(config: GovernedConfig): string {
  const explicit = config.dataDir ?? config.env.MARC_DAEMON_DIR;
  if (explicit !== undefined) return path.resolve(explicit);
  return path.resolve(workspaceDataDir(config.workspaceRoot));
}

/** The workspace's own .marc-daemon when it exists, else the same name in the current directory. */
function workspaceDataDir(workspaceRoot: string): string {
  const candidate = path.join(workspaceRoot, ".marc-daemon");
  if (fs.statSync(candidate, { throwIfNoEntry: false })?.isDirectory()) {
    return candidate;
  }
  return ".marc-daemon";
}

function reasonOf(error: unknown): string {
  if (error instanceof OpenError) return error.reason;
  return "daemon_unavailable";
}

function failure(status: PortFailure["status"], reason: string): PortFailure {
  return { ok: false, status, reason };
}
