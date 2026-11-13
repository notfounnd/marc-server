import { resolveWorkspace } from "./core/paths.js";
import {
  resolveThreadId,
  type ThreadResolution
} from "./core/thread-resolution.js";
import { workspaceInfoFor } from "./core/thread-wait-runtime.js";
import type { ThreadDiagnostics } from "./daemon/diagnostics-view.js";
import {
  daemonUrlOption,
  dataDirOption,
  textOption,
  type OpenProbes,
  type OpenValues
} from "./cli-open-input.js";
import {
  discoverDaemon,
  productionDaemonFiles,
  type DaemonFiles
} from "./cli-open-discovery.js";
import { guard, OpenError } from "./cli-open-output.js";
import {
  callDaemon,
  type DaemonAccess,
  type DaemonReply
} from "./cli-open-session.js";

/** The flags of marc diagnose. They are parsed and checked before any daemon call. */
export type DiagnoseInput = {
  workspaceRoot: string;
  requestedThread: string;
  dataDir: string;
  daemonUrl: string | undefined;
  profile: string | undefined;
};

export type DiagnoseOutput = { print: (line: string) => void };

/** Every effect of marc diagnose. Production wires the real ones; tests inject fakes. */
export type DiagnoseDeps = {
  env: NodeJS.ProcessEnv;
  daemonFiles: DaemonFiles;
  resolveThread: (
    workspaceRoot: string,
    requested: string
  ) => Promise<ThreadResolution>;
  call: (
    access: DaemonAccess,
    method: string,
    route: string
  ) => Promise<DaemonReply>;
};

/** The reason of each daemon refusal that is not a 200. Any other status is a daemon error. */
const REFUSAL_REASONS: Partial<Record<number, string>> = {
  401: "token_rejected",
  404: "thread_not_found"
};

/** The flags of marc diagnose. The data directory and the daemon URL follow the rules of marc open. */
export function parseDiagnoseInput(
  values: OpenValues,
  env: NodeJS.ProcessEnv,
  probes: OpenProbes
): DiagnoseInput {
  const workspaceRoot = resolveWorkspace(textOption(values, "workspace"));
  return {
    workspaceRoot,
    requestedThread: requiredThread(values),
    dataDir: dataDirOption(values, env, workspaceRoot, probes),
    daemonUrl: daemonUrlOption(values, env),
    profile: textOption(values, "profile")
  };
}

function requiredThread(values: OpenValues): string {
  const thread = textOption(values, "thread");
  if (!thread) throw new OpenError("input_error", "thread_required");
  return thread;
}

/**
 * `marc diagnose`: one JSON line. Exit 0 prints the thread's diagnostic view, narrowed to one profile
 * when --profile is given. Exit 5 prints the reason when the daemon, its token or the thread cannot
 * answer. Nothing printed here carries the token.
 */
export async function runDiagnoseCommand(
  values: OpenValues,
  output: DiagnoseOutput,
  deps: DiagnoseDeps = productionDiagnoseDeps()
): Promise<number> {
  const result = await executeDiagnose(values, deps).then(
    (body) => ({ exitCode: 0, body }),
    (error: unknown) => ({
      exitCode: 5,
      body: { status: "error", reason: reasonOf(error) }
    })
  );
  output.print(JSON.stringify(result.body));
  return result.exitCode;
}

export function productionDiagnoseDeps(): DiagnoseDeps {
  return {
    env: process.env,
    daemonFiles: productionDaemonFiles,
    resolveThread: (workspaceRoot, requested) =>
      resolveThreadId(workspaceRoot, requested),
    call: (access, method, route) => callDaemon(access, method, route)
  };
}

async function executeDiagnose(
  values: OpenValues,
  deps: DiagnoseDeps
): Promise<ThreadDiagnostics> {
  const input = parseDiagnoseInput(values, deps.env, deps.daemonFiles);
  const threadId = await threadIdOf(input, deps);
  const info = workspaceInfoFor(input.workspaceRoot);
  const access = await accessOf(input, deps);
  const route = `/api/workspaces/${encodeURIComponent(info.id)}/threads/${encodeURIComponent(threadId)}/diagnostics`;
  const reply = await guard(
    () => deps.call(access, "GET", route),
    "daemon_unavailable",
    "daemon_unreachable"
  );
  return filterDiagnostics(bodyOf(reply), input.profile);
}

async function threadIdOf(
  input: DiagnoseInput,
  deps: DiagnoseDeps
): Promise<string> {
  const resolution = await guard(
    () => deps.resolveThread(input.workspaceRoot, input.requestedThread),
    "input_error",
    "thread_resolution_failed"
  );
  if (!resolution.ok) throw new OpenError("input_error", resolution.error.code);
  return resolution.threadId;
}

/** The daemon and its token, found as marc open finds them. A missing token stops before any call. */
async function accessOf(
  input: DiagnoseInput,
  deps: DiagnoseDeps
): Promise<DaemonAccess> {
  const found = await guard(
    () =>
      discoverDaemon(
        {
          explicitUrl: input.daemonUrl,
          dataDir: input.dataDir,
          fallbackToken: deps.env.MARC_TOKEN
        },
        deps.daemonFiles
      ),
    "daemon_unavailable",
    "daemon_state_unreadable"
  );
  if (found.token === undefined) {
    throw new OpenError("daemon_unavailable", "token_missing");
  }
  return { baseUrl: found.baseUrl, token: found.token };
}

/** The view of a 200 reply. Any other status is a refusal with its reason. */
function bodyOf(reply: DaemonReply): ThreadDiagnostics {
  if (reply.status === 200) return reply.body as ThreadDiagnostics;
  throw new OpenError(
    "daemon_unavailable",
    REFUSAL_REASONS[reply.status] ?? "daemon_error"
  );
}

/** Narrows the view to one profile: its slot and the records it wakes. Without a profile the view is whole. */
export function filterDiagnostics(
  view: ThreadDiagnostics,
  profile: string | undefined
): ThreadDiagnostics {
  if (profile === undefined) return view;
  return {
    ...view,
    slots: view.slots.filter((slot) => slot.profile === profile),
    reservations: view.reservations.filter(
      (item) => item.recipient === profile
    ),
    supervision: view.supervision.filter((card) => card.recipient === profile)
  };
}

function reasonOf(error: unknown): string {
  if (error instanceof OpenError) return error.reason;
  return "unexpected_error";
}
