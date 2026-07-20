import { type AnimationEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Database, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { WorkspaceSettingsPanel } from "./workspace-settings-panel.js";
import type { MemoryIndexHealth, Workspace } from "./types.js";

export function WorkspaceSettingsModal({
  health,
  workspace,
  onAutoRebuildChange,
  onEmbeddingBatchSizeChange,
  onClose,
  onPrepareModel,
  onRebuild
}: {
  health?: MemoryIndexHealth;
  workspace: Workspace;
  onAutoRebuildChange: (autoRebuild: boolean) => void;
  onEmbeddingBatchSizeChange: (embeddingBatchSize: number) => void;
  onClose: () => void;
  onPrepareModel: () => void;
  onRebuild: (mode: "incremental" | "full") => void;
}) {
  const { t } = useTranslation();
  const { open, setOpen, handleAnimationEnd } = useAnimatedSheetClose(onClose);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="modal-panel artifact-sheet workspace-settings-sheet"
        showCloseButton={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onAnimationEnd={handleAnimationEnd}
      >
        <SheetHeader className="modal-head">
          <div className="eyebrow">
            <Database size={14} />
            {t("Workspace settings")}
          </div>
          <SheetTitle>{workspace.name}</SheetTitle>
          <SheetDescription>{workspace.rootPath}</SheetDescription>
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
        <div className="workspace-settings-body">
          <WorkspaceSettingsPanel
            health={health}
            t={t}
            onAutoRebuildChange={onAutoRebuildChange}
            onEmbeddingBatchSizeChange={onEmbeddingBatchSizeChange}
            onPrepareModel={onPrepareModel}
            onRebuild={onRebuild}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
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
