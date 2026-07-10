import { useEffect } from "react";
import type { MiddleMode } from "./types.js";

type Ref<T> = { current: T };

export function useWorkspaceSelectionEffects({
  selectedThreadId,
  selectedThreadIdRef,
  selectedWorkspaceId,
  selectedWorkspaceIdRef,
  setMiddleMode,
  setShowArtifactMenu,
  setShowWorkspaceSettings
}: {
  selectedThreadId?: string;
  selectedThreadIdRef: Ref<string | undefined>;
  selectedWorkspaceId?: string;
  selectedWorkspaceIdRef: Ref<string | undefined>;
  setMiddleMode: (mode: MiddleMode) => void;
  setShowArtifactMenu: (show: boolean) => void;
  setShowWorkspaceSettings: (show: boolean) => void;
}) {
  useEffect(() => {
    selectedWorkspaceIdRef.current = selectedWorkspaceId;
    setMiddleMode("threads");
    setShowWorkspaceSettings(false);
  }, [selectedWorkspaceId]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
    setShowArtifactMenu(false);
    setShowWorkspaceSettings(false);
  }, [selectedThreadId]);
}

export function useModalBodyLock(modalOpen: boolean) {
  useEffect(() => {
    document.body.classList.toggle("modal-open", modalOpen);
    return () => document.body.classList.remove("modal-open");
  }, [modalOpen]);
}
