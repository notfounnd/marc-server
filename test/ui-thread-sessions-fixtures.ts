import {
  nativeNewCommand,
  nativeResumeCommand
} from "../src/core/agent-launch.js";
import type {
  SessionBindingSummary,
  SessionDetails,
  SessionStateName,
  ThreadSessionSlot,
  ThreadSessionWarning,
  ThreadSessionsView,
  Translate
} from "../src/ui/types.js";
import type { ThreadSessionsState } from "../src/ui/use-thread-sessions.js";

/** A translate that substitutes {{name}} variables into the en-US key, so text is checked as shown. */
export const translate: Translate = (key, variables = {}) =>
  Object.entries(variables).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    key
  );

/** The data directory and the workspace path stand in for values the UI must never render. */
export const DATA_DIR = "/fixture/marc-data";
export const WORKSPACE = "/fixture/workspace";

/** The short marc open command: workspace, the thread's suffix, and the profile. */
export const OPEN_COMMAND = {
  argv: [
    "node",
    "marc",
    "open",
    "--workspace",
    WORKSPACE,
    "--thread",
    "134b5983",
    "--profile",
    "claude-dev"
  ],
  shell: `'node' 'marc' 'open' '--workspace' '${WORKSPACE}' '--thread' '134b5983' '--profile' 'claude-dev'`
};

export const OPEN_NEW_COMMAND = {
  argv: [...OPEN_COMMAND.argv, "--new"],
  shell: `${OPEN_COMMAND.shell} '--new'`
};

/** The native commands the Copy button copies. The UI shows neither text. */
export const NEW_TEXT = nativeNewCommand("thread-1", "claude-dev");
export const ARCHITECT_NEW_TEXT = nativeNewCommand(
  "thread-1",
  "claude-software-architect"
);
export const RESUME_TEXT = nativeResumeCommand(
  "7b29f3be-2d0c-456f-996a-ff29e6ee7922"
);

const QUIET: SessionDetails = {
  busy: false,
  listening: false,
  reason: "no_binding",
  pastConflict: false
};

const ADOPTED: SessionBindingSummary = {
  origin: "adopted",
  generation: 3,
  client: "claude-code",
  hostId: "host-a",
  boundAt: "2026-11-03T12:00:00.000Z",
  conflicts: []
};

const BASE_SLOT: ThreadSessionSlot = {
  profile: "claude-dev",
  role: "developer",
  state: "unbound",
  details: QUIET,
  sources: { agents: "available", mcpLease: false, listening: false },
  binding: null,
  profileHasMessages: false,
  openCommand: OPEN_COMMAND
};

/** Overrides replace fields of the base slot; the result is a complete typed slot. */
export function slot(overrides: Partial<ThreadSessionSlot>): ThreadSessionSlot {
  return { ...BASE_SLOT, ...overrides };
}

export const SLOT_BY_STATE: Record<SessionStateName, ThreadSessionSlot> = {
  unbound: slot({ copyCommand: { text: NEW_TEXT } }),
  online: slot({
    state: "online",
    details: { ...QUIET, busy: true, listening: true, reason: "owner_listed" },
    binding: ADOPTED,
    sources: { agents: "available", mcpLease: true, listening: true }
  }),
  reserved: slot({
    state: "reserved",
    details: { ...QUIET, reason: "reservation_active" },
    binding: { ...ADOPTED, origin: "open" }
  }),
  ended: slot({
    state: "ended",
    details: { ...QUIET, reason: "owner_absent" },
    binding: ADOPTED,
    copyCommand: { text: RESUME_TEXT }
  }),
  unknown: slot({
    state: "unknown",
    details: { ...QUIET, reason: "agents_unavailable" },
    sources: { agents: "unavailable", mcpLease: false, listening: false }
  }),
  conflict: slot({
    state: "conflict",
    details: { ...QUIET, reason: "recorded_conflict", pastConflict: true },
    binding: {
      ...ADOPTED,
      conflicts: [{ sessionId: "other", at: "2026-11-03T12:01:00.000Z" }]
    }
  })
};

export const POSTED_UNBOUND = slot({
  profile: "claude-software-architect",
  role: "architect",
  profileHasMessages: true,
  openCommand: OPEN_NEW_COMMAND,
  copyCommand: { text: ARCHITECT_NEW_TEXT }
});

export const WARNINGS: ThreadSessionWarning[] = [
  {
    kind: "pending_mention",
    profile: "claude-dev",
    messageIds: ["msg_aaa111"]
  },
  {
    kind: "chain_limit",
    length: 3,
    messageIds: ["msg_bbb222", "msg_ccc333"]
  },
  {
    kind: "awaiting_human",
    profile: "ui-user",
    messageIds: ["msg_ddd444"],
    askedBy: "claude-software-architect"
  }
];

export function viewOf(
  overrides: Partial<ThreadSessionsView>
): ThreadSessionsView {
  return { ...VIEW, ...overrides };
}

const VIEW: ThreadSessionsView = {
  registry: { status: "ready" },
  slots: [SLOT_BY_STATE.unbound],
  warnings: [],
  sources: { agents: "available", mcpLeases: 1, listening: "available" }
};

export const LOADING: ThreadSessionsState = { key: "ws:t", status: "loading" };

export function readyState(view: ThreadSessionsView): ThreadSessionsState {
  return { key: "ws:t", status: "ready", view };
}

export function errorState(reason: string): ThreadSessionsState {
  return { key: "ws:t", status: "error", reason };
}
