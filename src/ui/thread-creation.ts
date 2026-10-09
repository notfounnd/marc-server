import type { Thread, ThreadPayload } from "./types.js";

type ApiGet = <T>(path: string) => Promise<T>;
type ApiPost = <T>(path: string, body: unknown) => Promise<T>;

export type ThreadCreationResult =
  | { status: "created"; thread: Thread }
  | { status: "read-error"; thread: Thread; error: string }
  | { status: "create-error"; error: string }
  | { status: "stale"; thread?: Thread }
  | { status: "invalid" };

export function reconcileCreatedThreads(
  workspaceId: string,
  listedThreads: Thread[],
  pendingCreatedThreadsByWorkspace: Map<string, Map<string, Thread>>,
  recognizedThreadIds: Iterable<string> = listedThreads.map(
    (thread) => thread.id
  )
): Thread[] {
  const pendingThreads = pendingCreatedThreadsByWorkspace.get(workspaceId);
  if (!pendingThreads?.size) return listedThreads;

  const recognizedIds = new Set(recognizedThreadIds);
  for (const threadId of recognizedIds) {
    pendingThreads.delete(threadId);
  }
  if (!pendingThreads.size) {
    pendingCreatedThreadsByWorkspace.delete(workspaceId);
  }

  return [...pendingThreads.values(), ...listedThreads];
}

export function createThreadWorkflow({
  apiGet,
  apiPost,
  clearThreadPayload,
  currentWorkspaceId,
  onThreadCreated,
  selectThread,
  setThreadPayload,
  workspaceId
}: {
  apiGet: ApiGet;
  apiPost: ApiPost;
  clearThreadPayload: () => void;
  currentWorkspaceId: () => string | undefined;
  onThreadCreated: (thread: Thread) => void;
  selectThread: (thread: Thread) => void;
  setThreadPayload: (payload: ThreadPayload) => void;
  workspaceId: string;
}) {
  let pendingCreation: Promise<ThreadCreationResult> | undefined;
  let createdThread: Thread | undefined;

  async function readCreatedThread(): Promise<ThreadCreationResult> {
    const thread = createdThread;
    if (!thread) return { status: "invalid" };
    if (currentWorkspaceId() !== workspaceId) {
      return { status: "stale", thread };
    }

    clearThreadPayload();
    selectThread(thread);
    try {
      const payload = await apiGet<ThreadPayload>(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/threads/${encodeURIComponent(thread.id)}`
      );
      if (currentWorkspaceId() !== workspaceId) {
        return { status: "stale", thread };
      }
      setThreadPayload(payload);
      return { status: "created", thread };
    } catch (error) {
      return {
        status: "read-error",
        thread,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  function submit(title: string): Promise<ThreadCreationResult> {
    if (pendingCreation) return pendingCreation;
    if (createdThread) return readCreatedThread();

    const normalizedTitle = title.trim();
    if (!normalizedTitle || /[\r\n]/.test(normalizedTitle)) {
      return Promise.resolve({ status: "invalid" });
    }

    const createAndRead = async (): Promise<ThreadCreationResult> => {
      try {
        const thread = await apiPost<Thread>(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/threads`,
          { title: normalizedTitle }
        );
        if (currentWorkspaceId() !== workspaceId) {
          return { status: "stale", thread };
        }
        createdThread = thread;
        onThreadCreated(thread);
        return await readCreatedThread();
      } catch (error) {
        return {
          status: "create-error",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    };

    pendingCreation = createAndRead();
    return pendingCreation.finally(() => {
      pendingCreation = undefined;
    });
  }

  function retryRead(): Promise<ThreadCreationResult> {
    return readCreatedThread();
  }

  return { retryRead, submit };
}
