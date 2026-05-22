import { createAppReferenceActions } from "./app-reference-actions.js";
import type {
  Agent,
  ArtifactDraft,
  ArtifactView,
  MiddleMode,
  Message,
  StatusKind,
  Thread,
  ThreadPayload,
  Workspace
} from "./types.js";

type ApiGet = <T>(path: string) => Promise<T>;
type ApiPost = <T>(path: string, body: unknown) => Promise<T>;
type Translation = (key: string, options?: Record<string, string>) => string;
type Ref<T> = { current: T };

export type AppActions = ReturnType<typeof createAppActions>;

export function createAppActions({
  t,
  token,
  selectedWorkspace,
  selectedThread,
  selectedWorkspaceIdRef,
  selectedThreadIdRef,
  autocompleteThreadPayloadRef,
  openThreads,
  archivedThreads,
  allWorkspaceThreads,
  threadPayload,
  composerBody,
  uiAgentId,
  sending,
  artifactDraft,
  savingArtifact,
  agents,
  toastTimerRef,
  api,
  apiPost,
  refresh,
  setToken,
  setTokenLocked,
  setStatusKind,
  setStatus,
  setSelectedWorkspaceId,
  setSelectedThreadId,
  setSelectedAgentId,
  setMiddleMode,
  setThreadPayload,
  setUiAgentId,
  setSending,
  setComposerBody,
  setArtifactDraft,
  setArtifactView,
  setSavingArtifact,
  setLastSyncedAt,
  setToast
}: {
  t: Translation;
  token: string;
  selectedWorkspace?: Workspace;
  selectedThread?: Thread;
  selectedWorkspaceIdRef: Ref<string | undefined>;
  selectedThreadIdRef: Ref<string | undefined>;
  autocompleteThreadPayloadRef: Ref<Map<string, ThreadPayload>>;
  openThreads: Thread[];
  archivedThreads: Thread[];
  allWorkspaceThreads: Thread[];
  threadPayload?: ThreadPayload;
  composerBody: string;
  uiAgentId: string;
  sending: boolean;
  artifactDraft?: ArtifactDraft;
  savingArtifact: boolean;
  agents: Agent[];
  toastTimerRef: Ref<number | undefined>;
  api: ApiGet;
  apiPost: ApiPost;
  refresh: (options?: {
    force?: boolean;
    includeThread?: boolean;
  }) => Promise<void>;
  setToken: (token: string) => void;
  setTokenLocked: (locked: boolean) => void;
  setStatusKind: (kind: StatusKind) => void;
  setStatus: (status: string) => void;
  setSelectedWorkspaceId: (workspaceId: string | undefined) => void;
  setSelectedThreadId: (threadId: string | undefined) => void;
  setSelectedAgentId: (agentId: string | undefined) => void;
  setMiddleMode: (mode: MiddleMode) => void;
  setThreadPayload: (payload: ThreadPayload | undefined) => void;
  setUiAgentId: (agentId: string) => void;
  setSending: (sending: boolean) => void;
  setComposerBody: (body: string) => void;
  setArtifactDraft: (draft: ArtifactDraft | undefined) => void;
  setArtifactView: (view: ArtifactView | undefined) => void;
  setSavingArtifact: (saving: boolean) => void;
  setLastSyncedAt: (date: Date) => void;
  setToast: (
    toast: { kind: Exclude<StatusKind, "idle">; message: string } | undefined
  ) => void;
}) {
  function lockToken() {
    const normalized = token.trim();
    if (!normalized) {
      setStatusKind("error");
      setStatus(t("Paste the daemon token first."));
      return;
    }

    localStorage.setItem("marcToken", normalized);
    localStorage.setItem("marcTokenLocked", "true");
    setToken(normalized);
    setTokenLocked(true);
    setStatusKind("warn");
    setStatus(t("Checking daemon"));
  }

  function unlockToken() {
    localStorage.setItem("marcTokenLocked", "false");
    setTokenLocked(false);
    setStatusKind("warn");
    setStatus(t("Token unlocked"));
  }

  async function selectWorkspace(workspace: Workspace) {
    selectedWorkspaceIdRef.current = workspace.id;
    selectedThreadIdRef.current = undefined;
    autocompleteThreadPayloadRef.current.clear();
    setSelectedWorkspaceId(workspace.id);
    setSelectedThreadId(undefined);
    setSelectedAgentId(undefined);
    setMiddleMode("threads");
    setThreadPayload(undefined);
    await refresh({ force: true, includeThread: false });
  }

  async function selectThread(
    thread: Thread
  ): Promise<ThreadPayload | undefined> {
    if (!selectedWorkspace) return undefined;

    setSelectedThreadId(thread.id);
    selectedThreadIdRef.current = thread.id;
    setSelectedAgentId(undefined);
    const payload = await api<ThreadPayload>(
      `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(thread.id)}`
    );
    autocompleteThreadPayloadRef.current.set(thread.id, payload);
    setThreadPayload(payload);
    return payload;
  }

  async function loadAutocompleteThreadMessages(
    threadId: string
  ): Promise<Message[]> {
    if (!selectedWorkspace) return [];
    if (threadId === selectedThread?.id) return threadPayload?.messages ?? [];
    if (!allWorkspaceThreads.some((thread) => thread.id === threadId))
      return [];

    const cachedPayload = autocompleteThreadPayloadRef.current.get(threadId);
    if (cachedPayload) return cachedPayload.messages ?? [];

    try {
      const payload = await api<ThreadPayload>(
        `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(threadId)}`
      );
      autocompleteThreadPayloadRef.current.set(threadId, payload);
      return payload.messages ?? [];
    } catch (error) {
      setStatusKind("error");
      setStatus(error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  async function sendUiMessage() {
    if (
      !selectedWorkspace ||
      !selectedThread ||
      !composerBody.trim() ||
      sending
    )
      return;

    const agentId = uiAgentId.trim() || "ui-user";
    localStorage.setItem("marcUiAgentId", agentId);
    setUiAgentId(agentId);
    setSending(true);

    try {
      await apiPost<Message>(
        `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(selectedThread.id)}`,
        {
          agentId,
          displayName: agentId,
          role: "user",
          message: composerBody.trim()
        }
      );
      setComposerBody("");
      setThreadPayload(
        await api<ThreadPayload>(
          `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(selectedThread.id)}`
        )
      );
      setStatusKind("ok");
      setStatus(t("Message posted"));
      setLastSyncedAt(new Date());
    } catch (error) {
      setStatusKind("error");
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSending(false);
    }
  }

  async function saveArtifact() {
    if (
      !selectedWorkspace ||
      !selectedThread ||
      !artifactDraft ||
      savingArtifact
    )
      return;
    if (!artifactDraft.fileName.trim() || !artifactDraft.content.trim()) {
      setStatusKind("error");
      setStatus(t("Artifact name and content are required"));
      return;
    }

    setSavingArtifact(true);
    try {
      const response = await apiPost<{ artifact: string }>(
        `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(selectedThread.id)}/messages/${encodeURIComponent(artifactDraft.message.id)}/artifacts`,
        {
          fileName: artifactDraft.fileName.trim(),
          content: artifactDraft.content
        }
      );
      setArtifactDraft(undefined);
      setThreadPayload(
        await api<ThreadPayload>(
          `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(selectedThread.id)}`
        )
      );
      setStatusKind("ok");
      setStatus(
        t("Artifact attached: {{artifact}}", { artifact: response.artifact })
      );
      setLastSyncedAt(new Date());
    } catch (error) {
      setStatusKind("error");
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingArtifact(false);
    }
  }

  const referenceActions = createAppReferenceActions({
    t,
    selectedWorkspace,
    selectedThreadIdRef,
    openThreads,
    archivedThreads,
    agents,
    toastTimerRef,
    api,
    selectThread,
    setStatusKind,
    setStatus,
    setSelectedThreadId,
    setSelectedAgentId,
    setThreadPayload,
    setArtifactView,
    setToast
  });

  return {
    lockToken,
    unlockToken,
    selectWorkspace,
    selectThread,
    loadAutocompleteThreadMessages,
    sendUiMessage,
    saveArtifact,
    selectAgent: referenceActions.selectAgent,
    copyReference: referenceActions.copyReference,
    handleMarkdownLink: referenceActions.handleMarkdownLink,
    goHome: referenceActions.goHome
  };
}
