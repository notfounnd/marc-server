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

export type DaemonStatus = {
  ok: boolean;
  modules?: {
    threadIndex?: {
      workspaces?: Record<string, ThreadIndexHealth>;
    };
  };
};

export type StatusKind = "idle" | "ok" | "warn" | "error";

export type Toast = {
  kind: Exclude<StatusKind, "idle">;
  message: string;
};

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
