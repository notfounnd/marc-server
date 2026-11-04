import { clientForModel } from "./core/agent-launch.js";
import type { AgentProfileSummary, WorkspaceInfo } from "./core/types.js";
import { guard, OpenError } from "./cli-open-output.js";

/**
 * Resolves the profile of a `marc open` before any daemon call. The profile must exist, must not
 * be the user role, and must run a supported client. A profile whose client is not supported is
 * refused here, so no slot is reserved and no client is launched, and --dry-run refuses the same way.
 */
export async function requireProfile(
  profiles: (info: WorkspaceInfo) => Promise<AgentProfileSummary[]>,
  info: WorkspaceInfo,
  profileId: string
): Promise<void> {
  const list = await guard(
    () => profiles(info),
    "input_error",
    "workspace_read_failed"
  );
  const profile = list.find((candidate) => candidate.id === profileId);
  if (!profile) throw new OpenError("input_error", "profile_unknown");
  if (profile.role === "user")
    throw new OpenError("input_error", "user_profile");
  if (clientForModel(profile.model) === undefined)
    throw new OpenError("input_error", "unsupported_client");
}
