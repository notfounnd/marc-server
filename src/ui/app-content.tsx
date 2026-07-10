import { useTranslation } from "react-i18next";
import { Keyboard } from "lucide-react";
import { EmptyState } from "./common.js";
import { Composer } from "./composer.js";
import { ContentHeader } from "./content-header.js";
import { MarkdownPanel } from "./markdown-panel.js";
import { ThreadView } from "./thread-view.js";
import type { AppContentProps } from "./app-content-types.js";
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
  showWorkspaceSettings,
  threadPayload,
  uiAgentId,
  composerBody,
  agents,
  allWorkspaceThreads,
  sending,
  rules,
  onShowArtifactMenuChange,
  onShowWorkspaceSettingsChange,
  onCopyReference,
  onOpenLink,
  onAttachArtifact,
  onAgentIdChange,
  onBodyChange,
  onSendMessage,
  onLoadThreadMessages,
  onShowShortcuts
}: AppContentProps) {
  const { t } = useTranslation();

  return (
    <main className="content">
      <div className="content-scroll">
        <ContentHeader
          statusKind={statusKind}
          lastSyncedAt={lastSyncedAt}
          selectedAgent={selectedAgent}
          selectedThread={selectedThread}
          selectedThreadArtifacts={selectedThreadArtifacts}
          selectedThreadIndexHealth={selectedThreadIndexHealth}
          selectedWorkspace={selectedWorkspace}
          showArtifactMenu={showArtifactMenu}
          showWorkspaceSettings={showWorkspaceSettings}
          onCopyReference={onCopyReference}
          onOpenLink={onOpenLink}
          onShowArtifactMenuChange={onShowArtifactMenuChange}
          onShowWorkspaceSettingsChange={onShowWorkspaceSettingsChange}
        />

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
