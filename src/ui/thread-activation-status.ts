import type {
  ActivationStageId,
  ActivationWarning,
  ThreadActivationView,
  Translate
} from "./types.js";

export type Tone = "muted" | "on" | "warn" | "stop";

/**
 * The footer line that a save clears the approvals the panel shows. The singular and the plural have
 * their own en-US keys, so the catalog holds each sentence as written.
 */
export function approvalWarningOf(count: number, t: Translate): string {
  if (count === 1) return t("Saving clears the approval of 1 agent.");
  return t("Saving clears the approval of {{count}} agents.", { count });
}

/** A line the policy editor shows: its tone, and the en-US message key it translates. */
export type Line = { tone: Tone; key: string };

export function isEnabled(view: ThreadActivationView): boolean {
  return view.enabled;
}

/** The thread state counts fewer cycles than its stamped messages: it was restored from an older copy. */
export function isRestored(view: ThreadActivationView): boolean {
  return view.warnings.includes("ledger_restored");
}

/** Someone waits for the human: a stage used all its cycles, or a reservation is held. */
export function isWaiting(view: ThreadActivationView): boolean {
  if (view.warnings.includes("budget_exhausted")) return true;
  return (view.holds ?? []).length > 0;
}

/** The status pill: the first rule that holds wins. The label is a message key. */
const PILL_RULES: ReadonlyArray<{
  test: (view: ThreadActivationView) => boolean;
  label: string;
  tone: Tone;
}> = [
  {
    test: (view) => view.policyState === "invalid",
    label: "Unreadable policy",
    tone: "warn"
  },
  { test: (view) => !isEnabled(view), label: "Off", tone: "muted" },
  { test: (view) => isRestored(view), label: "Paused", tone: "stop" },
  { test: (view) => view.threadPaused, label: "Paused", tone: "warn" },
  { test: (view) => isWaiting(view), label: "Waiting for you", tone: "warn" },
  { test: () => true, label: "On", tone: "on" }
];

export function pillOf(view: ThreadActivationView): Line {
  const rule = PILL_RULES.find((item) => item.test(view));
  return { tone: rule?.tone ?? "muted", key: rule?.label ?? "Off" };
}

/**
 * Dispatch table: the note under the switch, by its position. The on state explains the approval of F4:
 * the first start of each agent asks, and the later starts in the thread follow within the cycles.
 */
const STATUS_NOTES: Record<string, string | undefined> = {
  true: "Each agent's first start asks for your approval. After that it starts on its own in this thread, within the cycles.",
  false:
    "Agents wake only when you ask them. Turn this on to let a mention wake the agent it names."
};

export function statusNoteKeyOf(enabled: boolean): string | undefined {
  return STATUS_NOTES[String(enabled)];
}

/** Budget warnings, shown in the current stage section. */
const STAGE_LINES: Partial<Record<ActivationWarning, Line>> = {
  budget_last_cycle: { tone: "warn", key: "One cycle left in this stage." },
  budget_exhausted: {
    tone: "warn",
    key: "This stage used all its cycles. Add cycles or advance."
  }
};

/** Fail-closed lines: what happened and what to do. Each shows once, in the order of the view. */
const FAULT_LINES: Partial<Record<ActivationWarning, Line>> = {
  revision_mismatch: {
    tone: "warn",
    key: "Saved policy changed outside mARC. Save again to authorize it."
  },
  policy_tampered: {
    tone: "warn",
    key: "The saved policy file was edited by hand. Save again to authorize it."
  },
  settings_tampered: {
    tone: "warn",
    key: "The cycles setting was edited by hand. Save the setting again in workspace settings to authorize it."
  },
  policy_outdated: {
    tone: "warn",
    key: "Save the policy again to use the new stages."
  },
  ledger_lost: {
    tone: "stop",
    key: "The thread state file is missing, so nothing is authorized. Recover the state, then save again."
  },
  ledger_invalid: {
    tone: "stop",
    key: "The thread state file cannot be read. Recover the state, then save again."
  },
  ledger_restored: {
    tone: "stop",
    key: "The thread state counts fewer cycles than the messages show. It may have been restored from an older copy. Recover to continue."
  }
};

