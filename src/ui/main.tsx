import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import remarkGfm from "remark-gfm";
import {
  Archive,
  AtSign,
  Bot,
  Check,
  CircleAlert,
  CircleHelp,
  Clock3,
  Copy,
  FileText,
  KeyRound,
  Keyboard,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Server,
  UserRound,
  X,
} from "lucide-react";
import { MAX_MESSAGE_CHARS, validateMessageBody } from "../core/guards.js";
import { messageArtifactReference, parseMarcReference, type MarcReference } from "../core/marc-references.js";
import {
  applyAutocompleteOption,
  buildAutocompleteOptions,
  detectAutocompleteRequest,
  getAutocompleteRemoteThreadId,
  type ComposerAutocompleteOption,
  type ComposerAutocompleteRequest,
} from "./composer-autocomplete.js";
import { linkifyMarcReferences, marcReferenceLabel, transformMarkdownUrl } from "./marc-links.js";
import "./i18n.js";
import "./styles.css";

type Workspace = {
  id: string;
  name: string;
  rootPath: string;
  marcPath: string;
};

type Thread = {
  id: string;
  title: string;
  path: string;
  createdAt: string;
  status: "open" | "closed";
  closedAt?: string;
  summaryPath?: string;
};

type Agent = {
  id: string;
  markdown: string;
};

type Message = {
  id: string;
  threadId: string;
  timestamp: string;
  agentId: string;
  role?: string;
  body: string;
  artifacts: string[];
};

type ThreadPayload = {
  markdown?: string;
  messages?: Message[];
  summary?: string;
  messageCount: number;
  lastMessageId?: string;
  updatedAt?: string;
};

type ThreadIndexHealth = {
  status: "ready" | "rebuilding" | "degraded" | "unavailable";
  rebuilding: boolean;
  lastRebuildAt?: string;
  lastError: string | null;
  threadCount: number;
};

type DaemonStatus = {
  ok: boolean;
  modules?: {
    threadIndex?: {
      workspaces?: Record<string, ThreadIndexHealth>;
    };
  };
};

type StatusKind = "idle" | "ok" | "warn" | "error";
type Toast = {
  kind: Exclude<StatusKind, "idle">;
  message: string;
};
type MarkdownLinkHandler = (href: string) => void | Promise<void>;
type ArtifactDraft = {
  message: Message;
  fileName: string;
  content: string;
};
type ArtifactView = {
  threadId: string;
  messageId: string;
  artifact: string;
  content: string;
};
type ArtifactMenuItem = {
  message: Message;
  artifact: string;
  href: string;
};

function classNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function isClosedThread(thread: Thread): boolean {
  return thread.status === "closed" || Boolean(thread.closedAt || thread.summaryPath);
}

function Button({
  children,
  variant = "secondary",
  onClick,
  disabled,
  title,
  className,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      className={classNames("button", `button-${variant}`, className)}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "amber" }) {
  return <span className={classNames("badge", `badge-${tone}`)}>{children}</span>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <CircleAlert size={18} />
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  title,
  detail,
  tag,
  active,
  closed,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  tag?: string;
  active?: boolean;
  closed?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={classNames("nav-item", active && "active", closed && "nav-item-closed")} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-copy">
        <strong>{title}</strong>
        <span className="nav-detail-row">
          {detail ? <small>{detail}</small> : null}
          {tag ? <em>{tag}</em> : null}
        </span>
      </span>
    </button>
  );
}

