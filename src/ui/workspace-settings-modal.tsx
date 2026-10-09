import { type AnimationEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Database } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { WorkspaceSettingsPanel } from "./workspace-settings-panel.js";
import { ModalSheetHeader } from "./modal-sheet-header.js";
import type { MemoryIndexHealth, Workspace } from "./types.js";

export function WorkspaceSettingsModal({
  health,
  workspace,
  onAutoRebuildChange,
  onEmbeddingBatchSizeChange,
  onSearchRetryDepthChange,
  onClose,
  onPrepareModel,
  onPurge,
  onRebuild
}: {
  health?: MemoryIndexHealth;
  workspace: Workspace;
  onAutoRebuildChange: (autoRebuild: boolean) => void;
  onEmbeddingBatchSizeChange: (embeddingBatchSize: number) => void;
  onSearchRetryDepthChange: (searchRetryDepth: number) => void;
  onClose: () => void;
  onPrepareModel: () => void;
  onPurge: () => void;
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
        <ModalSheetHeader
          eyebrow={
            <>
              <Database size={14} />
              {t("Workspace settings")}
            </>
          }
          title={workspace.name}
          description={workspace.rootPath}
        />
        <div className="workspace-settings-body">
          <WorkspaceSettingsPanel
            health={health}
            t={t}
            onAutoRebuildChange={onAutoRebuildChange}
            onEmbeddingBatchSizeChange={onEmbeddingBatchSizeChange}
            onSearchRetryDepthChange={onSearchRetryDepthChange}
            onPrepareModel={onPrepareModel}
            onPurge={onPurge}
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