const PAUSED_LINE: Line = {
  tone: "warn",
  key: "Activations are paused in this workspace on this machine. Mentions are recorded but nobody is woken."
};

const UNREADABLE_LINE: Line = {
  tone: "stop",
  key: "The saved policy file cannot be read. Save a new policy to replace it."
};

function lineOf(line: Line | undefined): Line[] {
  return line ? [line] : [];
}

export function stageLinesOf(view: ThreadActivationView): Line[] {
  return view.warnings.flatMap((warning) => lineOf(STAGE_LINES[warning]));
}

export function faultLinesOf(view: ThreadActivationView): Line[] {
  const warned = view.warnings.flatMap((warning) =>
    lineOf(FAULT_LINES[warning])
  );
  const paused = view.paused === true ? [PAUSED_LINE] : [];
  const unreadable = view.policyState === "invalid" ? [UNREADABLE_LINE] : [];
  return [...warned, ...paused, ...unreadable];
}

/** The states the Recover action repairs: lost or invalid files, and a restored state. */
const RECOVERABLE: readonly ActivationWarning[] = [
  "ledger_lost",
  "ledger_invalid",
  "ledger_restored"
];

export function isRecoverable(view: ThreadActivationView): boolean {
  return view.warnings.some((warning) => RECOVERABLE.includes(warning));
}

/** Dispatch table: the confirm note of Recover. A restored state raises counts and moves no file. */
const RECOVER_NOTE_RULES: ReadonlyArray<{
  test: (view: ThreadActivationView) => boolean;
  key: string;
}> = [
  {
    test: (view) => isRestored(view),
    key: "Raises each stage's cycle count to the highest cycle already stamped in the messages. No count goes down."
  },
  {
    test: () => true,
    key: "Moves invalid state files aside and recreates the missing ones. Enabled policies stay blocked until you save them again."
  }
];

export function recoverNoteKeyOf(view: ThreadActivationView): string {
  const rule = RECOVER_NOTE_RULES.find((item) => item.test(view));
  return rule?.key ?? "";
}

/** The stage section is hidden while the state is restored: its counts are not trusted yet. */
export function showsStageOf(view: ThreadActivationView): boolean {
  if (!isEnabled(view)) return false;
  if (view.budget === null) return false;
  return !isRestored(view);
}

/** The stages strictly ahead of the current one: where a human advance can go. */
export function advanceChoicesOf(
  view: ThreadActivationView
): ActivationStageId[] {
  return view.nextStages ?? [];
}

/** Dispatch table: the line that names the reservations a stage change drops. */
const DROP_RULES: ReadonlyArray<{
  test: (waiting: number) => boolean;
  key: string;
}> = [
  {
    test: (waiting) => waiting === 1,
    key: "1 waiting activation will be dropped. Mention the agent again in the new stage to continue."
  },
  {
    test: (waiting) => waiting > 1,
    key: "{{waiting}} waiting activations will be dropped. Mention the agents again in the new stage to continue."
  }
];

export function dropLineOf(waiting: number): string | undefined {
  const rule = DROP_RULES.find((item) => item.test(waiting));
  return rule?.key;
}

/** Every message key of this module, for the catalog test. Table keys are not literal t() calls. */
export const STATUS_LABEL_KEYS: string[] = [
  ...PILL_RULES.map((rule) => rule.label),
  ...Object.values(STATUS_NOTES).filter(
    (key): key is string => key !== undefined
  ),
  ...Object.values(STAGE_LINES).map((line) => line?.key ?? ""),
  ...Object.values(FAULT_LINES).map((line) => line?.key ?? ""),
  ...RECOVER_NOTE_RULES.map((rule) => rule.key),
  ...DROP_RULES.map((rule) => rule.key),
  PAUSED_LINE.key,
  UNREADABLE_LINE.key,
  "Saving clears the approval of 1 agent.",
  "Saving clears the approval of {{count}} agents."
];
