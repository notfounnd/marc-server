import * as React from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, Settings } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button, isClosedThread } from "./common.js";
import { HeaderMenu } from "./header-menu.js";
import { ThreadActivationMenu } from "./thread-activation-menu.js";
import type {
  Agent,
  ApiGet,
  ApiWrite,
  ArtifactMenuItem,
  MarkdownLinkHandler,
  Thread,
  Workspace
} from "./types.js";
import { ThreadSessionsMenu } from "./thread-sessions-menu.js";
import { WorkspacePauseControl } from "./workspace-pause-control.js";

export function ContentHeaderActions({
  api,
  apiPost,
  apiPut,
  lastSyncedAt,
  selectedAgent,
  selectedThread,
  selectedThreadArtifacts,
  selectedWorkspace,
  showArtifactMenu,
  showWorkspaceSettings,
  onOpenLink,
  onShowArtifactMenuChange,
  onShowWorkspaceSettingsChange
}: {
  api: ApiGet;
  apiPost: ApiWrite;
  apiPut: ApiWrite;
  lastSyncedAt?: Date;
  selectedAgent?: Agent;
  selectedThread?: Thread;
  selectedThreadArtifacts: ArtifactMenuItem[];
  selectedWorkspace?: Workspace;
  showArtifactMenu: boolean;
  showWorkspaceSettings: boolean;
  onOpenLink: MarkdownLinkHandler;
  onShowArtifactMenuChange: (show: boolean) => void;
  onShowWorkspaceSettingsChange: (show: boolean) => void;
}) {
  return (
    <div className="content-actions">
      <div className="action-row content-action-row">
        <ThreadArtifactMenu
          selectedThread={selectedThread}
          selectedThreadArtifacts={selectedThreadArtifacts}
          showArtifactMenu={showArtifactMenu}
          onOpenLink={onOpenLink}
          onShowArtifactMenuChange={onShowArtifactMenuChange}
        />
        <ThreadActivationSlot
          apiPost={apiPost}
          apiPut={apiPut}
          selectedThread={selectedThread}
          selectedWorkspace={selectedWorkspace}
          onOpenLink={onOpenLink}
        />
        <ThreadSessionsSlot
          api={api}
          lastSyncedAt={lastSyncedAt}
          selectedThread={selectedThread}
          selectedWorkspace={selectedWorkspace}
          onOpenLink={onOpenLink}
        />
      </div>
      <WorkspaceActionsRow
        api={api}
        apiPost={apiPost}
        lastSyncedAt={lastSyncedAt}
        selectedAgent={selectedAgent}
        selectedThread={selectedThread}
        selectedWorkspace={selectedWorkspace}
        showWorkspaceSettings={showWorkspaceSettings}
        onShowWorkspaceSettingsChange={onShowWorkspaceSettingsChange}
      />
    </div>
  );
}

/**
 * The thread policy trigger. It is hidden without a thread, like the sessions trigger, and in a
 * closed thread, whose policy file the daemon has already removed.
 */
export function ThreadActivationSlot({
  apiPost,
  apiPut,
  selectedThread,
  selectedWorkspace,
  onOpenLink
}: {
  apiPost: ApiWrite;
  apiPut: ApiWrite;
  selectedThread?: Thread;
  selectedWorkspace?: Workspace;
  onOpenLink: MarkdownLinkHandler;
}) {
  if (!selectedThread || !selectedWorkspace) return null;
  if (isClosedThread(selectedThread)) return null;

  return (
    <ThreadActivationMenu
      apiPost={apiPost}
      apiPut={apiPut}
      workspace={selectedWorkspace}
      thread={selectedThread}
      onOpenLink={onOpenLink}
    />
  );
}

