import { type AnimationEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownPanel } from "./markdown-panel.js";
import { ModalSheetHeader } from "./modal-sheet-header.js";
import type {
  ArtifactDraft,
  ArtifactView,
  MarkdownLinkHandler
} from "./types.js";

function useAnimatedSheetClose(onClose: () => void) {
  const [open, setOpen] = useState(true);

  function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (open) return;
    if (event.currentTarget !== event.target) return;
    onClose();
  }

  return { open, setOpen, handleAnimationEnd };
}

export function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { open, setOpen, handleAnimationEnd } = useAnimatedSheetClose(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const shortcuts = [
    [
      "Ctrl+Space",
      t("Open autocomplete for the current @, #, $, or marc:// reference.")
    ],
    ["ArrowUp / ArrowDown", t("Move through autocomplete suggestions.")],
    ["Enter / Tab", t("Insert the active suggestion.")],
    ["Escape", t("Close autocomplete or this dialog.")]
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="modal-panel artifact-sheet"
        showCloseButton={false}
        onOpenAutoFocus={() => {
          const activeElement = document.activeElement;
          if (!(activeElement instanceof HTMLElement)) return;
          if (activeElement === document.body) return;
          returnFocusRef.current = activeElement;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
        onAnimationEnd={handleAnimationEnd}
      >
        <ModalSheetHeader
          className="modal-head-shortcuts"
          titleClassName="modal-title-icon"
          descriptionClassName="sr-only"
          title={
            <>
              <Keyboard className="modal-title-icon-glyph" size={18} />
              {t("Keyboard shortcuts")}
            </>
          }
          description={t("Available keyboard shortcuts.")}
        />
        <dl className="shortcut-list">
          {shortcuts.map(([key, description]) => (
            <div className="shortcut-row" key={key}>
              <dt>{key}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </SheetContent>
    </Sheet>
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
  const { open, setOpen, handleAnimationEnd } = useAnimatedSheetClose(onClose);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="modal-panel artifact-sheet"
        showCloseButton={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onAnimationEnd={handleAnimationEnd}
      >
        <ModalSheetHeader
          eyebrow={
            <>
              <Paperclip size={14} />
              {t("Markdown artifact")}
            </>
          }
          title={t("Attach artifact")}
          description={draft.message.id}
        />

        <Label className="modal-field">
          {t("File name")}
          <Input
            value={draft.fileName}
            onChange={(event) =>
              onChange({ ...draft, fileName: event.target.value })
            }
            placeholder={t("decision-notes")}
          />
        </Label>

        <Label className="modal-field modal-field-grow">
          {t("Markdown")}
          <Textarea
            value={draft.content}
            onChange={(event) =>
              onChange({ ...draft, content: event.target.value })
            }
            placeholder={t("# Notes")}
            rows={16}
          />
        </Label>

        <SheetFooter className="modal-actions">
          <SheetClose asChild>
            <Button variant="neutral" disabled={saving}>
              {t("Cancel")}
            </Button>
          </SheetClose>
          <Button
            onClick={onSave}
            disabled={saving || !draft.fileName.trim() || !draft.content.trim()}
          >
            <Paperclip size={15} />
            {saving ? t("Saving") : t("Attach")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
  const { open, setOpen, handleAnimationEnd } = useAnimatedSheetClose(onClose);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="modal-panel artifact-sheet artifact-viewer"
        showCloseButton={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onAnimationEnd={handleAnimationEnd}
      >
        <ModalSheetHeader
          eyebrow={
            <>
              <Paperclip size={14} />
              {t("Markdown artifact")}
            </>
          }
          title={artifact.artifact.replace(/^artifacts\//, "")}
          description={
            <>
              {artifact.threadId} / #{artifact.messageId}
            </>
          }
        />
        <div className="artifact-viewer-body">
          <MarkdownPanel markdown={artifact.content} onLink={onLink} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
