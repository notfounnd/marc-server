import type { ActivationSupervisionCard } from "./activation-supervision-view.js";

export type Workspace = {
  id: string;
  name: string;
  rootPath: string;
  marcPath: string;
};

export type Thread = {
  id: string;
  title: string;
  path: string;
  createdAt: string;
  status: "open" | "closed";
  closedAt?: string;
  summaryPath?: string;
};

export type Agent = {
  id: string;
  markdown: string;
};

export type Message = {
  id: string;
  threadId: string;
  timestamp: string;
  agentId: string;
  role?: string;
  stage?: string;
  cycle?: number;
  body: string;
  artifacts: string[];
};

export type ThreadPayload = {
  markdown?: string;
  messages?: Message[];
  summary?: string;
  messageCount: number;
  lastMessageId?: string;
  updatedAt?: string;
};

export type ThreadIndexHealth = {
  status: "ready" | "rebuilding" | "degraded" | "unavailable";
  rebuilding: boolean;
  lastRebuildAt?: string;
  lastError: string | null;
  threadCount: number;
};

export type MemoryIndexHealth = {
  status:
    | "ready"
    | "missing"
    | "stale"
    | "model_missing"
    | "incompatible"
    | "preparing"
    | "rebuilding"
    | "degraded";
  ready: boolean;
  stale: boolean;
  modelPrepared: boolean;
  retrieverPrepared: boolean;
  rerankerPrepared: boolean;
  interpreterPrepared: boolean;
  rebuildReady: boolean;
  searchReady: boolean;
  summaryCount: number;
  indexedSummaryCount: number;
  preparing: boolean;
  rebuilding: boolean;
  lastPreparedAt?: string;
  lastRebuildAt?: string;
  lastError: string | null;
  autoRebuild: boolean;
  embeddingBatchSize: number;
  maintenance?: {
    models: Array<{
      active: boolean;
      bytes: number;
      model: string;
      prepared: boolean;
      role: "interpreter" | "retriever" | "reranker" | "unused";
      variant: string;
    }>;
    recoverableBytes: number;
    usedBytes: number;
  };
  message: string;
};

/** Heuristic confidence band of a hit. It orders the results; it is not a probability. */
export type MemoryBand = "high" | "medium" | "low";

/** A thread group carries `threadId` and `summaryPath`; a rules or document group carries neither. */
export type MemoryRecallHit = {
  groupId?: string;
  threadId?: string;
  title: string;
  closedAt?: string;
  summaryPath?: string;
  reference: string;
  matchedText: string;
  score: number;
  reason: string;
  band: MemoryBand;
};

export type MemoryRecallResult = {
  query: string;
  interpretation: MemoryQueryInterpretation;
  indexStatus: MemoryIndexHealth;
  results: MemoryRecallHit[];
  nextActions: string[];
  /** True only when the search ran and admitted no thread. */
  abstained: boolean;
};

export type MemoryQueryInterpretation = {
  originalQuery: string;
  effectiveQuery: string;
  suggestedQuery?: string;
  mode: "auto" | "literal";
  correctionApplied: boolean;
};

export type MemorySearchStatus = "idle" | "searching" | "error";

export type DaemonStatus = {
  ok: boolean;
  modules?: {
    threadIndex?: {
      workspaces?: Record<string, ThreadIndexHealth>;
    };
    memory?: {
      workspaces?: Record<string, MemoryIndexHealth>;
    };
  };
};

export type StatusKind = "idle" | "ok" | "warn" | "error";

export type MiddleMode = "threads" | "marckers" | "archive" | "search";

export type MarkdownLinkHandler = (href: string) => void | Promise<void>;

export type ArtifactDraft = {
  message: Message;
  fileName: string;
  content: string;
};

export type ArtifactView = {
  threadId: string;
  messageId: string;
  artifact: string;
  content: string;
};

export type ArtifactMenuItem = {
  message: Message;
  artifact: string;
  href: string;
};

export type ApiGet = <T>(path: string) => Promise<T>;

/** The translate function a presentational sessions component receives from its container. */
export type Translate = (
  key: string,
  variables?: Record<string, string | number>
) => string;

/** Mirrors the daemon session view. The UI reads it and never acquires, opens or kills a session. */
export type SessionStateName =
  | "unbound"
  | "online"
  | "reserved"
  | "ended"
  | "unknown"
  | "conflict";

export type SessionCommand = {
  argv: string[];
  shell: string;
};

export type SessionDetails = {
  busy: boolean;
  listening: boolean;
  reason: string;
  pastConflict: boolean;
};

export type SessionBindingSummary = {
  origin: "open" | "adopted" | "supervisor";
  generation: number;
  client: string;
  hostId: string;
  boundAt: string;
  endedAt?: string;
  conflicts: Array<{ sessionId: string; at: string }>;
};

