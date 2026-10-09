import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  createThreadWorkflow,
  type ThreadCreationResult
} from "./thread-creation.js";
import type { Thread, ThreadPayload, Workspace } from "./types.js";

type ApiGet = <T>(path: string) => Promise<T>;
type ApiPost = <T>(path: string, body: unknown) => Promise<T>;
type Ref<T> = { current: T };

export function useThreadCreation({
  api,
  apiPost,
  autocompleteThreadPayloadRef,
  pendingCreatedThreadsByWorkspaceRef,
  selectedThreadIdRef,
  selectedWorkspaceIdRef,
  setSelectedAgentId,
  setSelectedThreadId,
  setThreadPayload,
  setThreads
}: {
  api: ApiGet;
  apiPost: ApiPost;
  autocompleteThreadPayloadRef: Ref<Map<string, ThreadPayload>>;
  pendingCreatedThreadsByWorkspaceRef: Ref<Map<string, Map<string, Thread>>>;
  selectedThreadIdRef: Ref<string | undefined>;
  selectedWorkspaceIdRef: Ref<string | undefined>;
  setSelectedAgentId: (agentId: string | undefined) => void;
  setSelectedThreadId: (threadId: string | undefined) => void;
  setThreadPayload: (payload: ThreadPayload | undefined) => void;
  setThreads: Dispatch<SetStateAction<Thread[]>>;
}) {
  const [workspace, setWorkspace] = useState<Workspace>();
  const [pending, setPending] = useState(false);
  const workflowRef = useRef<
    ReturnType<typeof createThreadWorkflow> | undefined
  >(undefined);

  function open(targetWorkspace: Workspace) {
    let createdThreadId: string | undefined;
    workflowRef.current = createThreadWorkflow({
      apiGet: api,
      apiPost,
      clearThreadPayload: () => setThreadPayload(undefined),
      currentWorkspaceId: () => selectedWorkspaceIdRef.current,
      onThreadCreated: (thread) => {
        const pendingThreads =
          pendingCreatedThreadsByWorkspaceRef.current.get(targetWorkspace.id) ??
          new Map<string, Thread>();
        pendingThreads.set(thread.id, thread);
        pendingCreatedThreadsByWorkspaceRef.current.set(
          targetWorkspace.id,
          pendingThreads
        );
        setThreads((current) => {
          if (current.some((existing) => existing.id === thread.id)) {
            return current;
          }
          return [thread, ...current];
        });
      },
      selectThread: (thread) => {
        createdThreadId = thread.id;
        setSelectedThreadId(thread.id);
        selectedThreadIdRef.current = thread.id;
        setSelectedAgentId(undefined);
      },
      setThreadPayload: (payload) => {
        if (createdThreadId) {
          autocompleteThreadPayloadRef.current.set(createdThreadId, payload);
        }
        setThreadPayload(payload);
      },
      workspaceId: targetWorkspace.id
    });
    setWorkspace(targetWorkspace);
  }

  function close() {
    workflowRef.current = undefined;
    setWorkspace(undefined);
  }

  async function submit(title: string): Promise<ThreadCreationResult> {
    const workflow = workflowRef.current;
    if (!workflow) return { status: "invalid" };

    setPending(true);
    try {
      return await workflow.submit(title);
    } finally {
      setPending(false);
    }
  }

  async function retryRead(): Promise<ThreadCreationResult> {
    const workflow = workflowRef.current;
    if (!workflow) return { status: "invalid" };

    setPending(true);
    try {
      return await workflow.retryRead();
    } finally {
      setPending(false);
    }
  }

  return { close, open, pending, retryRead, submit, workspace };
}

export type ThreadCreationController = ReturnType<typeof useThreadCreation>;
