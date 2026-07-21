import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/sonner";
import { createAppActions } from "./app-actions.js";
import { AppContent } from "./app-content.js";
import { AppModals } from "./app-modals.js";
import { AppSidebar } from "./app-sidebar.js";
import { useAppSync } from "./app-sync.js";
import {
  useModalBodyLock,
  useWorkspaceSelectionEffects
} from "./use-app-shell-effects.js";
import { classNames } from "./common.js";
import { useMemorySearch } from "./use-memory-search.js";
import { useThreadNavigation } from "./use-thread-navigation.js";
import { useWorkspaceMemoryActions } from "./use-workspace-memory-actions.js";
import type {
  Agent,
  ArtifactDraft,
  ArtifactView,
  MemoryIndexHealth,
  MiddleMode,
  StatusKind,
  Thread,
  ThreadIndexHealth,
  ThreadPayload,
  Workspace
} from "./types.js";

export function App() {
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
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
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
  const selectedMemoryHealth = selectedWorkspaceId
    ? memoryHealthByWorkspace[selectedWorkspaceId]
    : undefined;
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId),
    [selectedAgentId, agents]
  );
  const {
    allWorkspaceThreads,
    archivedThreads,
    openThreads,
    selectedThread,
    selectedThreadArtifacts,
    visibleThreads
  } = useThreadNavigation({
    closedThreads,
    middleMode,
    selectedThreadId,
    threadPayload,
    threads
  });

  useWorkspaceSelectionEffects({
    selectedThreadId,
    selectedThreadIdRef,
    selectedWorkspaceId,
    selectedWorkspaceIdRef,
    setMiddleMode,
    setShowArtifactMenu,
    setShowWorkspaceSettings
  });

  const modalOpen = Boolean(
    artifactDraft || artifactView || showShortcuts || showWorkspaceSettings
  );
  useModalBodyLock(modalOpen);

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
  const memorySearch = useMemorySearch({
    allWorkspaceThreads,
    apiPost,
    selectedMemoryHealth,
    selectedWorkspace,
    t,
    onSelectThread: appActions.selectThread,
    onStatusChange: (kind, nextStatus) => {
      setStatusKind(kind);
      setStatus(nextStatus);
    }
  });

  const workspaceMemoryActions = useWorkspaceMemoryActions({
    apiPost,
    refresh,
    selectedMemoryHealth,
    selectedWorkspace,
    setStatus,
    setStatusKind
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
        selectedMemoryHealth={selectedMemoryHealth}
        selectedWorkspaceId={selectedWorkspaceId}
        allWorkspaceThreads={allWorkspaceThreads}
        visibleThreads={visibleThreads}
        selectedThreadId={selectedThreadId}
        middleMode={middleMode}
        agents={agents}
        selectedAgentId={selectedAgentId}
        uiAgentId={uiAgentId}
        memorySearchQuery={memorySearch.query}
        memorySearchResult={memorySearch.result}
        memorySearchStatus={memorySearch.status}
        memorySearchError={memorySearch.error}
        memorySearchDeepRetryAvailable={memorySearch.deepRetryAvailable}
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
        onMemorySearchQueryChange={memorySearch.setQuery}
        onMemorySearchSubmit={() => void memorySearch.runSearch()}
        onMemorySearchDeepRetry={() => void memorySearch.runDeepRetry()}
        onSelectMemorySearchHit={memorySearch.selectHit}
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
        showWorkspaceSettings={showWorkspaceSettings}
        threadPayload={threadPayload}
        uiAgentId={uiAgentId}
        composerBody={composerBody}
        agents={agents}
        allWorkspaceThreads={allWorkspaceThreads}
        sending={sending}
        rules={rules}
        onShowArtifactMenuChange={setShowArtifactMenu}
        onShowWorkspaceSettingsChange={setShowWorkspaceSettings}
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
        selectedMemoryHealth={selectedMemoryHealth}
        selectedWorkspace={selectedWorkspace}
        showShortcuts={showShortcuts}
        showWorkspaceSettings={showWorkspaceSettings}
        onArtifactDraftChange={setArtifactDraft}
        onArtifactSave={() => void appActions.saveArtifact()}
        onArtifactViewClose={() => setArtifactView(undefined)}
        onLink={appActions.handleMarkdownLink}
        onPrepareMemoryModel={workspaceMemoryActions.prepareMemoryModel}
        onRebuildMemory={workspaceMemoryActions.rebuildMemoryIndex}
        onShowWorkspaceSettingsChange={setShowWorkspaceSettings}
        onShortcutsClose={() => setShowShortcuts(false)}
        onWorkspaceAutoRebuildChange={
          workspaceMemoryActions.updateWorkspaceAutoRebuild
        }
        onWorkspaceEmbeddingBatchSizeChange={
          workspaceMemoryActions.updateWorkspaceEmbeddingBatchSize
        }
        onWorkspaceSearchRetryDepthChange={
          workspaceMemoryActions.updateWorkspaceSearchRetryDepth
        }
      />
      <Toaster position="bottom-right" />
    </div>
  );
}
