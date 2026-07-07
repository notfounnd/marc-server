import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/sonner";
import { messageArtifactReference } from "../core/marc-references.js";
import { createAppActions } from "./app-actions.js";
import { AppContent } from "./app-content.js";
import { AppModals } from "./app-modals.js";
import { AppSidebar } from "./app-sidebar.js";
import { useAppSync } from "./app-sync.js";
import { classNames, isClosedThread } from "./common.js";
import type {
  Agent,
  ArtifactDraft,
  ArtifactMenuItem,
  ArtifactView,
  MemoryIndexHealth,
  MiddleMode,
  StatusKind,
  Thread,
  ThreadIndexHealth,
  ThreadPayload,
  Workspace
} from "./types.js";
import "./i18n.js";
import "./styles.css";

function App() {
  const { t } = useTranslation();
  const [token, setToken] = useState(
    () => localStorage.getItem("marcToken") ?? ""
  );
  const [tokenLocked, setTokenLocked] = useState(
    () => localStorage.getItem("marcTokenLocked") === "true"
  );
  const [statusKind, setStatusKind] = useState<StatusKind>("idle");
  const [status, setStatus] = useState(() => t("Token required"));
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [closedThreads, setClosedThreads] = useState<Thread[]>([]);
  const [middleMode, setMiddleMode] = useState<MiddleMode>("threads");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [rules, setRules] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>();
  const [selectedThreadId, setSelectedThreadId] = useState<string>();
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [threadPayload, setThreadPayload] = useState<ThreadPayload>();
  const [uiAgentId, setUiAgentId] = useState(
    () => localStorage.getItem("marcUiAgentId") ?? "ui-user"
  );
  const [composerBody, setComposerBody] = useState("");
  const [sending, setSending] = useState(false);
  const [artifactDraft, setArtifactDraft] = useState<ArtifactDraft>();
  const [artifactView, setArtifactView] = useState<ArtifactView>();
  const [showArtifactMenu, setShowArtifactMenu] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [savingArtifact, setSavingArtifact] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>();
  const [threadIndexHealthByWorkspace, setThreadIndexHealthByWorkspace] =
    useState<Record<string, ThreadIndexHealth>>({});
  const [memoryHealthByWorkspace, setMemoryHealthByWorkspace] = useState<
    Record<string, MemoryIndexHealth>
  >({});
  const [busy, setBusy] = useState(false);
  const lastRefreshAtRef = useRef(0);
  const busyRef = useRef(false);
  const selectedWorkspaceIdRef = useRef<string | undefined>(undefined);
  const selectedThreadIdRef = useRef<string | undefined>(undefined);
  const autocompleteThreadPayloadRef = useRef(new Map<string, ThreadPayload>());
  const liveRefreshTimerRef = useRef<number | undefined>(undefined);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId),
    [selectedWorkspaceId, workspaces]
  );
  const selectedThreadIndexHealth = selectedWorkspaceId
    ? threadIndexHealthByWorkspace[selectedWorkspaceId]
    : undefined;
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId),
    [selectedAgentId, agents]
  );
  const archivedThreads = useMemo(() => {
    const byId = new Map<string, Thread>();
    for (const thread of [...closedThreads, ...threads].filter(
      isClosedThread
    )) {
      byId.set(thread.id, thread);
    }
    return Array.from(byId.values()).sort((a, b) =>
      (b.closedAt ?? "").localeCompare(a.closedAt ?? "")
    );
  }, [closedThreads, threads]);
  const closedThreadIds = useMemo(
    () => new Set(archivedThreads.map((thread) => thread.id)),
    [archivedThreads]
  );
  const openThreads = useMemo(
    () =>
      threads.filter(
        (thread) => !isClosedThread(thread) && !closedThreadIds.has(thread.id)
      ),
    [closedThreadIds, threads]
  );
  const allWorkspaceThreads = useMemo(() => {
    const byId = new Map<string, Thread>();
    for (const thread of [...openThreads, ...archivedThreads]) {
      byId.set(thread.id, thread);
    }
    return Array.from(byId.values());
  }, [archivedThreads, openThreads]);
  const visibleThreads =
    middleMode === "archive" ? archivedThreads : openThreads;
  const selectedThread = useMemo(
    () =>
      archivedThreads.find((thread) => thread.id === selectedThreadId) ??
      openThreads.find((thread) => thread.id === selectedThreadId),
    [archivedThreads, openThreads, selectedThreadId]
  );
  const selectedThreadArtifacts = useMemo<ArtifactMenuItem[]>(
    () =>
      (threadPayload?.messages ?? []).flatMap((message) =>
        message.artifacts.map((artifact) => ({
          message,
          artifact,
          href: messageArtifactReference(message.id, artifact)
        }))
      ),
    [threadPayload?.messages]
  );

  useEffect(() => {
    selectedWorkspaceIdRef.current = selectedWorkspaceId;
    setMiddleMode("threads");
  }, [selectedWorkspaceId]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
    setShowArtifactMenu(false);
  }, [selectedThreadId]);

  const modalOpen = Boolean(artifactDraft || artifactView || showShortcuts);

  useEffect(() => {
    document.body.classList.toggle("modal-open", modalOpen);
    return () => document.body.classList.remove("modal-open");
  }, [modalOpen]);

  const { api, apiPost, refresh } = useAppSync({
    t,
    token,
    tokenLocked,
    busyRef,
    lastRefreshAtRef,
    selectedWorkspaceIdRef,
    selectedThreadIdRef,
    liveRefreshTimerRef,
    setBusy,
    setThreadIndexHealthByWorkspace,
    setMemoryHealthByWorkspace,
    setWorkspaces,
    setSelectedWorkspaceId,
    setSelectedThreadId,
    setSelectedAgentId,
    setThreads,
    setClosedThreads,
    setMiddleMode,
    setAgents,
    setRules,
    setThreadPayload,
    setStatusKind,
    setStatus,
    setLastSyncedAt
  });

  const appActions = createAppActions({
    t,
    token,
    selectedWorkspace,
    selectedThread,
    selectedWorkspaceIdRef,
    selectedThreadIdRef,
    autocompleteThreadPayloadRef,
    openThreads,
    archivedThreads,
    allWorkspaceThreads,
    threadPayload,
    composerBody,
    uiAgentId,
    sending,
    artifactDraft,
    savingArtifact,
    agents,
    api,
    apiPost,
    refresh,
    setToken,
    setTokenLocked,
    setStatusKind,
    setStatus,
    setSelectedWorkspaceId,
    setSelectedThreadId,
    setSelectedAgentId,
    setMiddleMode,
    setThreadPayload,
    setUiAgentId,
    setSending,
    setComposerBody,
    setArtifactDraft,
    setArtifactView,
    setSavingArtifact,
    setLastSyncedAt
  });

  return (
    <div className={classNames("shell", modalOpen && "shell-modal-open")}>
      <AppSidebar
        token={token}
        tokenLocked={tokenLocked}
        statusKind={statusKind}
        status={status}
        busy={busy}
        workspaces={workspaces}
        memoryHealthByWorkspace={memoryHealthByWorkspace}
        selectedWorkspaceId={selectedWorkspaceId}
        visibleThreads={visibleThreads}
        selectedThreadId={selectedThreadId}
        middleMode={middleMode}
        agents={agents}
        selectedAgentId={selectedAgentId}
        uiAgentId={uiAgentId}
        onTokenChange={setToken}
        onLockToken={appActions.lockToken}
        onUnlockToken={appActions.unlockToken}
        onRefresh={() => void refresh({ force: true, includeThread: true })}
        onSelectWorkspace={(workspace) =>
          void appActions.selectWorkspace(workspace)
        }
        onMiddleModeChange={setMiddleMode}
        onSelectThread={(thread) => void appActions.selectThread(thread)}
        onSelectAgent={appActions.selectAgent}
        onGoHome={appActions.goHome}
      />
      <AppContent
        statusKind={statusKind}
        lastSyncedAt={lastSyncedAt}
        selectedThreadIndexHealth={selectedThreadIndexHealth}
        selectedThread={selectedThread}
        selectedAgent={selectedAgent}
        selectedWorkspace={selectedWorkspace}
        selectedThreadArtifacts={selectedThreadArtifacts}
        showArtifactMenu={showArtifactMenu}
        threadPayload={threadPayload}
        uiAgentId={uiAgentId}
        composerBody={composerBody}
        agents={agents}
        allWorkspaceThreads={allWorkspaceThreads}
        sending={sending}
        rules={rules}
        onShowArtifactMenuChange={setShowArtifactMenu}
        onCopyReference={appActions.copyReference}
        onOpenLink={appActions.handleMarkdownLink}
        onAttachArtifact={(message) =>
          setArtifactDraft({ message, fileName: "", content: "" })
        }
        onAgentIdChange={setUiAgentId}
        onBodyChange={setComposerBody}
        onSendMessage={() => void appActions.sendUiMessage()}
        onLoadThreadMessages={appActions.loadAutocompleteThreadMessages}
        onShowShortcuts={() => setShowShortcuts(true)}
      />
      <AppModals
        artifactDraft={artifactDraft}
        artifactView={artifactView}
        savingArtifact={savingArtifact}
        showShortcuts={showShortcuts}
        onArtifactDraftChange={setArtifactDraft}
        onArtifactSave={() => void appActions.saveArtifact()}
        onArtifactViewClose={() => setArtifactView(undefined)}
        onLink={appActions.handleMarkdownLink}
        onShortcutsClose={() => setShowShortcuts(false)}
      />
      <Toaster position="bottom-right" />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
