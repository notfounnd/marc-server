import {
  clientForModel,
  copyCommandFor,
  type CopyContext
} from "../core/agent-launch.js";
import type {
  SessionBinding,
  SlotState,
  SlotStateName
} from "../core/session-slots.js";
import type { AgentProfileSummary, WorkspaceInfo } from "../core/types.js";
import {
  buildOpenCommand,
  type MarcCommand
} from "../mcp/listening-command.js";
import { DEFAULT_DAEMON_URL } from "./config.js";
import type { OpenServices } from "./session-views.js";

/**
 * The launch part of a slot view: the short `marc open` command and the native Copy command. A
 * profile whose client is not supported gets neither, only the reason its Copy is blocked, so no
 * open path starts that session. It is split from session-views.ts to keep that module in budget.
 */
export type LaunchPart = {
  openCommand?: MarcCommand;
  copyCommand?: { text: string };
  copyBlockedReason?: "unsupported_client";
};

export type LaunchInput = {
  profile: AgentProfileSummary;
  state: SlotState;
  posted: boolean;
  binding?: SessionBinding;
};

/** The short `marc open` command of a slot. --new is set for an unbound slot whose profile already posted. */
export function openCommandFor(
  services: OpenServices,
  workspace: WorkspaceInfo,
  threadId: string,
  profile: string,
  newSession: boolean
): MarcCommand {
  return buildOpenCommand({
    runtime: services.marcRuntime(),
    workspaceRoot: workspace.rootPath,
    threadId,
    profile,
    dataDir: services.dataDir,
    daemonUrl: services.daemonUrl(),
    defaultDaemonUrl: DEFAULT_DAEMON_URL,
    newSession
  });
}

/** Only a profile whose client is supported gets commands; the client comes from its model. */
export function launchPart(
  services: OpenServices,
  workspace: WorkspaceInfo,
  threadId: string,
  input: LaunchInput
): LaunchPart {
  const { profile, state, posted, binding } = input;
  if (clientForModel(profile.model) === undefined) {
    return { copyBlockedReason: "unsupported_client" };
  }
  return {
    openCommand: openCommandFor(
      services,
      workspace,
      threadId,
      profile.id,
      state.state === "unbound" && posted
    ),
    ...copyPart(state.state, threadId, profile.id, binding)
  };
}

function copyPart(
  state: SlotStateName,
  threadId: string,
  profile: string,
  binding: SessionBinding | undefined
): { copyCommand?: { text: string } } {
  const context: CopyContext = {
    threadId,
    profile,
    nativeSessionId: binding?.nativeSessionId
  };
  const copy = copyCommandFor(state, context);
  if (copy === undefined) return {};
  return { copyCommand: copy };
}
