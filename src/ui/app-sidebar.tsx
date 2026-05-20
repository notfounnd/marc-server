import { useTranslation } from "react-i18next";
import {
  Archive,
  AtSign,
  Bot,
  Check,
  KeyRound,
  MessageSquareText,
  RefreshCw,
  Server,
  UserRound,
  X
} from "lucide-react";
import {
  Button,
  EmptyState,
  NavItem,
  classNames,
  isClosedThread,
  parseAgentProfile
} from "./common.js";
import type { Agent, StatusKind, Thread, Workspace } from "./types.js";

export function AppSidebar({
  token,
  tokenLocked,
  statusKind,
  status,
  busy,
  workspaces,
  selectedWorkspaceId,
  visibleThreads,
  selectedThreadId,
  showClosedThreads,
  agents,
  selectedAgentId,
  uiAgentId,
  onTokenChange,
  onLockToken,
  onUnlockToken,
  onRefresh,
  onSelectWorkspace,
  onShowClosedThreadsChange,
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
  selectedWorkspaceId?: string;
  visibleThreads: Thread[];
  selectedThreadId?: string;
  showClosedThreads: boolean;
  agents: Agent[];
  selectedAgentId?: string;
  uiAgentId: string;
  onTokenChange: (token: string) => void;
  onLockToken: () => void;
  onUnlockToken: () => void;
  onRefresh: () => void;
  onSelectWorkspace: (workspace: Workspace) => void;
  onShowClosedThreadsChange: (showClosedThreads: boolean) => void;
  onSelectThread: (thread: Thread) => void;
  onSelectAgent: (agent: Agent) => void;
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

        <section className="panel token-panel">
          <div className="panel-heading">
            <KeyRound size={16} />
            <span>{t("Daemon token")}</span>
          </div>
          <input
            value={token}
            disabled={tokenLocked}
            onChange={(event) => onTokenChange(event.target.value)}
            type="password"
            placeholder={t("Paste token")}
          />
          <div className="token-actions">
            {tokenLocked ? (
              <Button variant="ghost" onClick={onUnlockToken}>
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
                  onClick={() => onSelectWorkspace(workspace)}
                />
              ))
            ) : (
              <EmptyState
                title={t("No workspaces")}
                detail={t("Ask an agent to register a project in mARC.")}
              />
            )}
          </div>
        </section>
      </aside>

      <nav className="middle">
        <section>
          <div className="section-title section-title-split">
            <span className="section-title-main">
              {showClosedThreads ? (
                <Archive size={16} />
              ) : (
                <MessageSquareText size={16} />
              )}
              <h2>{showClosedThreads ? t("Closed") : t("Threads")}</h2>
            </span>
            <Button
              variant={showClosedThreads ? "primary" : "ghost"}
              className="button-icon"
              onClick={() => onShowClosedThreadsChange(!showClosedThreads)}
              title={
                showClosedThreads
                  ? t("Show open threads")
                  : t("Show closed threads")
              }
            >
              {showClosedThreads ? <X size={15} /> : <Archive size={15} />}
            </Button>
          </div>
          <div className="stack">
            {visibleThreads.length ? (
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
              <EmptyState
                title={
                  showClosedThreads ? t("No closed threads") : t("No threads")
                }
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
                const isUiUser =
                  agent.id === uiAgentId ||
                  profile.role?.toLowerCase() === "user";
                return (
                  <NavItem
                    key={agent.id}
                    icon={
                      isUiUser ? <UserRound size={16} /> : <Bot size={16} />
                    }
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
            )}
          </div>
        </section>
      </nav>
    </>
  );
}
