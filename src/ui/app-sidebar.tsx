import { useTranslation } from "react-i18next";
import {
  Archive,
  AtSign,
  Bot,
  Check,
  KeyRound,
  MessageSquareText,
  RefreshCw,
  UserRound,
  X
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Button,
  EmptyState,
  NavItem,
  classNames,
  isClosedThread,
  parseAgentProfile
} from "./common.js";
import { WorkspaceListSection } from "./workspace-list-section.js";
import type {
  Agent,
  MemoryIndexHealth,
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
  selectedWorkspaceId,
  visibleThreads,
  selectedThreadId,
  middleMode,
  agents,
  selectedAgentId,
  uiAgentId,
  onTokenChange,
  onLockToken,
  onUnlockToken,
  onRefresh,
  onSelectWorkspace,
  onMiddleModeChange,
  onSelectThread,
  onSelectAgent,
  onGoHome
}: {
  token: string;
  tokenLocked: boolean;
  statusKind: StatusKind;
  status: string;
  busy: boolean;
  workspaces: Workspace[];
  memoryHealthByWorkspace: Record<string, MemoryIndexHealth>;
  selectedWorkspaceId?: string;
  visibleThreads: Thread[];
  selectedThreadId?: string;
  middleMode: MiddleMode;
  agents: Agent[];
  selectedAgentId?: string;
  uiAgentId: string;
  onTokenChange: (token: string) => void;
  onLockToken: () => void;
  onUnlockToken: () => void;
  onRefresh: () => void;
  onSelectWorkspace: (workspace: Workspace) => void;
  onMiddleModeChange: (mode: MiddleMode) => void;
  onSelectThread: (thread: Thread) => void;
  onSelectAgent: (agent: Agent) => void;
  onGoHome: () => void;
}) {
  const { t } = useTranslation();
  const middleHeaders = {
    archive: {
      icon: <Archive size={16} />,
      title: t("Closed")
    },
    marckers: {
      icon: <AtSign size={16} />,
      title: t("Marckers")
    },
    threads: {
      icon: <MessageSquareText size={16} />,
      title: t("Threads")
    }
  };
  const middleHeader = middleHeaders[middleMode];
  const modeCloseButton = (
    <Button
      variant="primary"
      className="button-icon"
      onClick={() => onMiddleModeChange("threads")}
      title={t("Close")}
    >
      <X size={15} />
    </Button>
  );
  const middleActions = {
    archive: modeCloseButton,
    marckers: modeCloseButton,
    threads: (
      <>
        <Button
          variant="primary"
          className="button-icon"
          onClick={() => onMiddleModeChange("marckers")}
          title={t("Show Marckers")}
        >
          <AtSign size={15} />
        </Button>
        <Button
          variant="primary"
          className="button-icon"
          onClick={() => onMiddleModeChange("archive")}
          title={t("Show closed threads")}
        >
          <Archive size={15} />
        </Button>
      </>
    )
  };
  const threadEmptyState = {
    archive: {
      title: t("No closed threads"),
      detail: t("Threads with SUMMARY.md will appear here.")
    },
    threads: {
      title: t("No threads"),
      detail: t("Create a thread from an agent to start the room.")
    }
  };
  const threadEmpty =
    middleMode === "archive"
      ? threadEmptyState.archive
      : threadEmptyState.threads;
  const threadList = visibleThreads.length ? (
    visibleThreads.map((thread) => (
      <NavItem
        key={thread.id}
        icon={
          isClosedThread(thread) ? (
            <Archive size={16} />
          ) : (
            <MessageSquareText size={16} />
          )
        }
        title={thread.title}
        detail={
          isClosedThread(thread) && thread.closedAt
            ? t("Closed {{date}}", {
                date: new Date(thread.closedAt).toLocaleString()
              })
            : thread.id
        }
        active={thread.id === selectedThreadId}
        closed={isClosedThread(thread)}
        onClick={() => onSelectThread(thread)}
      />
    ))
  ) : (
    <EmptyState title={threadEmpty.title} detail={threadEmpty.detail} />
  );
  const marckersList = agents.length ? (
    agents.map((agent) => {
      const profile = parseAgentProfile(agent.markdown);
      const isUiUser =
        agent.id === uiAgentId || profile.role?.toLowerCase() === "user";
      return (
        <NavItem
          key={agent.id}
          icon={isUiUser ? <UserRound size={16} /> : <Bot size={16} />}
          title={profile.title}
          detail={profile.role}
          tag={profile.model}
          active={agent.id === selectedAgentId}
          onClick={() => onSelectAgent(agent)}
        />
      );
    })
  ) : (
    <EmptyState
      title={t("No marckers")}
      detail={t("Register a user or agent before posting.")}
    />
  );
  const middleContent = {
    archive: threadList,
    marckers: marckersList,
    threads: threadList
  };

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

      <nav className="middle">
        <section>
          <div className="section-title section-title-split">
            <span className="section-title-main">
              {middleHeader.icon}
              <h2>{middleHeader.title}</h2>
            </span>
            <div className="middle-mode-actions">
              {middleActions[middleMode]}
            </div>
          </div>
          <div className="stack">{middleContent[middleMode]}</div>
        </section>
      </nav>
    </>
  );
}
