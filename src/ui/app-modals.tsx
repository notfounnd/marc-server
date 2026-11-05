import {
  ArtifactModal,
  ArtifactViewerModal,
  KeyboardShortcutsModal
} from "./modals.js";
import { WorkspaceSettingsModal } from "./workspace-settings-modal.js";
import type { WorkspaceCycles } from "./workspace-settings-cycles.js";
import type { WorkspaceTurnTimeout } from "./workspace-settings-turn-timeout.js";
import { ThreadCreateModal } from "./thread-create-modal.js";
import type { ThreadCreationController } from "./use-thread-creation.js";
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
  threadCreation,
  showShortcuts,
  showWorkspaceSettings,
  onArtifactDraftChange,
  onArtifactSave,
  onArtifactViewClose,
  onLink,
  onPrepareMemoryModel,
  onPurgeUnusedMemory,
  onRebuildMemory,
  onShowWorkspaceSettingsChange,
  onShortcutsClose,
  onWorkspaceAutoRebuildChange,
  onWorkspaceEmbeddingBatchSizeChange,
  workspaceSettings
}: {
  artifactDraft?: ArtifactDraft;
  artifactView?: ArtifactView;
  savingArtifact: boolean;
  selectedMemoryHealth?: MemoryIndexHealth;
  selectedWorkspace?: Workspace;
  threadCreation: ThreadCreationController;
  showShortcuts: boolean;
  showWorkspaceSettings: boolean;
  onArtifactDraftChange: (draft: ArtifactDraft | undefined) => void;
  onArtifactSave: () => void;
  onArtifactViewClose: () => void;
  onLink: MarkdownLinkHandler;
  onPrepareMemoryModel: () => void;
  onPurgeUnusedMemory: () => void;
  onRebuildMemory: (mode: "incremental" | "full") => void;
  onShowWorkspaceSettingsChange: (show: boolean) => void;
  onShortcutsClose: () => void;
  onWorkspaceAutoRebuildChange: (autoRebuild: boolean) => void;
  onWorkspaceEmbeddingBatchSizeChange: (embeddingBatchSize: number) => void;
  workspaceSettings: {
    cycles: WorkspaceCycles;
    turnTimeout: WorkspaceTurnTimeout;
  };
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
          cyclesPerStage={workspaceSettings.cycles.value}
          onCyclesPerStageChange={workspaceSettings.cycles.save}
          turnTimeoutMinutes={workspaceSettings.turnTimeout.value}
          onTurnTimeoutMinutesChange={workspaceSettings.turnTimeout.save}
          onAutoRebuildChange={onWorkspaceAutoRebuildChange}
          onEmbeddingBatchSizeChange={onWorkspaceEmbeddingBatchSizeChange}
          onClose={() => onShowWorkspaceSettingsChange(false)}
          onPrepareModel={onPrepareMemoryModel}
          onPurge={onPurgeUnusedMemory}
          onRebuild={onRebuildMemory}
        />
      ) : null}
      {showShortcuts ? (
        <KeyboardShortcutsModal onClose={onShortcutsClose} />
      ) : null}
      {threadCreation.workspace ? (
        <ThreadCreateModal
          pending={threadCreation.pending}
          workspace={threadCreation.workspace}
          onClose={threadCreation.close}
          onCreate={threadCreation.submit}
          onRetryRead={threadCreation.retryRead}
        />
      ) : null}
    </>
  );
}