function parseAgentProfile(markdown: string): { title: string; role?: string; model?: string } {
  return {
    title: markdown.match(/^#\s+(.+)$/m)?.[1] ?? "Agent",
    role: markdown.match(/^Role:\s+(.+)$/m)?.[1],
    model: markdown.match(/^Model:\s+(.+)$/m)?.[1],
  };
}

function App() {
  const { t } = useTranslation();
  const [token, setToken] = useState(() => localStorage.getItem("marcToken") ?? "");
  const [tokenLocked, setTokenLocked] = useState(() => localStorage.getItem("marcTokenLocked") === "true");
  const [statusKind, setStatusKind] = useState<StatusKind>("idle");
  const [status, setStatus] = useState(() => t("Token required"));
  const [toast, setToast] = useState<Toast>();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [closedThreads, setClosedThreads] = useState<Thread[]>([]);
  const [showClosedThreads, setShowClosedThreads] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [rules, setRules] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>();
  const [selectedThreadId, setSelectedThreadId] = useState<string>();
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [threadPayload, setThreadPayload] = useState<ThreadPayload>();
  const [uiAgentId, setUiAgentId] = useState(() => localStorage.getItem("marcUiAgentId") ?? "ui-user");
  const [composerBody, setComposerBody] = useState("");
  const [sending, setSending] = useState(false);
  const [artifactDraft, setArtifactDraft] = useState<ArtifactDraft>();
  const [artifactView, setArtifactView] = useState<ArtifactView>();
  const [showArtifactMenu, setShowArtifactMenu] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [savingArtifact, setSavingArtifact] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>();
  const [threadIndexHealthByWorkspace, setThreadIndexHealthByWorkspace] = useState<Record<string, ThreadIndexHealth>>({});
  const [busy, setBusy] = useState(false);
  const lastRefreshAtRef = useRef(0);
  const busyRef = useRef(false);
  const selectedWorkspaceIdRef = useRef<string | undefined>(undefined);
  const selectedThreadIdRef = useRef<string | undefined>(undefined);
  const autocompleteThreadPayloadRef = useRef(new Map<string, ThreadPayload>());
  const liveRefreshTimerRef = useRef<ReturnType<typeof window.setTimeout> | undefined>(undefined);
  const toastTimerRef = useRef<ReturnType<typeof window.setTimeout> | undefined>(undefined);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId),
    [selectedWorkspaceId, workspaces],
  );
  const selectedThreadIndexHealth = selectedWorkspaceId ? threadIndexHealthByWorkspace[selectedWorkspaceId] : undefined;
  const selectedAgent = useMemo(() => agents.find((agent) => agent.id === selectedAgentId), [selectedAgentId, agents]);
  const archivedThreads = useMemo(() => {
    const byId = new Map<string, Thread>();
    for (const thread of [...closedThreads, ...threads].filter(isClosedThread)) {
      byId.set(thread.id, thread);
    }
    return Array.from(byId.values()).sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""));
  }, [closedThreads, threads]);
  const closedThreadIds = useMemo(() => new Set(archivedThreads.map((thread) => thread.id)), [archivedThreads]);
  const openThreads = useMemo(
    () => threads.filter((thread) => !isClosedThread(thread) && !closedThreadIds.has(thread.id)),
    [closedThreadIds, threads],
  );
  const allWorkspaceThreads = useMemo(() => {
    const byId = new Map<string, Thread>();
    for (const thread of [...openThreads, ...archivedThreads]) {
      byId.set(thread.id, thread);
    }
    return Array.from(byId.values());
  }, [archivedThreads, openThreads]);
  const visibleThreads = showClosedThreads ? archivedThreads : openThreads;
  const selectedThread = useMemo(
    () => archivedThreads.find((thread) => thread.id === selectedThreadId) ?? openThreads.find((thread) => thread.id === selectedThreadId),
    [archivedThreads, openThreads, selectedThreadId],
  );
  const selectedThreadArtifacts = useMemo<ArtifactMenuItem[]>(
    () =>
      (threadPayload?.messages ?? []).flatMap((message) =>
        message.artifacts.map((artifact) => ({
          message,
          artifact,
          href: messageArtifactReference(message.id, artifact),
        })),
      ),
    [threadPayload?.messages],
  );

  useEffect(() => {
    selectedWorkspaceIdRef.current = selectedWorkspaceId;
  }, [selectedWorkspaceId]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
    setShowArtifactMenu(false);
  }, [selectedThreadId]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const api = useCallback(
    async <T,>(path: string): Promise<T> => {
      if (!tokenLocked || !token.trim()) {
        throw new Error(t("Lock the daemon token first."));
      }

      const response = await fetch(path, {
        headers: {
          authorization: `Bearer ${token.trim()}`,
        },
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json() as Promise<T>;
    },
    [t, token, tokenLocked],
  );

  const apiPost = useCallback(
    async <T,>(path: string, body: unknown): Promise<T> => {
      if (!tokenLocked || !token.trim()) {
        throw new Error(t("Lock the daemon token first."));
      }

      const response = await fetch(path, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token.trim()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json() as Promise<T>;
    },
    [t, token, tokenLocked],
  );

  const refresh = useCallback(async (options: { force?: boolean; includeThread?: boolean } = {}) => {
    if (busyRef.current || !tokenLocked) return;
    const now = Date.now();
    if (!options.force && now - lastRefreshAtRef.current < 30000) return;
    lastRefreshAtRef.current = now;
    busyRef.current = true;
    setBusy(true);

    try {
      const daemonStatus = await api<DaemonStatus>("/api/status");
      setThreadIndexHealthByWorkspace(daemonStatus.modules?.threadIndex?.workspaces ?? {});
      const nextWorkspaces = await api<Workspace[]>("/api/workspaces");
      setWorkspaces(nextWorkspaces);

      const currentWorkspaceId = selectedWorkspaceIdRef.current;
      const workspaceId = currentWorkspaceId ?? nextWorkspaces[0]?.id;
      if (!currentWorkspaceId && workspaceId) {
        selectedWorkspaceIdRef.current = workspaceId;
        setSelectedWorkspaceId(workspaceId);
      }

      const workspace = nextWorkspaces.find((item) => item.id === workspaceId);
      if (workspace) {
        const encodedWorkspace = encodeURIComponent(workspace.id);
        const [nextThreads, nextClosedThreads, nextAgents, nextRules] = await Promise.all([
          api<Thread[]>(`/api/workspaces/${encodedWorkspace}/threads`),
          api<Thread[]>(`/api/workspaces/${encodedWorkspace}/threads?status=closed`),
          api<Agent[]>(`/api/workspaces/${encodedWorkspace}/agents`),
          api<{ markdown: string }>(`/api/workspaces/${encodedWorkspace}/rules`),
        ]);

        setThreads(nextThreads);
        setClosedThreads(nextClosedThreads);
        setAgents(nextAgents);
        setRules(nextRules.markdown);

        const currentThreadId = selectedThreadIdRef.current;
        if (
          options.includeThread &&
          currentThreadId &&
          [...nextThreads, ...nextClosedThreads].some((thread) => thread.id === currentThreadId)
        ) {
          setThreadPayload(
            await api<ThreadPayload>(`/api/workspaces/${encodedWorkspace}/threads/${encodeURIComponent(currentThreadId)}`),
          );
        }
      } else {
        selectedWorkspaceIdRef.current = undefined;
        selectedThreadIdRef.current = undefined;
        setSelectedWorkspaceId(undefined);
        setSelectedThreadId(undefined);
        setSelectedAgentId(undefined);
        setThreads([]);
        setClosedThreads([]);
        setShowClosedThreads(false);
        setAgents([]);
        setRules("");
        setThreadPayload(undefined);
        setThreadIndexHealthByWorkspace({});
      }

      setStatusKind("ok");
      setStatus(t("Connected"));
      setLastSyncedAt(new Date());
    } catch (error) {
      setStatusKind("error");
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [api, tokenLocked]);

  useEffect(() => {
    if (!tokenLocked) return;
    void refresh({ force: true, includeThread: true });
    const onFocus = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshAtRef.current > 30000) {
        void refresh({ includeThread: true });
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh, tokenLocked]);

  useEffect(() => {
    if (!tokenLocked || !token.trim()) return;

    const source = new EventSource(`/api/events?token=${encodeURIComponent(token.trim())}`);
    source.addEventListener("open", () => {
      setStatusKind("ok");
        setStatus(t("Live updates connected"));
    });
    const scheduleRefresh = () => {
      if (liveRefreshTimerRef.current) {
        window.clearTimeout(liveRefreshTimerRef.current);
      }
      liveRefreshTimerRef.current = window.setTimeout(() => {
        void refresh({ force: true, includeThread: true });
      }, 300);
    };
    source.addEventListener("workspace-registered", () => {
      scheduleRefresh();
    });
    source.addEventListener("workspace-unregistered", () => {
      scheduleRefresh();
    });
    source.addEventListener("workspace-changed", () => {
      scheduleRefresh();
    });
    source.addEventListener("error", () => {
      setStatusKind("warn");
        setStatus(t("Live updates reconnecting"));
    });

    return () => {
      source.close();
      if (liveRefreshTimerRef.current) {
        window.clearTimeout(liveRefreshTimerRef.current);
        liveRefreshTimerRef.current = undefined;
      }
    };
  }, [refresh, token, tokenLocked]);

  function lockToken() {
    const normalized = token.trim();
    if (!normalized) {
      setStatusKind("error");
      setStatus(t("Paste the daemon token first."));
      return;
    }

    localStorage.setItem("marcToken", normalized);
    localStorage.setItem("marcTokenLocked", "true");
    setToken(normalized);
    setTokenLocked(true);
    setStatusKind("warn");
    setStatus(t("Checking daemon"));
  }

  function unlockToken() {
    localStorage.setItem("marcTokenLocked", "false");
    setTokenLocked(false);
    setStatusKind("warn");
    setStatus(t("Token unlocked"));
  }

  async function selectWorkspace(workspace: Workspace) {
    selectedWorkspaceIdRef.current = workspace.id;
    selectedThreadIdRef.current = undefined;
    autocompleteThreadPayloadRef.current.clear();
    setSelectedWorkspaceId(workspace.id);
    setSelectedThreadId(undefined);
    setSelectedAgentId(undefined);
    setShowClosedThreads(false);
    setThreadPayload(undefined);
    await refresh({ force: true, includeThread: false });
  }

  async function selectThread(thread: Thread): Promise<ThreadPayload | undefined> {
    if (!selectedWorkspace) return;

    setSelectedThreadId(thread.id);
    selectedThreadIdRef.current = thread.id;
    setSelectedAgentId(undefined);
    const payload = await api<ThreadPayload>(
      `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(thread.id)}`,
    );
    autocompleteThreadPayloadRef.current.set(thread.id, payload);
    setThreadPayload(payload);
    return payload;
  }

  async function loadAutocompleteThreadMessages(threadId: string): Promise<Message[]> {
    if (!selectedWorkspace) return [];
    if (threadId === selectedThread?.id) {
      return threadPayload?.messages ?? [];
    }
    if (!allWorkspaceThreads.some((thread) => thread.id === threadId)) {
      return [];
    }

    const cachedPayload = autocompleteThreadPayloadRef.current.get(threadId);
    if (cachedPayload) {
      return cachedPayload.messages ?? [];
    }

    try {
      const payload = await api<ThreadPayload>(
        `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(threadId)}`,
      );
      autocompleteThreadPayloadRef.current.set(threadId, payload);
      return payload.messages ?? [];
    } catch (error) {
      setStatusKind("error");
      setStatus(error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  async function sendUiMessage() {
    if (!selectedWorkspace || !selectedThread || !composerBody.trim() || sending) return;

    const agentId = uiAgentId.trim() || "ui-user";
    localStorage.setItem("marcUiAgentId", agentId);
    setUiAgentId(agentId);
    setSending(true);

    try {
      await apiPost<Message>(`/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(selectedThread.id)}`, {
        agentId,
        displayName: agentId,
        role: "user",
        message: composerBody.trim(),
      });
      setComposerBody("");
      setThreadPayload(
        await api<ThreadPayload>(`/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(selectedThread.id)}`),
      );
      setStatusKind("ok");
      setStatus(t("Message posted"));
      setLastSyncedAt(new Date());
    } catch (error) {
      setStatusKind("error");
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSending(false);
    }
  }

  async function saveArtifact() {
    if (!selectedWorkspace || !selectedThread || !artifactDraft || savingArtifact) return;
    if (!artifactDraft.fileName.trim() || !artifactDraft.content.trim()) {
      setStatusKind("error");
      setStatus(t("Artifact name and content are required"));
      return;
    }

    setSavingArtifact(true);
    try {
      const response = await apiPost<{ artifact: string }>(
        `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(selectedThread.id)}/messages/${encodeURIComponent(artifactDraft.message.id)}/artifacts`,
        {
          fileName: artifactDraft.fileName.trim(),
          content: artifactDraft.content,
        },
      );
      setArtifactDraft(undefined);
      setThreadPayload(
        await api<ThreadPayload>(`/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(selectedThread.id)}`),
      );
      setStatusKind("ok");
      setStatus(t("Artifact attached: {{artifact}}", { artifact: response.artifact }));
      setLastSyncedAt(new Date());
    } catch (error) {
      setStatusKind("error");
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingArtifact(false);
    }
  }

  function selectAgent(agent: Agent) {
    setSelectedAgentId(agent.id);
    setSelectedThreadId(undefined);
    selectedThreadIdRef.current = undefined;
    setThreadPayload(undefined);
  }

  async function findAndSelectThread(threadId: string): Promise<ThreadPayload | undefined> {
    const thread = [...openThreads, ...archivedThreads].find((item) => item.id === threadId);
    if (!thread) {
      setStatusKind("error");
      setStatus(t("Thread not found: {{threadId}}", { threadId }));
      return undefined;
    }
    return selectThread(thread);
  }

  function scrollToMessage(messageId: string) {
    window.setTimeout(() => {
      document.getElementById(`message-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function showToast(message: string, kind: Exclude<StatusKind, "idle"> = "ok") {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ kind, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(undefined);
      toastTimerRef.current = undefined;
    }, 2400);
  }

  async function copyReference(reference: string) {
    try {
      await navigator.clipboard.writeText(reference);
      showToast(`Copied ${reference}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    }
  }

  async function openArtifactReference(reference: Extract<MarcReference, { type: "artifact" }>) {
    if (!selectedWorkspace) return;
    const threadId = reference.threadId ?? selectedThreadIdRef.current;
    if (!threadId) {
      setStatusKind("error");
      setStatus(t("Select a thread before opening a local artifact reference."));
      return;
    }

    if (threadId !== selectedThreadIdRef.current) {
      const payload = await findAndSelectThread(threadId);
      if (!payload) return;
    }

    const artifact = await api<{ artifact: string; content: string }>(
      `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(reference.messageId)}/artifacts/${encodeURIComponent(reference.artifactFile)}`,
    );
    setArtifactView({
      threadId,
      messageId: reference.messageId,
      artifact: artifact.artifact,
      content: artifact.content,
    });
  }

  async function handleMarcReference(reference: MarcReference) {
    if (reference.type === "agent") {
      const agent = agents.find((item) => item.id === reference.agentId);
      if (agent) {
        selectAgent(agent);
      } else {
        setStatusKind("error");
        setStatus(t("Agent not found: {{agentId}}", { agentId: reference.agentId }));
      }
      return;
    }

    if (reference.type === "thread") {
      await findAndSelectThread(reference.threadId);
      return;
    }

    if (reference.type === "message") {
      const threadId = reference.threadId ?? selectedThreadIdRef.current;
      if (threadId && threadId !== selectedThreadIdRef.current) {
        const payload = await findAndSelectThread(threadId);
        if (!payload) return;
      }
      scrollToMessage(reference.messageId);
      return;
    }

    await openArtifactReference(reference);
  }

  function handleMarkdownLink(href: string) {
    const marcReference = parseMarcReference(href);
    if (marcReference) {
      void handleMarcReference(marcReference);
      return;
    }

    const normalized = href.replace(/^\.?\//, "");
    const agentMatch = /^agents\/([^/]+)\.md$/.exec(normalized);
    if (agentMatch) {
      const agent = agents.find((item) => item.id === agentMatch[1]);
      if (agent) {
        selectAgent(agent);
      }
    }
  }

  function goHome() {
    setSelectedThreadId(undefined);
    selectedThreadIdRef.current = undefined;
    setSelectedAgentId(undefined);
    setThreadPayload(undefined);
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <button className="brand-mark" onClick={goHome} title={t("Home")} aria-label={t("Home")}>
            m
          </button>
          <div className="content-title-block">
            <h1>mARC</h1>
          </div>
        </div>
        <p className="brand-tagline">{t("Shared context for coding agents")}</p>

        <section className="panel token-panel">
          <div className="panel-heading">
            <KeyRound size={16} />
            <span>{t("Daemon token")}</span>
          </div>
          <input
            value={token}
            disabled={tokenLocked}
            onChange={(event) => setToken(event.target.value)}
            type="password"
            placeholder={t("Paste token")}
          />
          <div className="token-actions">
            {tokenLocked ? (
              <Button variant="ghost" onClick={unlockToken}>
                {t("Change token")}
              </Button>
            ) : (
              <Button variant="primary" onClick={lockToken}>
                <Check size={15} />
                {t("Save and lock")}
              </Button>
            )}
          <Button variant="secondary" onClick={() => void refresh({ force: true, includeThread: true })} disabled={!tokenLocked || busy} title={t("Refresh now")}>
              <RefreshCw size={15} className={busy ? "spin" : ""} />
            </Button>
          </div>
          <div className={classNames("connection", statusKind)}>
            <span />
            <p>{status}</p>
          </div>
        </section>

        <section className="section">
          <div className="section-title">
            <Server size={16} />
            <h2>{t("Workspaces")}</h2>
          </div>
          <div className="stack">
            {workspaces.length ? (
              workspaces.map((workspace) => (
                <NavItem
                  key={workspace.id}
                  icon={<Server size={16} />}
                  title={workspace.name}
                  detail={workspace.rootPath}
                  active={workspace.id === selectedWorkspaceId}
                  onClick={() => void selectWorkspace(workspace)}
                />
              ))
            ) : (
              <EmptyState title={t("No workspaces")} detail={t("Ask an agent to register a project in mARC.")} />
            )}
          </div>
        </section>
      </aside>

      <nav className="middle">
        <section>
          <div className="section-title section-title-split">
            <span className="section-title-main">
              {showClosedThreads ? <Archive size={16} /> : <MessageSquareText size={16} />}
              <h2>{showClosedThreads ? t("Closed") : t("Threads")}</h2>
            </span>
            <Button
              variant={showClosedThreads ? "primary" : "ghost"}
              className="button-icon"
              onClick={() => setShowClosedThreads((value) => !value)}
              title={showClosedThreads ? t("Show open threads") : t("Show closed threads")}
            >
              {showClosedThreads ? <X size={15} /> : <Archive size={15} />}
            </Button>
          </div>
          <div className="stack">
            {visibleThreads.length ? (
              visibleThreads.map((thread) => (
                <NavItem
                  key={thread.id}
                  icon={isClosedThread(thread) ? <Archive size={16} /> : <MessageSquareText size={16} />}
                  title={thread.title}
                  detail={
                    isClosedThread(thread) && thread.closedAt
                      ? t("Closed {{date}}", { date: new Date(thread.closedAt).toLocaleString() })
                      : thread.id
                  }
                  active={thread.id === selectedThreadId}
                  closed={isClosedThread(thread)}
                  onClick={() => void selectThread(thread)}
                />
              ))
            ) : (
              <EmptyState
                title={showClosedThreads ? t("No closed threads") : t("No threads")}
                detail={
                  showClosedThreads
                    ? t("Threads with SUMMARY.md will appear here.")
                    : t("Create a thread from an agent to start the room.")
                }
              />
            )}
          </div>
        </section>

        <section className="section">
          <div className="section-title">
            <AtSign size={16} />
            <h2>{t("Marckers")}</h2>
          </div>
          <div className="stack">
            {agents.length ? (
              agents.map((agent) => {
                const profile = parseAgentProfile(agent.markdown);
                const isUiUser = agent.id === uiAgentId || profile.role?.toLowerCase() === "user";
                return (
                  <NavItem
                    key={agent.id}
                    icon={isUiUser ? <UserRound size={16} /> : <Bot size={16} />}
                    title={profile.title}
                    detail={profile.role}
                    tag={profile.model}
                    active={agent.id === selectedAgentId}
                    onClick={() => selectAgent(agent)}
                  />
                );
              })
            ) : (
              <EmptyState title={t("No marckers")} detail={t("Register a user or agent before posting.")} />
            )}
          </div>
        </section>
      </nav>

      <main className="content">
        <header className="content-header">
          <div>
            <div className="eyebrow">
              <FileText size={14} />
              {selectedThread ? t("Thread") : selectedAgent ? t("Agent") : t("Workspace")}
            </div>
            <h2 className={classNames(selectedThread && isClosedThread(selectedThread) && "content-title-closed")}>
              {selectedThread?.title ?? (selectedAgent ? parseAgentProfile(selectedAgent.markdown).title : selectedWorkspace?.name ?? "mARC")}
            </h2>
            {selectedThread ? (
              <p className="thread-reference-row">
                <span>{selectedThread.id}</span>
                <button
                  className="copy-reference-button"
                  onClick={() => void copyReference(`marc://$${selectedThread.id}`)}
                  title={t("Copy thread reference")}
                >
                  <Copy size={13} />
                </button>
              </p>
            ) : (
              <p>{selectedAgent?.id ?? selectedWorkspace?.rootPath ?? t("Lock the token to start syncing.")}</p>
            )}
          </div>
          <div className="content-side">
            <div className="content-badges">
              <Badge tone={statusKind === "ok" ? "green" : statusKind === "error" || statusKind === "warn" ? "amber" : "neutral"}>
                <Clock3 size={13} />
                {lastSyncedAt ? t("Synced {{time}}", { time: lastSyncedAt.toLocaleTimeString() }) : t("Not synced")}
              </Badge>
              {selectedThread && isClosedThread(selectedThread) ? (
                <Badge tone="amber">
                  <Archive size={13} />
                  {t("Closed")}
                </Badge>
              ) : null}
              {selectedThreadIndexHealth?.rebuilding ? (
                <Badge tone="amber">
                  <RefreshCw size={13} className="spin" />
                  {t("Index rebuilding")}
                </Badge>
              ) : selectedThreadIndexHealth?.status === "degraded" || selectedThreadIndexHealth?.status === "unavailable" ? (
                <Badge tone="amber">
                  <CircleAlert size={13} />
                  {t("Index degraded")}
                </Badge>
              ) : null}
            </div>
            <div className="content-actions">
              {selectedThread && selectedThreadArtifacts.length ? (
                <div className="header-artifacts">
                  <Button
                    variant={showArtifactMenu ? "primary" : "secondary"}
                    className="button-icon"
                    onClick={() => setShowArtifactMenu((value) => !value)}
                    title={t("Show thread artifacts")}
                  >
                    <Paperclip size={15} />
                  </Button>
                  {showArtifactMenu ? (
                    <div className="artifact-menu">
                      <div className="artifact-menu-head">
                        <Paperclip size={14} />
                        <span>{t("Artifacts")}</span>
                      </div>
                      <div className="artifact-menu-list">
                        {selectedThreadArtifacts.map(({ message, artifact, href }) => (
                          <button
                            className="artifact-menu-item"
                            key={`${message.id}:${artifact}`}
                            onClick={() => {
                              setShowArtifactMenu(false);
                              void handleMarkdownLink(href);
                            }}
                          >
                            <span>{artifact.replace(/^artifacts\//, "")}</span>
                            <small>#{message.id}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {selectedThread ? (
          <>
            <ThreadView
              payload={threadPayload}
              onAttachArtifact={(message) => setArtifactDraft({ message, fileName: "", content: "" })}
              onLink={handleMarkdownLink}
              onCopyReference={copyReference}
            />
            <Composer
              agentId={uiAgentId}
              body={composerBody}
              agents={agents}
              threads={allWorkspaceThreads}
              messages={threadPayload?.messages ?? []}
              sending={sending}
              onAgentIdChange={setUiAgentId}
              onBodyChange={setComposerBody}
              onSend={() => void sendUiMessage()}
              loadThreadMessages={loadAutocompleteThreadMessages}
            />
          </>
        ) : selectedAgent ? (
          <MarkdownPanel markdown={selectedAgent.markdown} onLink={handleMarkdownLink} />
        ) : selectedWorkspace ? (
          <WorkspaceOverview rules={rules} onLink={handleMarkdownLink} />
        ) : (
          <EmptyState title={t("No workspace selected")} detail={t("Save the daemon token and select a workspace from the sidebar.")} />
        )}
        <footer className="content-footer">
          <span aria-hidden="true" />
          <a
            href="#keyboard-shortcuts"
            className="content-footer-link"
            onClick={(event) => {
              event.preventDefault();
              setShowShortcuts(true);
            }}
            title={t("Keyboard shortcuts")}
          >
            <Keyboard size={15} />
          </a>
        </footer>
      </main>
      {artifactDraft ? (
        <ArtifactModal
          draft={artifactDraft}
          saving={savingArtifact}
          onChange={setArtifactDraft}
          onClose={() => setArtifactDraft(undefined)}
          onSave={() => void saveArtifact()}
        />
      ) : null}
      {artifactView ? (
        <ArtifactViewerModal artifact={artifactView} onClose={() => setArtifactView(undefined)} onLink={handleMarkdownLink} />
      ) : null}
      {showShortcuts ? <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} /> : null}
      {toast ? (
        <div className={classNames("toast", `toast-${toast.kind}`)} role="status" aria-live="polite">
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

function Composer({
  agentId,
  body,
  agents,
  threads,
  messages,
  sending,
  onAgentIdChange,
  onBodyChange,
  onSend,
  loadThreadMessages,
}: {
  agentId: string;
  body: string;
  agents: Agent[];
  threads: Thread[];
  messages: Message[];
  sending: boolean;
  onAgentIdChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSend: () => void;
  loadThreadMessages: (threadId: string) => Promise<Message[]>;
}) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autocompleteListRef = useRef<HTMLDivElement>(null);
  const [autocomplete, setAutocomplete] = useState<{
    request: ComposerAutocompleteRequest;
    options: ComposerAutocompleteOption[];
    activeIndex: number;
  }>();
  const trimmedBody = body.trim();
  const validation = validateMessageBody(body);
  const remainingChars = Math.max(0, MAX_MESSAGE_CHARS - trimmedBody.length);
  const isOverCharacterLimit = trimmedBody.length > MAX_MESSAGE_CHARS;
  const canSend = Boolean(trimmedBody) && validation.ok && !sending;

  useEffect(() => {
    const activeItem = autocompleteListRef.current?.querySelector<HTMLButtonElement>(".composer-autocomplete-item.active");
    activeItem?.scrollIntoView({ block: "nearest" });
  }, [autocomplete?.activeIndex]);

  async function openAutocomplete() {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? body.length;
    const request = detectAutocompleteRequest(body, cursor);
    if (!request) {
      setAutocomplete(undefined);
      return;
    }

    const remoteThreadId = getAutocompleteRemoteThreadId(request);
    const remoteMessages = remoteThreadId ? await loadThreadMessages(remoteThreadId) : undefined;
    const options = buildAutocompleteOptions(request, {
      agents,
      threads,
      currentMessages: messages,
      remoteMessages,
    });

    setAutocomplete({
      request,
      options,
      activeIndex: 0,
    });
  }

  function insertAutocompleteOption(option: ComposerAutocompleteOption) {
    if (!autocomplete) return;
    const result = applyAutocompleteOption(body, autocomplete.request, option.value);
    onBodyChange(result.value);
    setAutocomplete(undefined);
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(result.cursor, result.cursor);
    }, 0);
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.ctrlKey && event.code === "Space") {
      event.preventDefault();
      void openAutocomplete();
      return;
    }

    if (!autocomplete) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setAutocomplete(undefined);
      return;
    }

    if (!autocomplete.options.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setAutocomplete((current) =>
        current
          ? {
              ...current,
              activeIndex: (current.activeIndex + 1) % current.options.length,
            }
          : current,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setAutocomplete((current) =>
        current
          ? {
              ...current,
              activeIndex: (current.activeIndex - 1 + current.options.length) % current.options.length,
            }
          : current,
      );
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insertAutocompleteOption(autocomplete.options[autocomplete.activeIndex]);
    }
  }

  return (
    <section className="composer">
        <div className="composer-head">
          <div>
            <h3>{t("Post to this thread")}</h3>
            <p>{t("Messages are appended to the same CHAT.md that agents read.")}</p>
          </div>
          <label>
            {t("Sender")}
            <input value={agentId} onChange={(event) => onAgentIdChange(event.target.value)} placeholder="ui-user" />
          </label>
        </div>
        <div className="composer-input-wrap">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(event) => {
              onBodyChange(event.target.value);
              setAutocomplete(undefined);
            }}
            onKeyDown={handleComposerKeyDown}
            placeholder={t("Write a note, decision, or instruction for the agents...")}
            rows={5}
          />
          {autocomplete ? (
            <div ref={autocompleteListRef} className="composer-autocomplete" role="listbox" aria-label={t("mARC reference suggestions")}>
              {autocomplete.options.length ? (
                autocomplete.options.map((option, index) => (
                  <button
                    className={classNames(
                      "composer-autocomplete-item",
                      index === autocomplete.activeIndex && "active",
                      option.closed && "composer-autocomplete-closed",
                      option.parentMessageId && "composer-autocomplete-child",
                    )}
                    key={`${option.type}:${option.value}`}
                    onFocus={() =>
                      setAutocomplete((current) => (current ? { ...current, activeIndex: index } : current))
                    }
                    onMouseEnter={() =>
                      setAutocomplete((current) => (current ? { ...current, activeIndex: index } : current))
                    }
                    onMouseDown={(event) => {
                      event.preventDefault();
                      insertAutocompleteOption(option);
                    }}
                    role="option"
                    aria-selected={index === autocomplete.activeIndex}
                  >
                    <span className="composer-autocomplete-kind">{t(option.type)}</span>
                    <span className="composer-autocomplete-main">{option.label}</span>
                    <small>{t(option.detail)}</small>
                  </button>
                ))
              ) : (
                <div className="composer-autocomplete-empty">{t("No references found")}</div>
              )}
            </div>
          ) : null}
        </div>
        <div className="composer-actions">
          <span className={classNames("composer-count", isOverCharacterLimit && "composer-count-limit")}>
            {t("{{count}} chars left", { count: remainingChars })}
          </span>
          {!validation.ok && trimmedBody ? <span className="composer-warning">{validation.reason}</span> : null}
          <span className="composer-tip">
            <CircleHelp size={16} />
            <span role="tooltip">{t("For large notes, post a short message first and then attach a markdown artifact to it.")}</span>
          </span>
          <Button variant="primary" onClick={onSend} disabled={!canSend}>
            <MessageSquareText size={15} />
            {sending ? t("Posting") : t("Post message")}
          </Button>
        </div>
    </section>
  );
}

function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const shortcuts = [
    ["Ctrl+Space", t("Open autocomplete for the current @, #, $, or marc:// reference.")],
    ["ArrowUp / ArrowDown", t("Move through autocomplete suggestions.")],
    ["Enter / Tab", t("Insert the active suggestion.")],
    ["Escape", t("Close autocomplete or this dialog.")],
  ];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-layer modal-layer-global" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="keyboard-shortcuts-title">
        <header className="modal-head">
          <div>
            <h2 id="keyboard-shortcuts-title" className="modal-title-icon">
              <Keyboard size={18} />
              {t("Keyboard shortcuts")}
            </h2>
          </div>
          <Button variant="ghost" className="button-icon" onClick={onClose} title={t("Close")}>
            <X size={18} />
          </Button>
        </header>
        <dl className="shortcut-list">
          {shortcuts.map(([key, description]) => (
            <div className="shortcut-row" key={key}>
              <dt>{key}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function ThreadView({
  payload,
  onAttachArtifact,
  onLink,
  onCopyReference,
}: {
  payload?: ThreadPayload;
  onAttachArtifact: (message: Message) => void;
  onLink: MarkdownLinkHandler;
  onCopyReference: (reference: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();

  if (!payload) {
    return <EmptyState title={t("Loading thread")} detail={t("Waiting for the daemon response.")} />;
  }

  const messages = payload.messages ?? [];
  const summary = payload.summary ? (
    <section className="summary-panel">
      <div className="section-title">
        <Archive size={16} />
        <h2>{t("Executive Summary")}</h2>
      </div>
      <MarkdownPanel markdown={payload.summary} compact onLink={onLink} />
    </section>
  ) : null;

  if (!messages.length) {
    return (
      <>
        {summary}
        {payload.markdown ? (
          <MarkdownPanel markdown={payload.markdown} onLink={onLink} />
        ) : (
          <EmptyState title={t("No messages")} detail={t("This thread has no messages yet.")} />
        )}
      </>
    );
  }

  return (
    <>
      {summary}
      <div className="message-list">
        {messages.map((message) => (
          <article className="message-card" id={`message-${message.id}`} key={message.id}>
            <div className="message-card-head">
              <div className="message-meta">
                <button className="message-reference-pill message-reference-agent" onClick={() => void onCopyReference(`marc://@${message.agentId}`)}>
                  {message.agentId}
                </button>
                {message.role ? <Badge>{message.role}</Badge> : null}
                <button className="message-reference-pill" onClick={() => void onCopyReference(`marc://#${message.id}`)}>
                  #{message.id}
                </button>
                <Badge>{new Date(message.timestamp).toLocaleString()}</Badge>
              </div>
              <div className="message-actions">
                {message.role === "user" ? (
                  <Button
                    variant="ghost"
                    className="button-icon message-action"
                    onClick={() => onAttachArtifact(message)}
                    title={t("Attach markdown artifact")}
                  >
                    <Paperclip size={15} />
                  </Button>
                ) : null}
              </div>
            </div>
            <MarkdownPanel markdown={message.body} compact onLink={onLink} />
            {message.artifacts.length ? (
              <div className="message-artifacts">
                {message.artifacts.map((artifact) => {
                  const href = messageArtifactReference(message.id, artifact);
                  return (
                    <button className="artifact-link" key={artifact} onClick={() => void onLink(href)}>
                      <Paperclip size={14} />
                      <span>{artifact.replace(/^artifacts\//, "")}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}

function ArtifactModal({
  draft,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  draft: ArtifactDraft;
  saving: boolean;
  onChange: (draft: ArtifactDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="modal-layer" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="artifact-modal-title">
        <header className="modal-head">
          <div>
            <div className="eyebrow">
              <Paperclip size={14} />
              {t("Markdown artifact")}
            </div>
            <h2 id="artifact-modal-title">{t("Attach artifact")}</h2>
            <p>{draft.message.id}</p>
          </div>
          <Button variant="ghost" className="button-icon" onClick={onClose} title={t("Close")}>
            <X size={16} />
          </Button>
        </header>

        <label className="modal-field">
          {t("File name")}
          <input
            value={draft.fileName}
            onChange={(event) => onChange({ ...draft, fileName: event.target.value })}
            placeholder={t("decision-notes")}
          />
        </label>

        <label className="modal-field modal-field-grow">
          {t("Markdown")}
          <textarea
            value={draft.content}
            onChange={(event) => onChange({ ...draft, content: event.target.value })}
            placeholder={t("# Notes")}
            rows={16}
          />
        </label>

        <footer className="modal-actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={onSave} disabled={saving || !draft.fileName.trim() || !draft.content.trim()}>
            <Paperclip size={15} />
            {saving ? t("Saving") : t("Attach")}
          </Button>
        </footer>
      </section>
    </div>
  );
}

function ArtifactViewerModal({
  artifact,
  onClose,
  onLink,
}: {
  artifact: ArtifactView;
  onClose: () => void;
  onLink: MarkdownLinkHandler;
}) {
  const { t } = useTranslation();

  return (
    <div className="modal-layer" role="presentation">
      <section className="modal-panel artifact-viewer" role="dialog" aria-modal="true" aria-labelledby="artifact-viewer-title">
        <header className="modal-head">
          <div>
            <div className="eyebrow">
              <Paperclip size={14} />
              {t("Markdown artifact")}
            </div>
            <h2 id="artifact-viewer-title">{artifact.artifact.replace(/^artifacts\//, "")}</h2>
            <p>
              {artifact.threadId} / #{artifact.messageId}
            </p>
          </div>
          <Button variant="ghost" className="button-icon" onClick={onClose} title={t("Close")}>
            <X size={16} />
          </Button>
        </header>
        <div className="artifact-viewer-body">
          <MarkdownPanel markdown={artifact.content} onLink={onLink} />
        </div>
      </section>
    </div>
  );
}

function WorkspaceOverview({ rules, onLink }: { rules: string; onLink: MarkdownLinkHandler }) {
  const { t } = useTranslation();

  return (
    <div className="overview">
      <h3>{t("RULES.md")}</h3>
      <MarkdownPanel markdown={rules || t("No rules loaded yet.")} onLink={onLink} />
    </div>
  );
}

function MarkdownPanel({
  markdown,
  compact = false,
  onLink,
}: {
  markdown: string;
  compact?: boolean;
  onLink?: MarkdownLinkHandler;
}) {
  const linkedMarkdown = useMemo(() => linkifyMarcReferences(markdown), [markdown]);

  return (
    <div className={classNames("markdown-panel", compact && "markdown-panel-compact")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={transformMarkdownUrl}
        components={{
          a: ({ href, children }) => {
            const target = href ?? "";
            const isExternal = /^https?:\/\//i.test(target);
            const marcLabel = parseMarcReference(target) ? marcReferenceLabel(target) : undefined;
            return (
              <a
                href={isExternal ? target : "#"}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noreferrer" : undefined}
                onClick={(event) => {
                  if (!isExternal) {
                    event.preventDefault();
                    onLink?.(target);
                  }
                }}
              >
                {marcLabel ?? children}
              </a>
            );
          },
        }}
      >
        {linkedMarkdown}
      </ReactMarkdown>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
