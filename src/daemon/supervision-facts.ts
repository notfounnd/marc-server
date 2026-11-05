import type {
  SlotFacts,
  SupervisionStatus
} from "../core/activation-supervision-types.js";
import { clientOf } from "../core/agent-launch.js";
import { adapterFor } from "../core/client-adapters.js";
import { RESERVATION_TTL_MS } from "../core/session-state.js";
import type { SessionBinding, SlotKey } from "../core/session-slots.js";
import type { WorkspaceInfo } from "../core/types.js";
import { listAgentProfiles } from "../core/workspace.js";
import type { SessionServices } from "./session-views.js";
import { probeFor } from "./session-views.js";
import type { SupervisionOptions } from "./supervision-runner.js";

/** The reason of a presence-dependent card while the daemon has not waited one lease TTL. */
export const CHECKING_SESSIONS = "checking_sessions";

/** Before this many milliseconds after the start, nothing that depends on presence is decided. */
export const PRESENCE_GRACE_MS = RESERVATION_TTL_MS;

/** The holder of a supervised reservation. It is stable per mention and recipient, so a retry reuses it. */
export function holderOf(messageId: string, recipient: string): string {
  return `supervisor:${messageId}:${recipient}`;
}

export function slotOf(
  workspace: WorkspaceInfo,
  threadId: string,
  profile: string
): SlotKey {
  return { workspaceId: workspace.id, threadId, profile };
}

/** True while the grace window after the daemon start is open, judged on the instant the caller reads. */
export function inGraceAt(options: SupervisionOptions, now: string): boolean {
  return Date.parse(now) < options.startedAt + PRESENCE_GRACE_MS;
}

/** The architect profiles that can be woken: the role, and a client with an adapter. Developers never are. */
export async function supportedArchitectsOf(
  workspace: WorkspaceInfo
): Promise<string[]> {
  const profiles = await listAgentProfiles(workspace.rootPath);
  return profiles
    .filter(
      (profile) =>
        profile.role === "architect" &&
        adapterFor(clientOf(profile)) !== undefined
    )
    .map((profile) => profile.id);
}

const UNBOUND: SlotFacts = {
  state: "unbound",
  details: {
    busy: false,
    listening: false,
    reason: "no_binding",
    pastConflict: false
  },
  sameHost: true,
  identityVerified: false
};

/**
 * The slot facts one judgment reads. It runs inside the thread's queue and only reads presence. An
 * occupant counts as identity-verified only when its process matches the owner's pid, start and session,
 * which is the owner_listed reason of the derived state.
 */
export async function slotFactsOf(
  sessions: SessionServices,
  workspace: WorkspaceInfo,
  binding: SessionBinding | undefined
): Promise<SlotFacts> {
  if (binding === undefined) return UNBOUND;
  const state = await probeFor(sessions, workspace)(binding);
  return {
    state: state.state,
    details: state.details,
    sameHost: binding.hostId === sessions.presence.hostId,
    identityVerified:
      state.state === "online" && state.details.reason === "owner_listed"
  };
}

/** The refusal every supervision route answers with. The status is the card's state, when there is one. */
export type Refused = {
  decision: "refused";
  reason: string;
  status?: SupervisionStatus;
};

export function refusedWith(
  reason: string,
  status?: SupervisionStatus
): Refused {
  return status === undefined
    ? { decision: "refused", reason }
    : { decision: "refused", reason, status };
}
