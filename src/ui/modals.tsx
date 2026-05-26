import { type AnimationEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownPanel } from "./markdown-panel.js";
import type {
  ArtifactDraft,
  ArtifactView,
  MarkdownLinkHandler
} from "./types.js";

function closeWhenHidden(onClose: () => void) {
  return (open: boolean) => {
    if (open) return;
    onClose();
  };
}

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
    <Dialog open onOpenChange={closeWhenHidden(onClose)}>
      <DialogContent
        className="modal-panel modal-panel-global"
        showCloseButton={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="modal-head modal-head-shortcuts">
          <DialogTitle className="modal-title-icon">
            <Keyboard className="modal-title-icon-glyph" size={18} />
            {t("Keyboard shortcuts")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("Available keyboard shortcuts.")}
          </DialogDescription>
          <DialogClose asChild>
            <Button
              className="button-icon"
              title={t("Close")}
              aria-label={t("Close")}
            >
              <X size={15} />
            </Button>
          </DialogClose>
        </DialogHeader>
        <dl className="shortcut-list">
          {shortcuts.map(([key, description]) => (
            <div className="shortcut-row" key={key}>
              <dt>{key}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
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
        <SheetHeader className="modal-head">
          <div className="eyebrow">
            <Paperclip size={14} />
            {t("Markdown artifact")}
          </div>
          <SheetTitle>{t("Attach artifact")}</SheetTitle>
          <SheetDescription>{draft.message.id}</SheetDescription>
        </SheetHeader>
        <SheetClose asChild>
          <Button
            className="button-icon modal-sheet-close"
            title={t("Close")}
            aria-label={t("Close")}
          >
            <X size={15} />
          </Button>
        </SheetClose>

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
        <SheetHeader className="modal-head">
          <div className="eyebrow">
            <Paperclip size={14} />
            {t("Markdown artifact")}
          </div>
          <SheetTitle>
            {artifact.artifact.replace(/^artifacts\//, "")}
          </SheetTitle>
          <SheetDescription>
            {artifact.threadId} / #{artifact.messageId}
          </SheetDescription>
        </SheetHeader>
        <SheetClose asChild>
          <Button
            className="button-icon modal-sheet-close"
            title={t("Close")}
            aria-label={t("Close")}
          >
            <X size={15} />
          </Button>
        </SheetClose>
        <div className="artifact-viewer-body">
          <MarkdownPanel markdown={artifact.content} onLink={onLink} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
