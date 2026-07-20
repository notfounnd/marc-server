export type WorkspaceInfo = {
  id: string;
  name: string;
  rootPath: string;
  marcPath: string;
};

export type AgentProfile = {
  id: string;
  role: string;
  model: string;
  description: string;
  displayName?: string;
  notes?: string;
};

export type AgentRegistrationResult = {
  id: string;
  status: "created" | "updated" | "unchanged";
  created: boolean;
  alreadyExists: boolean;
  updated: boolean;
};

export type AgentProfileSummary = {
  id: string;
  role?: string;
  model?: string;
  description?: string;
  markdown?: string;
};

export type AgentListOptions = {
  includeMarkdown?: boolean;
};

export type ThreadInfo = {
  id: string;
  title: string;
  path: string;
  createdAt: string;
  status: "open" | "closed";
  closedAt?: string;
  summaryPath?: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  timestamp: string;
  agentId: string;
  role?: string;
  body: string;
  artifacts: string[];
};

export type MessageInput = {
  agentId: string;
  body: string;
  role?: string;
  artifacts?: string[];
};

export type WorkspaceRecommendationsUpdate = {
  updated: string[];
  alreadyCurrent: string[];
};

export type WorkspaceAuditScope =
  | "all"
  | "rules"
  | "messages"
  | "agents"
  | "references"
  | "artifacts"
  | "preflight";

export type WorkspaceAuditSeverity =
  | "all"
  | "critical"
  | "warning"
  | "suggestion";

export type WorkspaceAuditOptions = {
  scope?: WorkspaceAuditScope;
  threadId?: string;
  messageId?: string;
  severity?: WorkspaceAuditSeverity;
  maxFindings?: number;
};

export type WorkspaceAuditFinding = {
  severity: Exclude<WorkspaceAuditSeverity, "all">;
  scope: Exclude<WorkspaceAuditScope, "all">;
  code: string;
  location: string;
  message: string;
  suggestion: string;
};

export type WorkspaceAuditResult = {
  ok: boolean;
  summary: {
    scopes: Array<Exclude<WorkspaceAuditScope, "all">>;
    totalFindings: number;
    critical: number;
    warning: number;
    suggestion: number;
  };
  findings: WorkspaceAuditFinding[];
};

export type ThreadListStatus = "open" | "closed" | "all";

export type ThreadListOptions = {
  status?: ThreadListStatus;
};

export type ThreadReadOptions = {
  includeMarkdown?: boolean;
  includeMessages?: boolean;
  includeSummary?: boolean;
};

export type ThreadReadResult = {
  markdown?: string;
  messages?: ChatMessage[];
  summary?: string;
  messageCount: number;
  lastMessageId?: string;
  updatedAt?: string;
};

export type ThreadReadSinceResult =
  | {
      ok: true;
      afterMessageId: string;
      messages: ChatMessage[];
      messageCount: number;
      lastMessageId?: string;
      updatedAt?: string;
    }
  | {
      ok: false;
      error: "cursor_not_found";
      shouldReadFullThread: true;
      afterMessageId: string;
      messages: [];
      messageCount: number;
      lastMessageId?: string;
      updatedAt?: string;
    };

export type ThreadInfoResult = ThreadInfo & {
  messageCount: number;
  lastMessageId?: string;
  updatedAt: string;
  summaryAvailable: boolean;
};

export type ThreadTailOptions = {
  limit?: number;
};

export type ThreadTailResult = {
  messages: ChatMessage[];
  messageCount: number;
  lastMessageId?: string;
  updatedAt?: string;
  limit: number;
};

export type ThreadIndexEntry = ThreadInfo & {
  chatMtimeMs: number;
  summaryMtimeMs?: number;
};

export type ThreadIndexSnapshot = {
  version: 1;
  updatedAt: string;
  threads: ThreadIndexEntry[];
};

export type ThreadIndexStore = {
  load(): Promise<ThreadIndexSnapshot | undefined>;
  save(snapshot: ThreadIndexSnapshot): Promise<void>;
  clear(): Promise<void>;
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
  summaryCount: number;
  indexedSummaryCount: number;
  preparing: boolean;
  rebuilding: boolean;
  lastPreparedAt?: string;
  lastRebuildAt?: string;
  lastError: string | null;
  autoRebuild: boolean;
  embeddingBatchSize: number;
  message: string;
};

export type WorkspaceSettings = {
  memory: {
    autoRebuild: boolean;
    embeddingBatchSize: number;
  };
};

export type WorkspaceSettingsInput = {
  memory?: {
    autoRebuild?: boolean;
    embeddingBatchSize?: number;
  };
};

export type WorkspaceStatus = {
  ok: boolean;
  modules: {
    threadIndex: ThreadIndexHealth;
    memory: MemoryIndexHealth;
  };
};

export type DaemonConfig = {
  dataDir: string;
  host: string;
  port: number;
  token: string;
  tokenPath: string;
  mode: "foreground" | "detached";
  autoIdleMs: number;
  fingerprint: string;
};

export type DaemonLease = {
  clientId: string;
  agentId?: string;
  workspaceId?: string;
  clientType: "mcp" | "ui" | "unknown";
  startedAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

export type DaemonRuntimeState = {
  version: 1;
  pid: number;
  startedAt: string;
  host: string;
  port: number;
  url: string;
  dataDir: string;
  tokenPath: string;
  logPath: string;
  fingerprint: string;
  mode: "foreground" | "detached";
  lastActivityAt: string;
  activeUiClients: number;
  autoIdleMs: number;
  leases: DaemonLease[];
};
