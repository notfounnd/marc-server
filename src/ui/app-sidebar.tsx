import { Check, KeyRound, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, classNames } from "./common.js";
import { AppSidebarMiddle } from "./app-sidebar-middle.js";
import { WorkspaceListSection } from "./workspace-list-section.js";
import type {
  Agent,
  MemoryIndexHealth,
  MemoryRecallHit,
  MemoryRecallResult,
  MemorySearchStatus,
  MiddleMode,
  StatusKind,
  Thread,
  Workspace
} from "./types.js";

export function AppSidebar({
  token,
  tokenLocked,
  statusKind,
  status,
  busy,
  workspaces,
  memoryHealthByWorkspace,
  selectedMemoryHealth,
  selectedWorkspaceId,
  allWorkspaceThreads,
  visibleThreads,
  selectedThreadId,
  middleMode,
  agents,
  selectedAgentId,
  uiAgentId,
  memorySearchQuery,
  memorySearchResult,
  memorySearchStatus,
  memorySearchError,
  onTokenChange,
  onLockToken,
  onUnlockToken,
  onRefresh,
  onSelectWorkspace,
  onMiddleModeChange,
  onSelectThread,
  onSelectAgent,
  onMemorySearchQueryChange,
  onMemorySearchSubmit,
  onSelectMemorySearchHit,
  onGoHome
}: {
  token: string;
  tokenLocked: boolean;
  statusKind: StatusKind;
  status: string;
  busy: boolean;
  workspaces: Workspace[];
  memoryHealthByWorkspace: Record<string, MemoryIndexHealth>;
  selectedMemoryHealth?: MemoryIndexHealth;
  selectedWorkspaceId?: string;
  allWorkspaceThreads: Thread[];
  visibleThreads: Thread[];
  selectedThreadId?: string;
  middleMode: MiddleMode;
  agents: Agent[];
  selectedAgentId?: string;
  uiAgentId: string;
  memorySearchQuery: string;
  memorySearchResult?: MemoryRecallResult;
  memorySearchStatus: MemorySearchStatus;
  memorySearchError?: string;
  onTokenChange: (token: string) => void;
  onLockToken: () => void;
  onUnlockToken: () => void;
  onRefresh: () => void;
  onSelectWorkspace: (workspace: Workspace) => void;
  onMiddleModeChange: (mode: MiddleMode) => void;
  onSelectThread: (thread: Thread) => void;
  onSelectAgent: (agent: Agent) => void;
  onMemorySearchQueryChange: (query: string) => void;
  onMemorySearchSubmit: () => void;
  onSelectMemorySearchHit: (hit: MemoryRecallHit) => void;
  onGoHome: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <button
            className="brand-mark"
            onClick={onGoHome}
            title={t("Home")}
            aria-label={t("Home")}
          >
            m
          </button>
          <div className="content-title-block">
            <h1>mARC</h1>
          </div>
        </div>
        <p className="brand-tagline">{t("Shared context for coding agents")}</p>

        <Card className="panel token-panel">
          <div className="panel-heading">
            <KeyRound size={16} />
            <span>{t("Daemon token")}</span>
          </div>
          <Input
            value={token}
            disabled={tokenLocked}
            onChange={(event) => onTokenChange(event.target.value)}
            type="password"
            placeholder={t("Paste token")}
          />
          <div className="token-actions">
            {tokenLocked ? (
              <Button variant="primary" onClick={onUnlockToken}>
                {t("Change token")}
              </Button>
            ) : (
              <Button variant="primary" onClick={onLockToken}>
                <Check size={15} />
                {t("Save and lock")}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={onRefresh}
              disabled={!tokenLocked || busy}
              title={t("Refresh now")}
            >
              <RefreshCw size={15} className={busy ? "spin" : ""} />
            </Button>
          </div>
          <div className={classNames("connection", statusKind)}>
            <span />
            <p>{status}</p>
          </div>
        </Card>

        <WorkspaceListSection
          memoryHealthByWorkspace={memoryHealthByWorkspace}
          onSelectWorkspace={onSelectWorkspace}
          selectedWorkspaceId={selectedWorkspaceId}
          t={t}
          workspaces={workspaces}
        />
      </aside>

      <AppSidebarMiddle
        agents={agents}
        allWorkspaceThreads={allWorkspaceThreads}
        memorySearchError={memorySearchError}
        memorySearchQuery={memorySearchQuery}
        memorySearchResult={memorySearchResult}
        memorySearchStatus={memorySearchStatus}
        middleMode={middleMode}
        selectedAgentId={selectedAgentId}
        selectedMemoryHealth={selectedMemoryHealth}
        selectedThreadId={selectedThreadId}
        t={t}
        uiAgentId={uiAgentId}
        visibleThreads={visibleThreads}
        onMemorySearchQueryChange={onMemorySearchQueryChange}
        onMemorySearchSubmit={onMemorySearchSubmit}
        onMiddleModeChange={onMiddleModeChange}
        onSelectAgent={onSelectAgent}
        onSelectMemorySearchHit={onSelectMemorySearchHit}
        onSelectThread={onSelectThread}
      />
    </>
  );
}