/** The workspace row: the pause control beside the settings button. It shows only in the workspace view. */
function WorkspaceActionsRow({
  api,
  apiPost,
  lastSyncedAt,
  selectedAgent,
  selectedThread,
  selectedWorkspace,
  showWorkspaceSettings,
  onShowWorkspaceSettingsChange
}: {
  api: ApiGet;
  apiPost: ApiWrite;
  lastSyncedAt?: Date;
  selectedAgent?: Agent;
  selectedThread?: Thread;
  selectedWorkspace?: Workspace;
  showWorkspaceSettings: boolean;
  onShowWorkspaceSettingsChange: (show: boolean) => void;
}) {
  if (!selectedWorkspace || selectedThread || selectedAgent) return null;

  return (
    <div className="action-row content-action-row">
      <WorkspacePauseControl
        api={api}
        apiPost={apiPost}
        workspace={selectedWorkspace}
        syncMark={lastSyncedAt}
      />
      <WorkspaceSettingsMenu
        selectedAgent={selectedAgent}
        selectedThread={selectedThread}
        selectedWorkspace={selectedWorkspace}
        showWorkspaceSettings={showWorkspaceSettings}
        onShowWorkspaceSettingsChange={onShowWorkspaceSettingsChange}
      />
    </div>
  );
}

/**
 * The sessions trigger. It is hidden without a thread, and in a closed thread, which ends its
 * session links with it, as the activation trigger does.
 */
export function ThreadSessionsSlot({
  api,
  lastSyncedAt,
  selectedThread,
  selectedWorkspace,
  onOpenLink
}: {
  api: ApiGet;
  lastSyncedAt?: Date;
  selectedThread?: Thread;
  selectedWorkspace?: Workspace;
  onOpenLink: MarkdownLinkHandler;
}) {
  if (!selectedThread || !selectedWorkspace) return null;
  if (isClosedThread(selectedThread)) return null;

  return (
    <ThreadSessionsMenu
      api={api}
      workspace={selectedWorkspace}
      thread={selectedThread}
      syncMark={lastSyncedAt}
      onOpenLink={onOpenLink}
    />
  );
}

function ThreadArtifactMenu({
  selectedThread,
  selectedThreadArtifacts,
  showArtifactMenu,
  onOpenLink,
  onShowArtifactMenuChange
}: {
  selectedThread?: Thread;
  selectedThreadArtifacts: ArtifactMenuItem[];
  showArtifactMenu: boolean;
  onOpenLink: MarkdownLinkHandler;
  onShowArtifactMenuChange: (show: boolean) => void;
}) {
  const { t } = useTranslation();
  if (!selectedThread || !selectedThreadArtifacts.length) return null;

  return (
    <HeaderMenu
      icon={Paperclip}
      label={t("Show thread artifacts")}
      title={t("Artifacts")}
      open={showArtifactMenu}
      onOpenChange={onShowArtifactMenuChange}
    >
      <div className="artifact-menu-list">
        {selectedThreadArtifacts.map(({ message, artifact, href }) => (
          <DropdownMenuItem
            className="artifact-menu-item"
            key={`${message.id}:${artifact}`}
            onSelect={() => void onOpenLink(href)}
          >
            <span>{artifact.replace(/^artifacts\//, "")}</span>
            <small>#{message.id}</small>
          </DropdownMenuItem>
        ))}
      </div>
    </HeaderMenu>
  );
}

function WorkspaceSettingsMenu({
  selectedAgent,
  selectedThread,
  selectedWorkspace,
  showWorkspaceSettings,
  onShowWorkspaceSettingsChange
}: {
  selectedAgent?: Agent;
  selectedThread?: Thread;
  selectedWorkspace?: Workspace;
  showWorkspaceSettings: boolean;
  onShowWorkspaceSettingsChange: (show: boolean) => void;
}) {
  const { t } = useTranslation();
  if (!selectedWorkspace || selectedThread || selectedAgent) return null;

  return (
    <div className="header-action">
      <Button
        variant={showWorkspaceSettings ? "primary" : "secondary"}
        className="button-icon"
        title={t("Workspace settings")}
        onClick={() => onShowWorkspaceSettingsChange(true)}
      >
        <Settings size={14} />
      </Button>
    </div>
  );
}
