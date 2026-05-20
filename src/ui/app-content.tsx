import { useTranslation } from "react-i18next";
import {
  Archive,
  CircleAlert,
  Clock3,
  Copy,
  FileText,
  Keyboard,
  Paperclip,
  RefreshCw
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  classNames,
  isClosedThread,
  parseAgentProfile
} from "./common.js";
import { Composer } from "./composer.js";
import { MarkdownPanel } from "./markdown-panel.js";
import { ThreadView } from "./thread-view.js";
import type {
  Agent,
  ArtifactMenuItem,
  MarkdownLinkHandler,
  Message,
  StatusKind,
  Thread,
  ThreadIndexHealth,
  ThreadPayload,
  Workspace
} from "./types.js";
import { WorkspaceOverview } from "./workspace-overview.js";

export function AppContent({
  statusKind,
  lastSyncedAt,
  selectedThreadIndexHealth,
  selectedThread,
  selectedAgent,
  selectedWorkspace,
  selectedThreadArtifacts,
  showArtifactMenu,
  threadPayload,
  uiAgentId,
  composerBody,
  agents,
  allWorkspaceThreads,
  sending,
  rules,
  onShowArtifactMenuChange,
  onCopyReference,
  onOpenLink,
  onAttachArtifact,
  onAgentIdChange,
  onBodyChange,
  onSendMessage,
  onLoadThreadMessages,
  onShowShortcuts
}: {
  statusKind: StatusKind;
  lastSyncedAt?: Date;
  selectedThreadIndexHealth?: ThreadIndexHealth;
  selectedThread?: Thread;
  selectedAgent?: Agent;
  selectedWorkspace?: Workspace;
  selectedThreadArtifacts: ArtifactMenuItem[];
  showArtifactMenu: boolean;
  threadPayload?: ThreadPayload;
  uiAgentId: string;
  composerBody: string;
  agents: Agent[];
  allWorkspaceThreads: Thread[];
  sending: boolean;
  rules: string;
  onShowArtifactMenuChange: (show: boolean) => void;
  onCopyReference: (reference: string) => void | Promise<void>;
  onOpenLink: MarkdownLinkHandler;
  onAttachArtifact: (message: Message) => void;
  onAgentIdChange: (agentId: string) => void;
  onBodyChange: (body: string) => void;
  onSendMessage: () => void;
  onLoadThreadMessages: (threadId: string) => Promise<Message[]>;
  onShowShortcuts: () => void;
}) {
  const { t } = useTranslation();

  return (
    <main className="content">
      <header className="content-header">
        <div>
          <div className="eyebrow">
            <FileText size={14} />
            {selectedThread
              ? t("Thread")
              : selectedAgent
                ? t("Agent")
                : t("Workspace")}
          </div>
          <h2
            className={classNames(
              selectedThread &&
                isClosedThread(selectedThread) &&
                "content-title-closed"
            )}
          >
            {selectedThread?.title ??
              (selectedAgent
                ? parseAgentProfile(selectedAgent.markdown).title
                : (selectedWorkspace?.name ?? "mARC"))}
          </h2>
          {selectedThread ? (
            <p className="thread-reference-row">
              <span>{selectedThread.id}</span>
              <button
                className="copy-reference-button"
                onClick={() =>
                  void onCopyReference(`marc://$${selectedThread.id}`)
                }
                title={t("Copy thread reference")}
              >
                <Copy size={13} />
              </button>
            </p>
          ) : (
            <p>
              {selectedAgent?.id ??
                selectedWorkspace?.rootPath ??
                t("Lock the token to start syncing.")}
            </p>
          )}
        </div>
        <div className="content-side">
          <div className="content-badges">
            <Badge
              tone={
                statusKind === "ok"
                  ? "green"
                  : statusKind === "error" || statusKind === "warn"
                    ? "amber"
                    : "neutral"
              }
            >
              <Clock3 size={13} />
              {lastSyncedAt
                ? t("Synced {{time}}", {
                    time: lastSyncedAt.toLocaleTimeString()
                  })
                : t("Not synced")}
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
            ) : selectedThreadIndexHealth?.status === "degraded" ||
              selectedThreadIndexHealth?.status === "unavailable" ? (
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
                  onClick={() => onShowArtifactMenuChange(!showArtifactMenu)}
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
                      {selectedThreadArtifacts.map(
                        ({ message, artifact, href }) => (
                          <button
                            className="artifact-menu-item"
                            key={`${message.id}:${artifact}`}
                            onClick={() => {
                              onShowArtifactMenuChange(false);
                              void onOpenLink(href);
                            }}
                          >
                            <span>{artifact.replace(/^artifacts\//, "")}</span>
                            <small>#{message.id}</small>
                          </button>
                        )
                      )}
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
            onAttachArtifact={onAttachArtifact}
            onLink={onOpenLink}
            onCopyReference={onCopyReference}
          />
          <Composer
            agentId={uiAgentId}
            body={composerBody}
            agents={agents}
            threads={allWorkspaceThreads}
            messages={threadPayload?.messages ?? []}
            sending={sending}
            onAgentIdChange={onAgentIdChange}
            onBodyChange={onBodyChange}
            onSend={onSendMessage}
            loadThreadMessages={onLoadThreadMessages}
          />
        </>
      ) : selectedAgent ? (
        <MarkdownPanel markdown={selectedAgent.markdown} onLink={onOpenLink} />
      ) : selectedWorkspace ? (
        <WorkspaceOverview rules={rules} onLink={onOpenLink} />
      ) : (
        <EmptyState
          title={t("No workspace selected")}
          detail={t(
            "Save the daemon token and select a workspace from the sidebar."
          )}
        />
      )}
      <footer className="content-footer">
        <span aria-hidden="true" />
        <a
          href="#keyboard-shortcuts"
          className="content-footer-link"
          onClick={(event) => {
            event.preventDefault();
            onShowShortcuts();
          }}
          title={t("Keyboard shortcuts")}
        >
          <Keyboard size={15} />
        </a>
      </footer>
    </main>
  );
}
