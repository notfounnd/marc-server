import type { PausedDuringThread } from "./activation-pauses.js";
import type { FixedStage } from "./activation-stages.js";
import type { LeadChange } from "./activation-lead.js";

/**
 * The Activity section of a closed thread. The daemon builds the snapshot with a
 * whitelist of fields, and this module renders only those fields. Native session
 * ids, process ids and host ids never reach a snapshot, so they cannot reach SUMMARY.md.
 */
export type ActivityOrigin = "open" | "adopted" | "supervisor" | "none";

/**
 * "advanced" is the stage the thread left; "skipped" is a stage a move jumped over, which proves
 * nothing about the RULES phases; "not_reached" is a stage the thread never got to.
 */
export type StageOutcome =
  | "advanced"
  | "skipped"
  | "exhausted"
  | "open"
  | "not_reached";

export type ActivityProfile = {
  profile: string;
  role: string;
  origin: ActivityOrigin;
  startedAt?: string;
  lastSeenAt?: string;
  activations: number;
};

/** One of the three fixed stages. Legacy F3a history is never part of the section. */
export type ActivityStage = {
  id: FixedStage;
  cyclesUsed: number;
  max: number;
  outcome: StageOutcome;
};

/** One stage move, oldest first. `agentId` is a profile id, and only an agent move carries it. */
export type ActivityMove = {
  at: string;
  from: FixedStage;
  to: FixedStage;
  by: "human" | "agent";
  agentId?: string;
  droppedHolds: number;
};

/** One human change of the lead. Only the profile ids and the time reach the section. */
export type ActivityLeadChange = Pick<LeadChange, "at" | "from" | "to">;

/**
 * The supervisor's counts for the thread: turns it started, cards that failed, cards that expired, and the
 * estimated cost of its turns at API prices. The cost is an estimate, not a charge to the subscription.
 */
export type ActivitySupervision = {
  activations: number;
  failures: number;
  expired: number;
  costUsd: number;
};

export type ThreadActivitySnapshot = {
  threadId: string;
  profiles: ActivityProfile[];
  stages: ActivityStage[];
  /** Absent means none: a snapshot built before the stage history existed. */
  stageMoves?: ActivityMove[];
  /** Absent means none: a snapshot built before the lead changes existed. */
  leadChanges?: ActivityLeadChange[];
  /** Absent means none: a snapshot built before the supervisor existed. */
  supervision?: ActivitySupervision;
  policyRevision: string | null;
  /** Whether the workspace was paused during this thread's life: yes, never, or paused unknown. */
  pausedDuringThread: PausedDuringThread;
  conflicts: number;
};

/** "recorded" carries the snapshot; "unavailable" means the daemon could not be asked. */
export type ActivityRecord =
  | { status: "recorded"; snapshot: ThreadActivitySnapshot }
  | { status: "unavailable" };

export const UNAVAILABLE_LINE =
  "Activity not recorded: the daemon was unavailable at closure.";

const STAGE_LABEL: Record<FixedStage, string> = {
  planning: "Planning",
  execution: "Execution",
  review: "Review"
};

const OUTCOME_LABEL: Record<StageOutcome, string> = {
  advanced: "advanced",
  skipped: "skipped",
  exhausted: "exhausted",
  open: "open",
  not_reached: "not reached"
};

/**
 * The section for the summary header, or undefined when there is nothing to record. A
 * thread with no profile and no policy gets no section at all.
 */
export function renderActivitySection(
  record?: ActivityRecord
): string | undefined {
  if (!record) return undefined;
  if (record.status === "unavailable") return section([UNAVAILABLE_LINE]);
  if (!hasActivity(record.snapshot)) return undefined;
  return section(snapshotLines(record.snapshot));
}

export function hasActivity(snapshot: ThreadActivitySnapshot): boolean {
  return (
    snapshot.profiles.length > 0 ||
    snapshot.policyRevision !== null ||
    supervisionTotal(snapshot.supervision) > 0
  );
}

