import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { messageArtifactReference } from "../core/marc-references.js";
import { createAppActions } from "./app-actions.js";
import { AppContent } from "./app-content.js";
import { AppSidebar } from "./app-sidebar.js";
import { useAppSync } from "./app-sync.js";
import { classNames, isClosedThread } from "./common.js";
import {
  ArtifactModal,
  ArtifactViewerModal,
  KeyboardShortcutsModal
} from "./modals.js";
import type {
  Agent,
  ArtifactDraft,
  ArtifactMenuItem,
  ArtifactView,
  StatusKind,
  Thread,
  ThreadIndexHealth,
  ThreadPayload,
  Toast,
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
  const [busy, setBusy] = useState(false);
  const lastRefreshAtRef = useRef(0);
  const busyRef = useRef(false);
  const selectedWorkspaceIdRef = useRef<string | undefined>(undefined);
  const selectedThreadIdRef = useRef<string | undefined>(undefined);
  const autocompleteThreadPayloadRef = useRef(new Map<string, ThreadPayload>());
  const liveRefreshTimerRef = useRef<number | undefined>(undefined);
  const toastTimerRef = useRef<number | undefined>(undefined);

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
  const visibleThreads = showClosedThreads ? archivedThreads : openThreads;
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
    setWorkspaces,
    setSelectedWorkspaceId,
    setSelectedThreadId,
    setSelectedAgentId,
    setThreads,
    setClosedThreads,
    setShowClosedThreads,
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
    toastTimerRef,
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
    setShowClosedThreads,
    setThreadPayload,
    setUiAgentId,
    setSending,
    setComposerBody,
    setArtifactDraft,
    setArtifactView,
    setSavingArtifact,
    setLastSyncedAt,
    setToast
  });

  return (
    <div className="shell">
      <AppSidebar
        token={token}
        tokenLocked={tokenLocked}
        statusKind={statusKind}
        status={status}
        busy={busy}
        workspaces={workspaces}
        selectedWorkspaceId={selectedWorkspaceId}
        visibleThreads={visibleThreads}
        selectedThreadId={selectedThreadId}
        showClosedThreads={showClosedThreads}
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
        onShowClosedThreadsChange={setShowClosedThreads}
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
      {artifactDraft ? (
        <ArtifactModal
          draft={artifactDraft}
          saving={savingArtifact}
          onChange={setArtifactDraft}
          onClose={() => setArtifactDraft(undefined)}
          onSave={() => void appActions.saveArtifact()}
        />
      ) : null}
      {artifactView ? (
        <ArtifactViewerModal
          artifact={artifactView}
          onClose={() => setArtifactView(undefined)}
          onLink={appActions.handleMarkdownLink}
        />
      ) : null}
      {showShortcuts ? (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      ) : null}
      {toast ? (
        <div
          className={classNames("toast", `toast-${toast.kind}`)}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
