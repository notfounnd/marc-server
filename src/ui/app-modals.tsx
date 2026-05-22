import {
  ArtifactModal,
  ArtifactViewerModal,
  KeyboardShortcutsModal
} from "./modals.js";
import type {
  ArtifactDraft,
  ArtifactView,
  MarkdownLinkHandler
} from "./types.js";

export function AppModals({
  artifactDraft,
  artifactView,
  savingArtifact,
  showShortcuts,
  onArtifactDraftChange,
  onArtifactSave,
  onArtifactViewClose,
  onLink,
  onShortcutsClose
}: {
  artifactDraft?: ArtifactDraft;
  artifactView?: ArtifactView;
  savingArtifact: boolean;
  showShortcuts: boolean;
  onArtifactDraftChange: (draft: ArtifactDraft | undefined) => void;
  onArtifactSave: () => void;
  onArtifactViewClose: () => void;
  onLink: MarkdownLinkHandler;
  onShortcutsClose: () => void;
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
      {showShortcuts ? (
        <KeyboardShortcutsModal onClose={onShortcutsClose} />
      ) : null}
    </>
  );
}
