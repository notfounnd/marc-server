import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pause } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { Button, classNames } from "./common.js";
import { showNotification } from "./notifications.js";
import {
  useWorkspaceActivation,
  setWorkspacePaused
} from "./use-thread-activation.js";
import { useThreadActivationContext } from "./thread-activation-context.js";
import type { ApiGet, ApiWrite, Workspace } from "./types.js";

/** Dispatch table: the pause state to the title and aria-label of the workspace control. */
const PAUSE_TITLES: Record<string, string> = {
  false: "Pause all activations in this workspace",
  true: "Resume activations in this workspace"
};

const BANNER_TEXT =
  "Activations are paused in this workspace on this machine. Mentions are recorded but nobody is woken.";

/** The tooltip of the disabled control when the workspace file is lost or invalid. */
const UNAVAILABLE_TEXT =
  "Activation state is unavailable. Open a thread's activation panel to recover it.";

/**
 * The pause switch of the workspace, beside its settings button. It reads the pause on load and
 * after each refresh, and it toggles the pause on click.
 */
export function WorkspacePauseControl({
  api,
  apiPost,
  workspace,
  syncMark
}: {
  api: ApiGet;
  apiPost: ApiWrite;
  workspace: Workspace;
  syncMark: Date | undefined;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = React.useState(false);
  const activation = useWorkspaceActivation({
    api,
    workspaceId: workspace.id,
    syncMark
  });
  const paused = activation.state.view?.paused === true;
  const ready = activation.state.status === "ready";
  const unavailable = activation.state.status === "error";
  const [tipOpen, setTipOpen] = React.useState(false);
  const title = t(PAUSE_TITLES[String(paused)]);

  const toggle = async (): Promise<void> => {
    setBusy(true);
    try {
      const next = await setWorkspacePaused(apiPost, workspace.id, !paused);
      activation.replace({
        paused: next.paused,
        pausedAt: next.pausedAt ?? null
      });
    } catch {
      showNotification(t("Could not change the activation pause"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip
        open={unavailable ? tipOpen : false}
        onOpenChange={(next) => setTipOpen(unavailable && next)}
      >
        <TooltipTrigger asChild>
          <div className="header-action">
            <Button
              variant={paused ? "primary" : "secondary"}
              className={classNames(
                "button-icon activation-pause",
                paused && "activation-pause-on"
              )}
              title={unavailable ? undefined : title}
              aria-label={title}
              aria-pressed={paused}
              disabled={!ready || busy}
              onClick={() => void toggle()}
            >
              <Pause size={14} />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          className="activation-tooltip"
        >
          {t(UNAVAILABLE_TEXT)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * The amber line at the top of an open thread while the workspace is paused. It reads the thread
 * view, which carries the workspace pause, and its Resume link lifts the pause.
 */
export function ThreadPausedBanner({
  apiPost,
  workspace
}: {
  apiPost: ApiWrite;
  workspace?: Workspace;
}) {
  const { t } = useTranslation();
  const { state, reload } = useThreadActivationContext();
  const paused = state.view?.paused === true;
  if (!workspace || !paused) return null;

  const resume = async (): Promise<void> => {
    try {
      await setWorkspacePaused(apiPost, workspace.id, false);
      reload();
    } catch {
      showNotification(t("Could not change the activation pause"), "error");
    }
  };

  return (
    <div className="activation-banner" role="status">
      <Pause size={15} aria-hidden="true" />
      <span>{t(BANNER_TEXT)}</span>
      <button
        type="button"
        className="activation-link"
        onClick={() => void resume()}
      >
        {t("Resume")}
      </button>
    </div>
  );
}

/** Every label key of this module that a table produces, for the catalog test. */
export const PAUSE_LABEL_KEYS: string[] = [
  ...Object.values(PAUSE_TITLES),
  BANNER_TEXT,
  UNAVAILABLE_TEXT
];
