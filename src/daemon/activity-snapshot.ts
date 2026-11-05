import { DEFAULT_CYCLES_PER_STAGE } from "../core/activation-cycles.js";
import { readThreadPolicy } from "../core/activation-policy-store.js";
import {
  pausedDuringThread,
  type PauseHistory,
  type PausedDuringThread
} from "../core/activation-pauses.js";
import type { StageHistoryEntry } from "../core/activation-advance.js";
import type { LeadChange } from "../core/activation-lead.js";
import {
  FIXED_STAGES,
  isFixedStage,
  isJumpedBy,
  type FixedStage
} from "../core/activation-stages.js";
import type { SessionBinding } from "../core/session-slots.js";
import { supervisionCountsOf } from "./supervision-views.js";
import {
  type ActivityLeadChange,
  type ActivityMove,
  type ActivityOrigin,
  type ActivityProfile,
  type ActivityStage,
  type StageOutcome,
  type ThreadActivitySnapshot
} from "../core/thread-activity-markdown.js";
import { listAgentProfiles, readThread } from "../core/workspace.js";
import type { ChatMessage, WorkspaceInfo } from "../core/types.js";
import { cyclesCountersOf } from "./activation-activity.js";
import type { ThreadFile, ThreadScope, ThreadStore } from "./thread-store.js";
import type { WorkspaceStore, WorkspaceView } from "./workspace-store.js";

/**
 * The retrato of one thread's activity, built field by field. Native session ids, process
 * ids, host ids and owner tokens are never copied, so they cannot leave the daemon through
 * this route. Returns undefined when the thread's state is invalid or lost.
 *
 * The pause status is answered for the thread's own life: from the earlier of its creation
 * in the thread (CHAT.md) and the daemon's state file, until the moment of this snapshot.
 */
export async function buildThreadActivity(input: {
  workspace: WorkspaceInfo;
  threadId: string;
  threadCreatedAt: string;
  threads: ThreadStore;
  workspaces: WorkspaceStore;
  now?: () => string;
}): Promise<ThreadActivitySnapshot | undefined> {
  const scope: ThreadScope = {
    workspaceId: input.workspace.id,
    threadId: input.threadId
  };
  const view = await input.threads.read(scope);
  if (view.status === "invalid") return undefined;
  const profiles = await listAgentProfiles(input.workspace.rootPath);
  const messages = await postedMessages(input.workspace, input.threadId);
  const policy = await readThreadPolicy(input.workspace, input.threadId);
  const bindings = Object.values(view.file.slots);
  const closedAt = input.now ? input.now() : new Date().toISOString();
  const threadStart = earlierOf(input.threadCreatedAt, view.file.createdAt);
  const workspaceView = await input.workspaces.read(input.workspace.id);
  return {
    threadId: input.threadId,
    profiles: profileRows(profiles, bindings, messages),
    stages: stageRows(view.file, cyclesPerStageOf(workspaceView)),
    stageMoves: moveRows(view.file.stageHistory ?? []),
    leadChanges: leadRows(view.file.leadChanges ?? []),
    supervision: supervisionCountsOf(view.file.supervision),
    policyRevision: policy.status === "ready" ? policy.policy.revision : null,
    pausedDuringThread: pauseStatusOf(workspaceView, threadStart, closedAt),
    conflicts: bindings.reduce(
      (sum, binding) => sum + binding.conflicts.length,
      0
    )
  };
}

async function postedMessages(
  workspace: WorkspaceInfo,
  threadId: string
): Promise<ChatMessage[]> {
  const thread = await readThread(workspace.rootPath, threadId, {
    includeSummary: false,
    includeMarkdown: false
  });
  return thread.messages ?? [];
}

/** The earlier of two ISO times. The thread's life starts no later than either record says. */
export function earlierOf(first: string, second: string | undefined): string {
  if (second === undefined) return first;
  return Date.parse(second) < Date.parse(first) ? second : first;
}

type ProfileSummary = { id: string; role?: string };

