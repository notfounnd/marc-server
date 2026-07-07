import { useCallback, useEffect } from "react";
import type {
  Agent,
  DaemonStatus,
  MemoryIndexHealth,
  MiddleMode,
  StatusKind,
  Thread,
  ThreadIndexHealth,
  ThreadPayload,
  Workspace
} from "./types.js";

type Translation = (key: string) => string;
type Ref<T> = { current: T };

function hasCurrentThread(
  threads: Thread[],
  threadId?: string
): threadId is string {
  if (!threadId) return false;
  return threads.some((thread) => thread.id === threadId);
}

export function useAppSync({
  t,
  token,
  tokenLocked,
  busyRef,
  lastRefreshAtRef,
  selectedWorkspaceIdRef,
  selectedThreadIdRef,
  liveRefreshTimerRef,
  setBusy,
  setThreadIndexHealthByWorkspace,
  setMemoryHealthByWorkspace,
  setWorkspaces,
  setSelectedWorkspaceId,
  setSelectedThreadId,
  setSelectedAgentId,
  setThreads,
  setClosedThreads,
  setMiddleMode,
  setAgents,
  setRules,
  setThreadPayload,
  setStatusKind,
  setStatus,
  setLastSyncedAt
}: {
  t: Translation;
  token: string;
  tokenLocked: boolean;
  busyRef: Ref<boolean>;
  lastRefreshAtRef: Ref<number>;
  selectedWorkspaceIdRef: Ref<string | undefined>;
  selectedThreadIdRef: Ref<string | undefined>;
  liveRefreshTimerRef: Ref<number | undefined>;
  setBusy: (busy: boolean) => void;
  setThreadIndexHealthByWorkspace: (
    health: Record<string, ThreadIndexHealth>
  ) => void;
  setMemoryHealthByWorkspace: (
    health: Record<string, MemoryIndexHealth>
  ) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setSelectedWorkspaceId: (workspaceId: string | undefined) => void;
  setSelectedThreadId: (threadId: string | undefined) => void;
  setSelectedAgentId: (agentId: string | undefined) => void;
  setThreads: (threads: Thread[]) => void;
  setClosedThreads: (threads: Thread[]) => void;
  setMiddleMode: (mode: MiddleMode) => void;
  setAgents: (agents: Agent[]) => void;
  setRules: (rules: string) => void;
  setThreadPayload: (payload: ThreadPayload | undefined) => void;
  setStatusKind: (kind: StatusKind) => void;
  setStatus: (status: string) => void;
  setLastSyncedAt: (date: Date) => void;
}) {
  const api = useCallback(
    async <T>(path: string): Promise<T> => {
      if (!tokenLocked || !token.trim()) {
        throw new Error(t("Lock the daemon token first."));
      }

      const response = await fetch(path, {
        headers: {
          authorization: `Bearer ${token.trim()}`
        }
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json() as Promise<T>;
    },
    [t, token, tokenLocked]
  );

  const apiPost = useCallback(
    async <T>(path: string, body: unknown): Promise<T> => {
      if (!tokenLocked || !token.trim()) {
        throw new Error(t("Lock the daemon token first."));
      }

      const response = await fetch(path, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token.trim()}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json() as Promise<T>;
    },
    [t, token, tokenLocked]
  );

  function markConnected() {
    setStatusKind("ok");
    setStatus(t("Connected"));
    setLastSyncedAt(new Date());
  }

  function resetWorkspaceState() {
    selectedWorkspaceIdRef.current = undefined;
    selectedThreadIdRef.current = undefined;
    setSelectedWorkspaceId(undefined);
    setSelectedThreadId(undefined);
    setSelectedAgentId(undefined);
    setThreads([]);
    setClosedThreads([]);
    setMiddleMode("threads");
    setAgents([]);
    setRules("");
    setThreadPayload(undefined);
    setThreadIndexHealthByWorkspace({});
    setMemoryHealthByWorkspace({});
  }

  const refresh = useCallback(
    async (options: { force?: boolean; includeThread?: boolean } = {}) => {
      if (busyRef.current || !tokenLocked) return;
      const now = Date.now();
      if (!options.force && now - lastRefreshAtRef.current < 30000) return;
      lastRefreshAtRef.current = now;
      busyRef.current = true;
      setBusy(true);

      try {
        const daemonStatus = await api<DaemonStatus>("/api/status");
        setThreadIndexHealthByWorkspace(
          daemonStatus.modules?.threadIndex?.workspaces ?? {}
        );
        setMemoryHealthByWorkspace(
          daemonStatus.modules?.memory?.workspaces ?? {}
        );
        const nextWorkspaces = await api<Workspace[]>("/api/workspaces");
        setWorkspaces(nextWorkspaces);

        const currentWorkspaceId = selectedWorkspaceIdRef.current;
        const workspaceId = currentWorkspaceId ?? nextWorkspaces[0]?.id;
        if (!currentWorkspaceId && workspaceId) {
          selectedWorkspaceIdRef.current = workspaceId;
          setSelectedWorkspaceId(workspaceId);
        }

        const workspace = nextWorkspaces.find(
          (item) => item.id === workspaceId
        );
        if (!workspace) {
          resetWorkspaceState();
          markConnected();
          return;
        }

        const encodedWorkspace = encodeURIComponent(workspace.id);
        const [nextThreads, nextClosedThreads, nextAgents, nextRules] =
          await Promise.all([
            api<Thread[]>(`/api/workspaces/${encodedWorkspace}/threads`),
            api<Thread[]>(
              `/api/workspaces/${encodedWorkspace}/threads?status=closed`
            ),
            api<Agent[]>(`/api/workspaces/${encodedWorkspace}/agents`),
            api<{ markdown: string }>(
              `/api/workspaces/${encodedWorkspace}/rules`
            )
          ]);

        setThreads(nextThreads);
        setClosedThreads(nextClosedThreads);
        setAgents(nextAgents);
        setRules(nextRules.markdown);

        const currentThreadId = selectedThreadIdRef.current;
        if (
          options.includeThread &&
          hasCurrentThread(
            [...nextThreads, ...nextClosedThreads],
            currentThreadId
          )
        ) {
          setThreadPayload(
            await api<ThreadPayload>(
              `/api/workspaces/${encodedWorkspace}/threads/${encodeURIComponent(currentThreadId)}`
            )
          );
        }
        markConnected();
      } catch (error) {
        setStatusKind("error");
        setStatus(error instanceof Error ? error.message : String(error));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [api, tokenLocked]
  );

  useEffect(() => {
    if (!tokenLocked) return;
    void refresh({ force: true, includeThread: true });
    const onFocus = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRefreshAtRef.current > 30000
      ) {
        void refresh({ includeThread: true });
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh, tokenLocked]);

  useEffect(() => {
    if (!tokenLocked || !token.trim()) return;

    const source = new EventSource(
      `/api/events?token=${encodeURIComponent(token.trim())}`
    );
    const scheduleRefresh = () => {
      if (liveRefreshTimerRef.current) {
        window.clearTimeout(liveRefreshTimerRef.current);
      }
      liveRefreshTimerRef.current = window.setTimeout(() => {
        void refresh({ force: true, includeThread: true });
      }, 300);
    };
    source.addEventListener("open", () => {
      setStatusKind("ok");
      setStatus(t("Live updates connected"));
    });
    source.addEventListener("workspace-registered", scheduleRefresh);
    source.addEventListener("workspace-unregistered", scheduleRefresh);
    source.addEventListener("workspace-changed", scheduleRefresh);
    source.addEventListener("error", () => {
      setStatusKind("warn");
      setStatus(t("Live updates reconnecting"));
    });

    return () => {
      source.close();
      if (liveRefreshTimerRef.current) {
        window.clearTimeout(liveRefreshTimerRef.current);
        liveRefreshTimerRef.current = undefined;
      }
    };
  }, [refresh, token, tokenLocked]);

  return { api, apiPost, refresh };
}