export type ThreadSessionSlot = {
  profile: string;
  role?: string;
  state: SessionStateName;
  details: SessionDetails;
  sources: {
    agents: "available" | "unavailable";
    mcpLease: boolean;
    listening: boolean;
  };
  binding: SessionBindingSummary | null;
  profileHasMessages: boolean;
  /** Absent for a client that is not supported, so no open path starts that session. */
  openCommand?: SessionCommand;
  /** The native Claude command the Copy button copies. Only an ended or an unbound slot has one. */
  copyCommand?: { text: string };
  /** Why Copy is disabled by the client rather than the state. Only unsupported_client today. */
  copyBlockedReason?: "unsupported_client";
};

export type ThreadSessionWarning =
  | { kind: "pending_mention"; profile: string; messageIds: string[] }
  | { kind: "chain_limit"; length: number; messageIds: string[] }
  | {
      kind: "awaiting_human";
      profile: string;
      messageIds: string[];
      askedBy: string;
    };

export type ThreadSessionsView = {
  registry: { status: "ready" | "invalid"; reason?: string };
  slots: ThreadSessionSlot[];
  warnings: ThreadSessionWarning[];
  sources: {
    agents: "available" | "unavailable";
    mcpLeases: number;
    listening: "available";
  };
};

/** The JSON write helper of the app. PUT and POST share its shape and its error text. */
export type ApiWrite = <T>(path: string, body: unknown) => Promise<T>;

/** Mirrors the daemon activation contract. The panel edits only the switch and the two limits. */
export type ActivationPolicy = {
  version: 2;
  revision: string;
  enabled: boolean;
  mode: "confirm";
  attemptCap: number;
  pendingTtlMinutes: number;
  updatedAt: string;
};

export type ActivationWarning =
  | "budget_last_cycle"
  | "budget_exhausted"
  | "revision_mismatch"
  | "ledger_restored"
  | "policy_tampered"
  | "settings_tampered"
  | "policy_outdated"
  | "ledger_lost"
  | "ledger_invalid";

/** The three fixed stages. Their ids are not user data. */
export type ActivationStageId = "planning" | "execution" | "review";

export type ActivationBudget = {
  currentStage: ActivationStageId;
  /** Null while the thread state file is lost or invalid. */
  cyclesUsed: number | null;
  cyclesPerStage: number;
  granted: number;
  max: number;
  remaining: number | null;
  warnings: ActivationWarning[];
};

/** The thread activation view: the saved policy or none, the live participants, the budget and the warnings. */
export type ThreadActivationView = {
  threadId: string;
  policyState: "none" | "outdated" | "ready" | "invalid";
  policy: ActivationPolicy | null;
  /** The stored switch, readable even for an outdated policy. False when no policy is readable. */
  enabled: boolean;
  policyErrors?: ActivationValidationError[];
  participants: string[];
  budget: ActivationBudget | null;
  /** An F3a stage the thread still stands on. A save asks the human to map it to planning. */
  legacyStage: string | null;
  paused: boolean | null;
  threadPaused: boolean;
  warnings: ActivationWarning[];
  /** The lead: the recorded human choice, else the first architect in CHAT.md. Null until one exists. */
  lead?: string | null;
  /** Human changes of the lead, oldest first. */
  leadChanges?: ActivationLeadChange[];
  /** The fixed stages strictly ahead of the current one: where a human advance can go. */
  nextStages?: ActivationStageId[];
  /** Reservations retained by a hold. */
  holds?: ActivationHoldView[];
  /** Stage moves, oldest first. */
  stageHistory?: ActivationStageMove[];
  /** The supervisor's cards still on the panel. No run id, pid, host or session id. */
  supervision?: ActivationSupervisionCard[];
};

export type {
  ActivationPermissionView,
  ActivationSupervisionCard,
  ActivationSupervisionStatus
} from "./activation-supervision-view.js";

/** One human change of the lead. `from` is absent when the thread had no lead yet. */
export type ActivationLeadChange = {
  at: string;
  from?: string;
  to: string;
  by: "human";
};

/** A retained reservation, as the panel lists it. */
export type ActivationHoldView = {
  messageId: string;
  recipient: string;
  stage: string;
  reason: string;
  /** The identity check that failed, on an identity hold only. Absent for every other hold. */
  identityCheck?: string;
};

/** One stage move. `by` says who moved it; an agent move names its agent. */
export type ActivationStageMove = {
  at: string;
  from: ActivationStageId;
  to: ActivationStageId;
  by: "human" | "agent";
  agentId?: string;
  /** The message that advanced the thread, when an agent or a human advance named one. */
  messageId?: string;
  droppedHolds: number;
};

/** One validation error of a saved form, as the daemon reports it with status 400. */
export type ActivationValidationError = { field: string; code: string };

/** The workspace pause, read alone by the workspace view. */
export type WorkspaceActivationView = {
  paused: boolean;
  pausedAt: string | null;
};
