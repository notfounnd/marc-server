import { useTranslation } from "react-i18next";
import { Paperclip, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "./common.js";
import type {
  Agent,
  ApiGet,
  ArtifactMenuItem,
  MarkdownLinkHandler,
  Thread,
  Workspace
} from "./types.js";
import {
  PRESSED_TRIGGER_CLASS,
  ThreadSessionsMenu
} from "./thread-sessions-menu.js";

export function ContentHeaderActions({
  api,
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
      <div className="content-action-row">
        <ThreadArtifactMenu
          selectedThread={selectedThread}
          selectedThreadArtifacts={selectedThreadArtifacts}
          showArtifactMenu={showArtifactMenu}
          onOpenLink={onOpenLink}
          onShowArtifactMenuChange={onShowArtifactMenuChange}
        />
        <ThreadSessionsSlot
          api={api}
          lastSyncedAt={lastSyncedAt}
          selectedThread={selectedThread}
          selectedWorkspace={selectedWorkspace}
          onOpenLink={onOpenLink}
        />
      </div>
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

function ThreadSessionsSlot({
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
    <div className="header-artifacts">
      <DropdownMenu
        open={showArtifactMenu}
        onOpenChange={onShowArtifactMenuChange}
        modal={false}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant={showArtifactMenu ? "primary" : "secondary"}
            className={`button-icon ${PRESSED_TRIGGER_CLASS}`}
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
    <div className="header-artifacts">
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
