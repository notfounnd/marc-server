import { useMemo } from "react";
import { messageArtifactReference } from "../core/marc-references.js";
import { isClosedThread } from "./common.js";
import type {
  ArtifactMenuItem,
  MiddleMode,
  Thread,
  ThreadPayload
} from "./types.js";

export function useThreadNavigation({
  closedThreads,
  middleMode,
  selectedThreadId,
  threadPayload,
  threads
}: {
  closedThreads: Thread[];
  middleMode: MiddleMode;
  selectedThreadId?: string;
  threadPayload?: ThreadPayload;
  threads: Thread[];
}) {
  const archivedThreads = useMemo(() => {
    const byId = new Map<string, Thread>();
    for (const thread of [...closedThreads, ...threads].filter(
      isClosedThread
    )) {
      byId.set(thread.id, thread);
    }
    return Array.from(byId.values()).sort((a, b) =>
      (b.closedAt ?? "").localeCompare(a.closedAt ?? "")
    );
  }, [closedThreads, threads]);
  const closedThreadIds = useMemo(
    () => new Set(archivedThreads.map((thread) => thread.id)),
    [archivedThreads]
  );
  const openThreads = useMemo(
    () =>
      threads.filter(
        (thread) => !isClosedThread(thread) && !closedThreadIds.has(thread.id)
      ),
    [closedThreadIds, threads]
  );
  const allWorkspaceThreads = useMemo(() => {
    const byId = new Map<string, Thread>();
    for (const thread of [...openThreads, ...archivedThreads]) {
      byId.set(thread.id, thread);
    }
    return Array.from(byId.values());
  }, [archivedThreads, openThreads]);
  const visibleThreads =
    middleMode === "archive" ? archivedThreads : openThreads;
  const selectedThread = useMemo(
    () =>
      archivedThreads.find((thread) => thread.id === selectedThreadId) ??
      openThreads.find((thread) => thread.id === selectedThreadId),
    [archivedThreads, openThreads, selectedThreadId]
  );
  const selectedThreadArtifacts = useMemo<ArtifactMenuItem[]>(
    () =>
      (threadPayload?.messages ?? []).flatMap((message) =>
        message.artifacts.map((artifact) => ({
          message,
          artifact,
          href: messageArtifactReference(message.id, artifact)
        }))
      ),
    [threadPayload?.messages]
  );

  return {
    allWorkspaceThreads,
    archivedThreads,
    openThreads,
    selectedThread,
    selectedThreadArtifacts,
    visibleThreads
  };
}
