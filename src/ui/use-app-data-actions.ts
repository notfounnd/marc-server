import { useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useAppSync } from "./app-sync.js";
import { useThreadCreation } from "./use-thread-creation.js";
import type { Thread, ThreadPayload, Workspace } from "./types.js";

type AppSyncOptions = Parameters<typeof useAppSync>[0];
type Ref<T> = { current: T };

type AppDataActionOptions = Omit<
  AppSyncOptions,
  "pendingCreatedThreadsByWorkspaceRef" | "setThreads"
> & {
  autocompleteThreadPayloadRef: Ref<Map<string, ThreadPayload>>;
  setThreads: Dispatch<SetStateAction<Thread[]>>;
};

export function useAppDataActions(options: AppDataActionOptions) {
  const { autocompleteThreadPayloadRef, ...syncOptions } = options;
  const pendingCreatedThreadsByWorkspaceRef = useRef(
    new Map<string, Map<string, Thread>>()
  );
  const sync = useAppSync({
    ...syncOptions,
    pendingCreatedThreadsByWorkspaceRef
  });
  const threadCreation = useThreadCreation({
    api: sync.api,
    apiPost: sync.apiPost,
    autocompleteThreadPayloadRef,
    pendingCreatedThreadsByWorkspaceRef,
    selectedThreadIdRef: syncOptions.selectedThreadIdRef,
    selectedWorkspaceIdRef: syncOptions.selectedWorkspaceIdRef,
    setSelectedAgentId: syncOptions.setSelectedAgentId,
    setSelectedThreadId: syncOptions.setSelectedThreadId,
    setThreadPayload: syncOptions.setThreadPayload,
    setThreads: syncOptions.setThreads
  });

  function openThreadCreation(workspace?: Workspace) {
    if (
      !workspace ||
      workspace.id !== syncOptions.selectedWorkspaceIdRef.current
    ) {
      return;
    }
    if (!syncOptions.tokenLocked || !syncOptions.token.trim()) return;
    threadCreation.open(workspace);
  }

  return { ...sync, openThreadCreation, threadCreation };
}
