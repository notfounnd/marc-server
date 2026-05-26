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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
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
      <div className="content-scroll">
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
                <button
                  className="copy-reference-button"
                  onClick={() =>
                    void onCopyReference(`marc://$${selectedThread.id}`)
                  }
                  title={t("Copy thread reference")}
                >
                  <span>{selectedThread.id}</span>
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
                  <DropdownMenu
                    open={showArtifactMenu}
                    onOpenChange={onShowArtifactMenuChange}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={showArtifactMenu ? "primary" : "secondary"}
                        className="button-icon"
                        title={t("Show thread artifacts")}
                      >
                        <Paperclip size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="artifact-menu">
                      <DropdownMenuLabel className="artifact-menu-head">
                        <Paperclip size={14} />
                        <span>{t("Artifacts")}</span>
                      </DropdownMenuLabel>
                      <div className="artifact-menu-list">
                        {selectedThreadArtifacts.map(
                          ({ message, artifact, href }) => (
                            <DropdownMenuItem
                              className="artifact-menu-item"
                              key={`${message.id}:${artifact}`}
                              onSelect={() => void onOpenLink(href)}
                            >
                              <span>
                                {artifact.replace(/^artifacts\//, "")}
                              </span>
                              <small>#{message.id}</small>
                            </DropdownMenuItem>
                          )
                        )}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
          <MarkdownPanel
            markdown={selectedAgent.markdown}
            onLink={onOpenLink}
          />
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
      </div>
      <footer className="content-footer">
        <span className="content-footer-credit">
          {t("Developed by Júnior Sbrissa")}
        </span>
        <span className="content-footer-divider" aria-hidden="true" />
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
