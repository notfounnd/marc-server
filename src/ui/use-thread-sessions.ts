import { useEffect, useState } from "react";
import type { ApiGet, ThreadSessionsView } from "./types.js";

export type ThreadSessionsStatus = "loading" | "ready" | "error";

/** The state belongs to one workspace and thread key; a different key reads as loading. */
export type ThreadSessionsState = {
  key: string;
  status: ThreadSessionsStatus;
  view?: ThreadSessionsView;
  reason?: string;
};

const LOADING: ThreadSessionsState = { key: "", status: "loading" };

export function threadSessionsPath(
  workspaceId: string,
  threadId: string
): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/threads/${encodeURIComponent(threadId)}/sessions`;
}

/** A failed request keeps its reason so the menu can say why the sessions are unavailable. */
export async function loadThreadSessions(
  api: ApiGet,
  key: string,
  path: string
): Promise<ThreadSessionsState> {
  try {
    const view = await api<ThreadSessionsView>(path);
    return { key, status: "ready", view };
  } catch (error) {
    return { key, status: "error", reason: errorText(error) };
  }
}

export function visibleSessions(
  state: ThreadSessionsState,
  key: string
): ThreadSessionsState {
  if (state.key === key) return state;
  return { ...LOADING, key };
}

/**
 * Fetches the thread sessions on selection, on menu open, and whenever the app refresh
 * time changes. The refresh runs on workspace-changed events, so the view follows them.
 */
export function useThreadSessions({
  api,
  workspaceId,
  threadId,
  syncMark,
  open
}: {
  api: ApiGet;
  workspaceId: string;
  threadId: string;
  syncMark: Date | undefined;
  open: boolean;
}): ThreadSessionsState {
  const key = `${workspaceId}:${threadId}`;
  const path = threadSessionsPath(workspaceId, threadId);
  const [state, setState] = useState<ThreadSessionsState>(LOADING);

  useEffect(() => {
    let current = true;
    void loadThreadSessions(api, key, path).then((next) => {
      if (current) setState(next);
    });
    return () => {
      current = false;
    };
  }, [api, key, path, syncMark, open]);

  return visibleSessions(state, key);
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
