import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Paperclip, X } from "lucide-react";
import { Button } from "./common.js";
import { MarkdownPanel } from "./markdown-panel.js";
import type {
  ArtifactDraft,
  ArtifactView,
  MarkdownLinkHandler
} from "./types.js";

export function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const shortcuts = [
    [
      "Ctrl+Space",
      t("Open autocomplete for the current @, #, $, or marc:// reference.")
    ],
    ["ArrowUp / ArrowDown", t("Move through autocomplete suggestions.")],
    ["Enter / Tab", t("Insert the active suggestion.")],
    ["Escape", t("Close autocomplete or this dialog.")]
  ];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-layer modal-layer-global" role="presentation">
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
      >
        <header className="modal-head">
          <div>
            <h2 id="keyboard-shortcuts-title" className="modal-title-icon">
              <Keyboard size={18} />
              {t("Keyboard shortcuts")}
            </h2>
          </div>
          <Button
            variant="ghost"
            className="button-icon"
            onClick={onClose}
            title={t("Close")}
          >
            <X size={18} />
          </Button>
        </header>
        <dl className="shortcut-list">
          {shortcuts.map(([key, description]) => (
            <div className="shortcut-row" key={key}>
              <dt>{key}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export function ArtifactModal({
  draft,
  saving,
  onChange,
  onClose,
  onSave
}: {
  draft: ArtifactDraft;
  saving: boolean;
  onChange: (draft: ArtifactDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="modal-layer" role="presentation">
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="artifact-modal-title"
      >
        <header className="modal-head">
          <div>
            <div className="eyebrow">
              <Paperclip size={14} />
              {t("Markdown artifact")}
            </div>
            <h2 id="artifact-modal-title">{t("Attach artifact")}</h2>
            <p>{draft.message.id}</p>
          </div>
          <Button
            variant="ghost"
            className="button-icon"
            onClick={onClose}
            title={t("Close")}
          >
            <X size={16} />
          </Button>
        </header>

        <label className="modal-field">
          {t("File name")}
          <input
            value={draft.fileName}
            onChange={(event) =>
              onChange({ ...draft, fileName: event.target.value })
            }
            placeholder={t("decision-notes")}
          />
        </label>

        <label className="modal-field modal-field-grow">
          {t("Markdown")}
          <textarea
            value={draft.content}
            onChange={(event) =>
              onChange({ ...draft, content: event.target.value })
            }
            placeholder={t("# Notes")}
            rows={16}
          />
        </label>

        <footer className="modal-actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("Cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={onSave}
            disabled={saving || !draft.fileName.trim() || !draft.content.trim()}
          >
            <Paperclip size={15} />
            {saving ? t("Saving") : t("Attach")}
          </Button>
        </footer>
      </section>
    </div>
  );
}

export function ArtifactViewerModal({
  artifact,
  onClose,
  onLink
}: {
  artifact: ArtifactView;
  onClose: () => void;
  onLink: MarkdownLinkHandler;
}) {
  const { t } = useTranslation();

  return (
    <div className="modal-layer" role="presentation">
      <section
        className="modal-panel artifact-viewer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="artifact-viewer-title"
      >
        <header className="modal-head">
          <div>
            <div className="eyebrow">
              <Paperclip size={14} />
              {t("Markdown artifact")}
            </div>
            <h2 id="artifact-viewer-title">
              {artifact.artifact.replace(/^artifacts\//, "")}
            </h2>
            <p>
              {artifact.threadId} / #{artifact.messageId}
            </p>
          </div>
          <Button
            variant="ghost"
            className="button-icon"
            onClick={onClose}
            title={t("Close")}
          >
            <X size={16} />
          </Button>
        </header>
        <div className="artifact-viewer-body">
          <MarkdownPanel markdown={artifact.content} onLink={onLink} />
        </div>
      </section>
    </div>
  );
}
