import {
  parseMarcReference,
  type MarcReference
} from "../core/marc-references.js";
import type {
  Agent,
  ArtifactView,
  StatusKind,
  Thread,
  ThreadPayload,
  Workspace
} from "./types.js";

type ApiGet = <T>(path: string) => Promise<T>;
type Translation = (key: string, options?: Record<string, string>) => string;
type Ref<T> = { current: T };

export function createAppReferenceActions({
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
}: {
  t: Translation;
  selectedWorkspace?: Workspace;
  selectedThreadIdRef: Ref<string | undefined>;
  openThreads: Thread[];
  archivedThreads: Thread[];
  agents: Agent[];
  toastTimerRef: Ref<number | undefined>;
  api: ApiGet;
  selectThread: (thread: Thread) => Promise<ThreadPayload | undefined>;
  setStatusKind: (kind: StatusKind) => void;
  setStatus: (status: string) => void;
  setSelectedThreadId: (threadId: string | undefined) => void;
  setSelectedAgentId: (agentId: string | undefined) => void;
  setThreadPayload: (payload: ThreadPayload | undefined) => void;
  setArtifactView: (view: ArtifactView | undefined) => void;
  setToast: (
    toast: { kind: Exclude<StatusKind, "idle">; message: string } | undefined
  ) => void;
}) {
  function selectAgent(agent: Agent) {
    setSelectedAgentId(agent.id);
    setSelectedThreadId(undefined);
    selectedThreadIdRef.current = undefined;
    setThreadPayload(undefined);
  }

  async function findAndSelectThread(
    threadId: string
  ): Promise<ThreadPayload | undefined> {
    const thread = [...openThreads, ...archivedThreads].find(
      (item) => item.id === threadId
    );
    if (!thread) {
      setStatusKind("error");
      setStatus(t("Thread not found: {{threadId}}", { threadId }));
      return undefined;
    }
    return selectThread(thread);
  }

  function scrollToMessage(messageId: string) {
    window.setTimeout(() => {
      document
        .getElementById(`message-${messageId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function showToast(
    message: string,
    kind: Exclude<StatusKind, "idle"> = "ok"
  ) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ kind, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(undefined);
      toastTimerRef.current = undefined;
    }, 2400);
  }

  async function copyReference(reference: string) {
    try {
      await navigator.clipboard.writeText(reference);
      showToast(`Copied ${reference}`);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : String(error),
        "error"
      );
    }
  }

  async function ensureThreadSelected(threadId?: string): Promise<boolean> {
    if (!threadId || threadId === selectedThreadIdRef.current) return true;
    const payload = await findAndSelectThread(threadId);
    return Boolean(payload);
  }

  async function openArtifactReference(
    reference: Extract<MarcReference, { type: "artifact" }>
  ) {
    if (!selectedWorkspace) return;
    const threadId = reference.threadId ?? selectedThreadIdRef.current;
    if (!threadId) {
      setStatusKind("error");
      setStatus(
        t("Select a thread before opening a local artifact reference.")
      );
      return;
    }
    if (!(await ensureThreadSelected(threadId))) return;

    const artifact = await api<{ artifact: string; content: string }>(
      `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(reference.messageId)}/artifacts/${encodeURIComponent(reference.artifactFile)}`
    );
    setArtifactView({
      threadId,
      messageId: reference.messageId,
      artifact: artifact.artifact,
      content: artifact.content
    });
  }

  function selectExistingAgent(agentId: string): boolean {
    const agent = agents.find((item) => item.id === agentId);
    if (!agent) return false;
    selectAgent(agent);
    return true;
  }

  function reportMissingAgent(agentId: string) {
    setStatusKind("error");
    setStatus(t("Agent not found: {{agentId}}", { agentId }));
  }

  function handleAgentReference(
    reference: Extract<MarcReference, { type: "agent" }>
  ) {
    if (selectExistingAgent(reference.agentId)) return;
    reportMissingAgent(reference.agentId);
  }

  async function handleThreadReference(
    reference: Extract<MarcReference, { type: "thread" }>
  ) {
    await findAndSelectThread(reference.threadId);
  }

  async function handleMessageReference(
    reference: Extract<MarcReference, { type: "message" }>
  ) {
    const threadSelected = await ensureThreadSelected(
      reference.threadId ?? selectedThreadIdRef.current
    );
    if (!threadSelected) return;
    scrollToMessage(reference.messageId);
  }

  const referenceHandlers = {
    agent: handleAgentReference,
    thread: handleThreadReference,
    message: handleMessageReference,
    artifact: openArtifactReference
  };

  async function handleMarcReference(reference: MarcReference) {
    const handler = referenceHandlers[reference.type] as (
      value: MarcReference
    ) => Promise<void> | void;
    await handler(reference);
  }

  function handleMarkdownLink(href: string) {
    const marcReference = parseMarcReference(href);
    if (marcReference) {
      void handleMarcReference(marcReference);
      return;
    }

    const normalized = href.replace(/^\.?\//, "");
    const agentMatch = /^agents\/([^/]+)\.md$/.exec(normalized);
    if (!agentMatch) return;

    const agent = agents.find((item) => item.id === agentMatch[1]);
    if (agent) selectAgent(agent);
  }

  function goHome() {
    setSelectedThreadId(undefined);
    selectedThreadIdRef.current = undefined;
    setSelectedAgentId(undefined);
    setThreadPayload(undefined);
  }

  return {
    selectAgent,
    copyReference,
    handleMarkdownLink,
    goHome
  };
}
