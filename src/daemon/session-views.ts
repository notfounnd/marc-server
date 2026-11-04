import { marcDir } from "../core/paths.js";
import {
  deriveSlotState,
  slotKey,
  type PresenceSources,
  type BindingConflict,
  type SessionBinding,
  type SlotDetails,
  type SlotState,
  type SlotStateName
} from "../core/session-slots.js";
import {
  deriveSessionWarnings,
  type SessionWarning
} from "../core/session-warnings.js";
import type { MarcCommand, MarcRuntime } from "../mcp/listening-command.js";
import type {
  AgentProfileSummary,
  ChatMessage,
  DaemonLease,
  WorkspaceInfo
} from "../core/types.js";
import { listAgentProfiles, readThread } from "../core/workspace.js";
import type { SessionPresence } from "./presence.js";
import type { RegistryView } from "./session-file.js";
import type { SessionProbe, SessionRegistry } from "./session-registry.js";
import { launchPart } from "./session-launch.js";

export { openCommandFor } from "./session-launch.js";

/**
 * Builds the read-only thread sessions view and the probe that acquire and
 * observe decisions share. Both derive state the same way, so they agree.
 * dataDir is the absolute daemon data directory, and daemonUrl is the address the daemon
 * listens on. The commands name both, so they open the daemon that produced them.
 * marcRuntime is the runtime the short `marc open` command starts from. Production reads this
 * process; tests fix it, so the command does not depend on how the test runner was started.
 */
export type SessionServices = {
  registry: SessionRegistry;
  presence: SessionPresence;
  leases: Map<string, DaemonLease>;
  dataDir: string;
  daemonUrl: () => string;
  marcRuntime: () => MarcRuntime;
};

/** What the open command needs from the services, so it can be built without a registry. */
export type OpenServices = Pick<
  SessionServices,
  "dataDir" | "daemonUrl" | "marcRuntime"
>;

type BindingSummary = {
  origin: SessionBinding["origin"];
  generation: number;
  client: SessionBinding["client"];
  hostId: string;
  boundAt: string;
  endedAt?: string;
  conflicts: BindingConflict[];
};

export type SlotView = {
  profile: string;
  role?: string;
  state: SlotStateName;
  details: SlotDetails;
  sources: {
    agents: "available" | "unavailable";
    mcpLease: boolean;
    listening: boolean;
  };
  binding: BindingSummary | null;
  /** True when a message in this thread names this profile as its author, linked or not. */
  profileHasMessages: boolean;
  /**
   * The short `marc open` command. It is the CLI path that takes the ownership. An unbound slot
   * whose profile already posted carries --new, the one case `marc open` refuses without it.
   * Absent for a client that is not supported, so no path starts that session.
   */
  openCommand?: MarcCommand;
  /** The native Claude command the UI copies. Only an ended or an unbound slot has one. */
  copyCommand?: { text: string };
  /** Why Copy is disabled by the client rather than the state. Only unsupported_client today. */
  copyBlockedReason?: "unsupported_client";
};

type SlotViewInput = {
  profile: AgentProfileSummary;
  state: SlotState;
  sources: PresenceSources;
  posted: boolean;
  binding?: SessionBinding;
};

type SlotEntry = { bound: boolean; view: SlotView };

export async function buildThreadSessionsView(
  services: SessionServices,
  workspace: WorkspaceInfo,
  threadId: string
) {
  const thread = await readThread(workspace.rootPath, threadId);
  const messages: ChatMessage[] = thread.messages ?? [];
  const profiles = await listAgentProfiles(workspace.rootPath);
  const registry = await services.registry.read();
  // One view reads the runtime once, so the PATH scan is not repeated for every slot.
  const runtime = services.marcRuntime();
  const viewServices = { ...services, marcRuntime: () => runtime };
  const entries = await Promise.all(
    profiles
      .filter((profile) => profile.role !== "user")
      .map((profile) =>
        slotEntry(
          viewServices,
          workspace,
          threadId,
          profile,
          registry,
          messages
        )
      )
  );
  const warnings: SessionWarning[] = deriveSessionWarnings({
    messages,
    profiles
  });
  const agents = await services.presence.agents();
  const leases = services.presence.mcpLeases(
    services.leases.values(),
    workspace.id
  );
  return {
    registry: registryStatus(registry),
    slots: entries.sort(byBoundFirst).map((entry) => entry.view),
    warnings,
    sources: {
      agents: agents.status,
      mcpLeases: leases.length,
      listening: "available"
    }
  };
}