function supervisionTotal(counts: ActivitySupervision | undefined): number {
  if (counts === undefined) return 0;
  return counts.activations + counts.failures + counts.expired;
}

/** One line of counts, or nothing when the supervisor did nothing in this thread. No ids, pids or hosts. */
function supervisionLines(counts: ActivitySupervision | undefined): string[] {
  if (supervisionTotal(counts) === 0 || counts === undefined) return [];
  return [
    `Supervisor: ${counts.activations} activation(s), ${counts.failures} failure(s), ${counts.expired} expired card(s), estimated cost at API prices USD ${counts.costUsd.toFixed(4)}.`
  ];
}

function section(lines: string[]): string {
  return ["## Activity", "", ...lines].join("\n");
}

function snapshotLines(snapshot: ThreadActivitySnapshot): string[] {
  return [
    ...profileLines(snapshot.profiles),
    "",
    ...(snapshot.stages.length > 0 ? [...stageLines(snapshot.stages), ""] : []),
    ...optionalBlock(moveLines(snapshot.stageMoves ?? [])),
    ...optionalBlock(leadLines(snapshot.leadChanges ?? [])),
    ...optionalBlock(supervisionLines(snapshot.supervision)),
    finalLine(snapshot)
  ];
}

/** A table followed by a blank line, or nothing at all when there are no rows. */
function optionalBlock(lines: string[]): string[] {
  return lines.length > 0 ? [...lines, ""] : [];
}

function moveLines(moves: ActivityMove[]): string[] {
  if (moves.length === 0) return [];
  return table(
    ["At", "From", "To", "By", "Dropped holds"],
    moves.map((item) => [
      item.at,
      STAGE_LABEL[item.from],
      STAGE_LABEL[item.to],
      byLabel(item),
      String(item.droppedHolds)
    ])
  );
}

function byLabel(item: ActivityMove): string {
  if (item.by === "human") return "human";
  return `agent ${item.agentId ?? "-"}`;
}

function leadLines(changes: ActivityLeadChange[]): string[] {
  if (changes.length === 0) return [];
  return table(
    ["At", "From", "To"],
    changes.map((item) => [item.at, item.from, item.to])
  );
}

function profileLines(profiles: ActivityProfile[]): string[] {
  if (profiles.length === 0) return ["No profile was bound in this thread."];
  return table(
    ["Profile", "Role", "Origin", "Started", "Last seen", "Activations"],
    profiles.map((item) => [
      item.profile,
      item.role,
      item.origin,
      item.startedAt,
      item.lastSeenAt,
      String(item.activations)
    ])
  );
}

function stageLines(stages: ActivityStage[]): string[] {
  return table(
    ["Stage", "Cycles used", "Max cycles", "Outcome"],
    stages.map((item) => [
      STAGE_LABEL[item.id],
      String(item.cyclesUsed),
      String(item.max),
      OUTCOME_LABEL[item.outcome]
    ])
  );
}

function finalLine(snapshot: ThreadActivitySnapshot): string {
  const revision =
    snapshot.policyRevision === null
      ? "none"
      : `\`${snapshot.policyRevision}\``;
  const paused = snapshot.pausedDuringThread;
  return `Policy revision: ${revision}. Pause during the thread: ${paused}. Recorded conflicts: ${snapshot.conflicts}.`;
}

function table(
  headers: string[],
  rows: Array<Array<string | undefined>>
): string[] {
  return [
    tableRow(headers),
    tableRow(headers.map(() => "---")),
    ...rows.map((cells) => tableRow(cells))
  ];
}

function tableRow(cells: Array<string | undefined>): string {
  return `| ${cells.map(tableCell).join(" | ")} |`;
}

function tableCell(value: string | undefined): string {
  return (value ?? "-").replace(/\|/g, "\\|");
}
