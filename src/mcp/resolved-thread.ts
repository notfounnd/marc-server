import { toolError, withBootstrap } from "./responses.js";
import { resolveThreadId } from "./thread-resolution.js";

/**
 * Runs a thread tool on the canonical thread ID. The bootstrap gate comes first, so a missing
 * bootstrap never resolves a thread.
 */
export async function withResolvedThread<Result>(
  input: { threadId: string; bootstrapConfirmed?: boolean },
  workspaceRoot: string,
  read: (threadId: string) => Promise<Result>
) {
  if (input.bootstrapConfirmed !== true) {
    return withBootstrap(input, async () => undefined);
  }

  const resolution = await resolveThreadId(workspaceRoot, input.threadId);
  if (!resolution.ok) {
    return toolError(
      resolution.error.code,
      resolution.error.message,
      resolution.error.details
    );
  }

  return withBootstrap(input, async () => read(resolution.threadId));
}
