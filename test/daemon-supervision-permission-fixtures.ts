import type { ProcessTableRead } from "../src/core/process-table.js";
import type { SessionBinding } from "../src/core/session-slots.js";
import type {
  PermissionTarget,
  SupervisionRunner
} from "../src/daemon/supervision-runner.js";
import {
  editState,
  isoOf,
  SECOND,
  slotKeyOf,
  type Thread
} from "./daemon-supervision-fixtures.js";

export const RUN = "run-7";
export const TURN_PID = 4242;
export const MCP_PID = 5000;
/** The owner token the seeded binding and the target share. */
export const OWNER_TOKEN = "owner-1";

/** A create body of a request the turn's direct child sends, for the tool that is the turn's own. */
export const VALID_BODY = {
  pid: MCP_PID,
  ppid: TURN_PID,
  toolName: "Write",
  input: { file_path: "a.txt", content: "A" },
  toolUseId: "toolu_1"
};

/** The live turn of a thread: its process is the turn pid, and it holds the thread's supervisor slot. */
export function targetOf(thread: Thread): PermissionTarget {
  return {
    workspaceId: thread.info.id,
    threadId: thread.threadId,
    pid: TURN_PID,
    startedAt: undefined,
    slot: {
      workspaceId: thread.info.id,
      threadId: thread.threadId,
      profile: SECOND
    },
    generation: 1,
    ownerToken: OWNER_TOKEN
  };
}

/** The target a run has, by the state of the run: live, or not live at all. */
export const TARGET_BY_STATE: Record<
  "live" | "absent",
  (thread: Thread) => PermissionTarget | undefined
> = {
  live: targetOf,
  absent: () => undefined
};

/** A runner that answers the target of the test and records nothing else. */
export function runnerOf(
  target: () => PermissionTarget | undefined
): SupervisionRunner {
  return {
    start: () => undefined,
    permissionTarget: () => target()
  };
}

export function rowsOf(
  rows: { pid: number; ppid: number }[]
): ProcessTableRead {
  return { status: "available", rows };
}

/** The table where the MCP process is a direct child of the turn. */
export const TABLE_CHILD: ProcessTableRead = rowsOf([
  { pid: MCP_PID, ppid: TURN_PID }
]);

/**
 * Writes the slot binding the run holds, as the supervisor's approval leaves it: origin supervisor,
 * generation 1, owned by OWNER_TOKEN, not ended. The overrides replace single fields for the refusal rows.
 */
export async function seedBinding(
  thread: Thread,
  overrides: Partial<SessionBinding> = {}
): Promise<void> {
  const at = isoOf(thread.clock.ms);
  await editState(thread, (file) => {
    file.slots[slotKeyOf(thread)] = {
      workspaceId: thread.info.id,
      threadId: thread.threadId,
      profile: SECOND,
      client: "claude-code",
      nativeSessionId: "seeded-session",
      hostId: "supervision-host",
      origin: "supervisor",
      generation: 1,
      owner: { ownerToken: OWNER_TOKEN, reservedAt: at },
      boundAt: at,
      conflicts: [],
      ...overrides
    };
  });
}

/** Removes the slot binding of the thread: the run holds nothing. */
export async function dropBinding(thread: Thread): Promise<void> {
  await editState(thread, (file) => {
    delete file.slots[slotKeyOf(thread)];
  });
}
