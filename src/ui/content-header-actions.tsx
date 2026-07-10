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
  ArtifactMenuItem,
  MarkdownLinkHandler,
  Thread,
  Workspace
} from "./types.js";

export function ContentHeaderActions({
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
      <ThreadArtifactMenu
        selectedThread={selectedThread}
        selectedThreadArtifacts={selectedThreadArtifacts}
        showArtifactMenu={showArtifactMenu}
        onOpenLink={onOpenLink}
        onShowArtifactMenuChange={onShowArtifactMenuChange}
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
