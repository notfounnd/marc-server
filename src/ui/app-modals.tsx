import {
  ArtifactModal,
  ArtifactViewerModal,
  KeyboardShortcutsModal
} from "./modals.js";
import { WorkspaceSettingsModal } from "./workspace-settings-modal.js";
import type {
  ArtifactDraft,
  ArtifactView,
  MarkdownLinkHandler,
  MemoryIndexHealth,
  Workspace
} from "./types.js";

export function AppModals({
  artifactDraft,
  artifactView,
  savingArtifact,
  selectedMemoryHealth,
  selectedWorkspace,
  showShortcuts,
  showWorkspaceSettings,
  onArtifactDraftChange,
  onArtifactSave,
  onArtifactViewClose,
  onLink,
  onPrepareMemoryModel,
  onRebuildMemory,
  onShowWorkspaceSettingsChange,
  onShortcutsClose,
  onWorkspaceAutoRebuildChange
}: {
  artifactDraft?: ArtifactDraft;
  artifactView?: ArtifactView;
  savingArtifact: boolean;
  selectedMemoryHealth?: MemoryIndexHealth;
  selectedWorkspace?: Workspace;
  showShortcuts: boolean;
  showWorkspaceSettings: boolean;
  onArtifactDraftChange: (draft: ArtifactDraft | undefined) => void;
  onArtifactSave: () => void;
  onArtifactViewClose: () => void;
  onLink: MarkdownLinkHandler;
  onPrepareMemoryModel: () => void;
  onRebuildMemory: () => void;
  onShowWorkspaceSettingsChange: (show: boolean) => void;
  onShortcutsClose: () => void;
  onWorkspaceAutoRebuildChange: (autoRebuild: boolean) => void;
}) {
  return (
    <>
      {artifactDraft ? (
        <ArtifactModal
          draft={artifactDraft}
          saving={savingArtifact}
          onChange={onArtifactDraftChange}
          onClose={() => onArtifactDraftChange(undefined)}
          onSave={onArtifactSave}
        />
      ) : null}
      {artifactView ? (
        <ArtifactViewerModal
          artifact={artifactView}
          onClose={onArtifactViewClose}
          onLink={onLink}
        />
      ) : null}
      {showWorkspaceSettings && selectedWorkspace ? (
        <WorkspaceSettingsModal
          health={selectedMemoryHealth}
          workspace={selectedWorkspace}
          onAutoRebuildChange={onWorkspaceAutoRebuildChange}
          onClose={() => onShowWorkspaceSettingsChange(false)}
          onPrepareModel={onPrepareMemoryModel}
          onRebuildMemory={onRebuildMemory}
        />
      ) : null}
      {showShortcuts ? (
        <KeyboardShortcutsModal onClose={onShortcutsClose} />
      ) : null}
    </>
  );
}