/** The same derivation serves the GET view and the acquire and observe decisions. */
export function probeFor(
  services: SessionServices,
  workspace: WorkspaceInfo
): SessionProbe {
  return async (binding) =>
    deriveSlotState(
      binding,
      await sourcesFor(services, workspace, binding),
      services.presence.now()
    );
}

async function slotEntry(
  services: SessionServices,
  workspace: WorkspaceInfo,
  threadId: string,
  profile: AgentProfileSummary,
  registry: RegistryView,
  messages: readonly ChatMessage[]
): Promise<SlotEntry> {
  const posted = hasPosted(messages, profile.id);
  if (registry.status === "invalid") {
    const sources = await sourcesFor(services, workspace);
    const state: SlotState = {
      state: "unknown",
      details: {
        busy: false,
        listening: false,
        reason: "registry_invalid",
        pastConflict: false
      }
    };
    return {
      bound: false,
      view: slotView(services, workspace, threadId, {
        profile,
        state,
        sources,
        posted
      })
    };
  }
  const key = slotKey({
    workspaceId: workspace.id,
    threadId,
    profile: profile.id
  });
  const binding = registry.file.slots[key];
  const sources = await sourcesFor(services, workspace, binding);
  const state = deriveSlotState(binding, sources, services.presence.now());
  return {
    bound: binding !== undefined,
    view: slotView(services, workspace, threadId, {
      profile,
      state,
      sources,
      posted,
      binding
    })
  };
}

/** A profile posted here when any message in the thread carries its agent id. */
function hasPosted(messages: readonly ChatMessage[], profile: string): boolean {
  return messages.some((message) => message.agentId === profile);
}

function slotView(
  services: SessionServices,
  workspace: WorkspaceInfo,
  threadId: string,
  input: SlotViewInput
): SlotView {
  const { profile, state, sources, posted, binding } = input;
  return {
    profile: profile.id,
    role: profile.role,
    state: state.state,
    details: state.details,
    sources: {
      agents: sources.agents.status,
      mcpLease: sources.mcpLeases.some(
        (lease) => lease.nativeSessionId === binding?.nativeSessionId
      ),
      listening: state.details.listening
    },
    binding: binding ? summarize(binding) : null,
    profileHasMessages: posted,
    ...launchPart(services, workspace, threadId, input)
  };
}

/** The owner token is never summarized, so it cannot reach a GET response. */
function summarize(binding: SessionBinding): BindingSummary {
  return {
    origin: binding.origin,
    generation: binding.generation,
    client: binding.client,
    hostId: binding.hostId,
    boundAt: binding.boundAt,
    endedAt: binding.endedAt,
    conflicts: binding.conflicts
  };
}

async function sourcesFor(
  services: SessionServices,
  workspace: WorkspaceInfo,
  binding?: SessionBinding
): Promise<PresenceSources> {
  const listening = await listeningFor(services, workspace, binding);
  return {
    hostId: services.presence.hostId,
    agents: await services.presence.agents(),
    mcpLeases: services.presence.mcpLeases(
      services.leases.values(),
      workspace.id
    ),
    listening
  };
}

async function listeningFor(
  services: SessionServices,
  workspace: WorkspaceInfo,
  binding?: SessionBinding
): Promise<boolean> {
  if (!binding) return false;
  return services.presence.listening(
    marcDir(workspace.rootPath),
    binding.threadId,
    binding.nativeSessionId
  );
}

function byBoundFirst(left: SlotEntry, right: SlotEntry): number {
  const bound = Number(right.bound) - Number(left.bound);
  if (bound !== 0) return bound;
  return left.view.profile.localeCompare(right.view.profile);
}

function registryStatus(view: RegistryView): {
  status: "ready" | "invalid";
  reason?: string;
} {
  if (view.status === "ready") return { status: "ready" };
  return { status: "invalid", reason: view.reason };
}
