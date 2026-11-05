import { useEffect, useState } from "react";
import type {
  ActivationStageId,
  ApiGet,
  ApiWrite,
  ThreadActivationView,
  WorkspaceActivationView
} from "./types.js";
import type { LeadBody } from "./thread-activation-people.js";

export type ActivationStatus = "loading" | "ready" | "error";

/** The state belongs to one workspace and thread key; a different key reads as loading. */
export type ThreadActivationState = {
  key: string;
  status: ActivationStatus;
  view?: ThreadActivationView;
  reason?: string;
};

export type WorkspaceActivationState = {
  key: string;
  status: ActivationStatus;
  view?: WorkspaceActivationView;
  reason?: string;
};

const LOADING_KEY = "";

export function threadActivationPath(
  workspaceId: string,
  threadId: string
): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/threads/${encodeURIComponent(threadId)}/activation`;
}

export function threadPolicyPath(
  workspaceId: string,
  threadId: string
): string {
  return `${threadActivationPath(workspaceId, threadId)}/policy`;
}

export function threadLeadPath(workspaceId: string, threadId: string): string {
  return `${threadActivationPath(workspaceId, threadId)}/lead`;
}

export type StageActionName = "extend" | "advance";

export function threadStageActionPath(
  workspaceId: string,
  threadId: string,
  action: StageActionName
): string {
  return `${threadActivationPath(workspaceId, threadId)}/${action}`;
}

export function workspaceActivationPath(workspaceId: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/activation`;
}

/** Dispatch table: the pause state to its daemon action. */
const PAUSE_ACTIONS: Record<string, string> = {
  true: "pause",
  false: "resume"
};

export function pauseActionPath(workspaceId: string, paused: boolean): string {
  return `${workspaceActivationPath(workspaceId)}/${PAUSE_ACTIONS[String(paused)]}`;
}

export function recoverPath(workspaceId: string): string {
  return `${workspaceActivationPath(workspaceId)}/recover`;
}

/**
 * Reads the thread activation view of the selected thread. The app loads it once per selection and
 * refreshes it whenever the app sync mark changes, so the panel and the message stamps share it.
 */
export function useThreadActivation({
  api,
  workspaceId,
  threadId,
  syncMark,
  enabled
}: {
  api: ApiGet;
  workspaceId: string;
  threadId: string;
  syncMark: Date | undefined;
  enabled: boolean;
}): {
  state: ThreadActivationState;
  replace: (view: ThreadActivationView) => void;
  reload: () => void;
} {
  const key = `${workspaceId}:${threadId}`;
  const path = threadActivationPath(workspaceId, threadId);
  const [state, setState] = useState<ThreadActivationState>({
    key: LOADING_KEY,
    status: "loading"
  });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void loadThreadActivation(api, key, path).then((next) => {
      if (current) setState(next);
    });
    return () => {
      current = false;
    };
  }, [api, key, path, syncMark, enabled, revision]);

  return {
    state: visibleThreadState(state, key),
    replace: (view) => setState({ key, status: "ready", view }),
    reload: () => setRevision((count) => count + 1)
  };
}

/** Reads the workspace pause, for the workspace view that has no thread to read it from. */
export function useWorkspaceActivation({
  api,
  workspaceId,
  syncMark
}: {
  api: ApiGet;
  workspaceId: string;
  syncMark: Date | undefined;
}): {
  state: WorkspaceActivationState;
  replace: (view: WorkspaceActivationView) => void;
} {
  const path = workspaceActivationPath(workspaceId);
  const [state, setState] = useState<WorkspaceActivationState>({
    key: LOADING_KEY,
    status: "loading"
  });

  useEffect(() => {
    let current = true;
    void loadWorkspaceActivation(api, workspaceId, path).then((next) => {
      if (current) setState(next);
    });
    return () => {
      current = false;
    };
  }, [api, workspaceId, path, syncMark]);

  return {
    state: visibleWorkspaceState(state, workspaceId),
    replace: (view) => setState({ key: workspaceId, status: "ready", view })
  };
}

async function loadThreadActivation(
  api: ApiGet,
  key: string,
  path: string
): Promise<ThreadActivationState> {
  try {
    const view = await api<ThreadActivationView>(path);
    return { key, status: "ready", view };
  } catch (error) {
    return { key, status: "error", reason: errorText(error) };
  }
}

async function loadWorkspaceActivation(
  api: ApiGet,
  key: string,
  path: string
): Promise<WorkspaceActivationState> {
  try {
    const view = await api<WorkspaceActivationView>(path);
    return { key, status: "ready", view };
  } catch (error) {
    return { key, status: "error", reason: errorText(error) };
  }
}

function visibleThreadState(
  state: ThreadActivationState,
  key: string
): ThreadActivationState {
  if (state.key === key) return state;
  return { key, status: "loading" };
}

function visibleWorkspaceState(
  state: WorkspaceActivationState,
  key: string
): WorkspaceActivationState {
  if (state.key === key) return state;
  return { key, status: "loading" };
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** The write calls the editor, the stage actions, the lead and the pause control make. */
export async function saveThreadPolicy(
  apiPut: ApiWrite,
  workspaceId: string,
  threadId: string,
  form: unknown
): Promise<ThreadActivationView> {
  return apiPut<ThreadActivationView>(
    threadPolicyPath(workspaceId, threadId),
    form
  );
}

export async function recoverWorkspace(
  apiPost: ApiWrite,
  workspaceId: string
): Promise<unknown> {
  return apiPost(recoverPath(workspaceId), {});
}

/** The human extends the current stage. The body names the stage the human saw, so a stale click is refused. */
export async function extendStage(
  apiPost: ApiWrite,
  workspaceId: string,
  threadId: string,
  expectedStage: string
): Promise<ThreadActivationView> {
  return apiPost<ThreadActivationView>(
    threadStageActionPath(workspaceId, threadId, "extend"),
    { expectedStage }
  );
}

/** The human advances to a stage ahead. The body names the stage seen and the destination. */
export async function advanceStage(
  apiPost: ApiWrite,
  workspaceId: string,
  threadId: string,
  expectedStage: string,
  to: ActivationStageId
): Promise<ThreadActivationView> {
  return apiPost<ThreadActivationView>(
    threadStageActionPath(workspaceId, threadId, "advance"),
    { expectedStage, to }
  );
}

/** The human makes an architect the lead. The daemon answers with the change, not with the view. */
export async function changeThreadLead(
  apiPut: ApiWrite,
  workspaceId: string,
  threadId: string,
  body: LeadBody
): Promise<unknown> {
  return apiPut(threadLeadPath(workspaceId, threadId), body);
}

export async function setWorkspacePaused(
  apiPost: ApiWrite,
  workspaceId: string,
  paused: boolean
): Promise<{ paused: boolean; pausedAt?: string }> {
  return apiPost<{ paused: boolean; pausedAt?: string }>(
    pauseActionPath(workspaceId, paused),
    {}
  );
}
