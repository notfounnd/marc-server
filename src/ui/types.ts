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
    | "rebuilding"
    | "degraded";
  ready: boolean;
  stale: boolean;
  modelPrepared: boolean;
  summaryCount: number;
  indexedSummaryCount: number;
  message: string;
};

export type MemoryRecallHit = {
  threadId: string;
  title: string;
  closedAt?: string;
  summaryPath: string;
  reference: string;
  matchedText: string;
  score: number;
  reason: string;
};

export type MemoryRecallResult = {
  query: string;
  indexStatus: MemoryIndexHealth;
  results: MemoryRecallHit[];
  nextActions: string[];
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