/** Profiles that hold a session in this thread or have posted in it. The user is never listed. */
function profileRows(
  profiles: readonly ProfileSummary[],
  bindings: readonly SessionBinding[],
  messages: readonly ChatMessage[]
): ActivityProfile[] {
  return profiles
    .filter((profile) => profile.role !== "user")
    .flatMap((profile) => {
      const binding = bindings.find((item) => item.profile === profile.id);
      const posted = messages.some((message) => message.agentId === profile.id);
      if (!binding && !posted) return [];
      return [
        {
          profile: profile.id,
          role: profile.role ?? "-",
          origin: originOf(binding),
          startedAt: binding?.boundAt,
          lastSeenAt: lastSeenOf(binding),
          activations: 0
        }
      ];
    });
}

function originOf(binding: SessionBinding | undefined): ActivityOrigin {
  return binding ? binding.origin : "none";
}

function lastSeenOf(binding: SessionBinding | undefined): string | undefined {
  if (!binding) return undefined;
  const seen = [binding.observedAt, binding.owner.lastHeartbeatAt].filter(
    (value): value is string => value !== undefined
  );
  return seen.sort().at(-1);
}

/** The three fixed stages with cycles used and the effective maximum. F3a history is not shown. */
function stageRows(file: ThreadFile, cyclesPerStage: number): ActivityStage[] {
  const activation = file.activation;
  if (!activation) return [];
  const moves = file.stageHistory ?? [];
  const current = isFixedStage(activation.currentStage)
    ? activation.currentStage
    : FIXED_STAGES[0];
  return FIXED_STAGES.map((stage: FixedStage) => {
    const counters = cyclesCountersOf(activation.stages[stage]);
    const max = cyclesPerStage + grantedOf(counters.extensions);
    return {
      id: stage,
      cyclesUsed: counters.cyclesUsed,
      max,
      outcome: outcomeOf(stage, current, moves, counters.cyclesUsed, max)
    };
  });
}

/** The stage moves, oldest first, with only the fields the section shows. Native ids never reach here. */
function moveRows(history: readonly StageHistoryEntry[]): ActivityMove[] {
  return history.map((entry) => ({
    at: entry.at,
    from: entry.from,
    to: entry.to,
    by: entry.by,
    ...(entry.agentId === undefined ? {} : { agentId: entry.agentId }),
    droppedHolds: entry.droppedHolds
  }));
}

/** The lead changes, oldest first: the time and the profile ids only. */
function leadRows(changes: readonly LeadChange[]): ActivityLeadChange[] {
  return changes.map((change) => ({
    at: change.at,
    ...(change.from === undefined ? {} : { from: change.from }),
    to: change.to
  }));
}

function grantedOf(extensions: Array<{ cycles: number }>): number {
  return extensions.reduce((sum, grant) => sum + grant.cycles, 0);
}

/** The authorized cycles per stage. Without a recorded authorization, the default applies. */
function cyclesPerStageOf(workspaceView: WorkspaceView): number {
  if (workspaceView.status === "invalid") return DEFAULT_CYCLES_PER_STAGE;
  return (
    workspaceView.file.cyclesAuthorization?.cyclesPerStage ??
    DEFAULT_CYCLES_PER_STAGE
  );
}

/**
 * The outcome of one stage, read from the moves. The current stage is exhausted or still open. A
 * stage a move left is advanced. A stage a move jumped over is skipped, which claims no completion.
 * Any other stage was never reached. A stage without a recorded move is never called advanced.
 */
function outcomeOf(
  stage: FixedStage,
  current: FixedStage,
  moves: readonly StageHistoryEntry[],
  used: number,
  max: number
): StageOutcome {
  if (stage === current) return used >= max ? "exhausted" : "open";
  if (moves.some((move) => move.from === stage)) return "advanced";
  if (moves.some((move) => isJumpedBy(move.from, move.to, stage))) {
    return "skipped";
  }
  return "not_reached";
}

/** An unreadable pause history cannot answer the question, so the answer is "paused unknown". */
function pauseStatusOf(
  view: WorkspaceView,
  threadStart: string,
  closedAt: string
): PausedDuringThread {
  if (view.status === "invalid") return "paused unknown";
  const history: PauseHistory = {
    intervals: view.file.pauseHistory ?? [],
    completeSince: view.file.historyCompleteSince
  };
  return pausedDuringThread({ history, threadStart, closedAt });
}
