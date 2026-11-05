import * as React from "react";
import { useTranslation } from "react-i18next";
import { Zap } from "lucide-react";
import { HeaderMenu, closeThen } from "./header-menu.js";
import { ActivationForm } from "./thread-activation-form.js";
import { useThreadActivationContext } from "./thread-activation-context.js";
import { waitingCountOf } from "./thread-activation-waiting-model.js";
import type { ThreadActivationState } from "./use-thread-activation.js";
import type {
  ApiWrite,
  MarkdownLinkHandler,
  Message,
  Thread,
  ThreadActivationView,
  Translate,
  Workspace
} from "./types.js";

/**
 * The thread activation policy trigger, beside the sessions trigger. It opens a panel of the same
 * width. The panel reads the thread view that the app loaded for the selected thread, and saves
 * through the policy route.
 */
export function ThreadActivationMenu({
  apiPost,
  apiPut,
  workspace,
  thread,
  onOpenLink
}: {
  apiPost: ApiWrite;
  apiPut: ApiWrite;
  workspace: Workspace;
  thread: Thread;
  onOpenLink: MarkdownLinkHandler;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const { state, replace, reload, messages } = useThreadActivationContext();
  const waiting = waitingCountOf(state.view);
  const label = activationLabelOf(t, waiting);
  /** A go-to closes the panel first, so the page scrolls to the message and the panel does not cover it. */
  const goTo = closeThen(() => setOpen(false), onOpenLink);
  return (
    <HeaderMenu
      icon={Zap}
      label={label}
      title={t("Activation policy")}
      headSlot={revisionText(state.view, t)}
      count={waiting}
      open={open}
      onOpenChange={setOpen}
      triggerClassName="activation-trigger"
    >
      <div onKeyDown={keepTyping}>
        <ActivationBody
          state={state}
          messages={messages}
          workspaceId={workspace.id}
          threadId={thread.id}
          apiPost={apiPost}
          apiPut={apiPut}
          onSaved={replace}
          onReload={reload}
          goTo={goTo}
          t={t}
        />
      </div>
    </HeaderMenu>
  );
}

/** The ⚡ label, with the count of the rows that wait for the human when there are any. */
function activationLabelOf(t: Translate, waiting: number): string {
  if (waiting === 0) return t("Activation policy");
  return t("Activation policy, waiting for you: {{count}}", { count: waiting });
}

/** The short revision in the header, so a saved change is visible without opening the policy. */
function revisionText(
  view: ThreadActivationView | undefined,
  t: Translate
): string {
  if (!view) return "";
  if (!view.policy) return t("No saved policy yet");
  return t("Revision {{revision}}", {
    revision: view.policy.revision.slice(0, 8)
  });
}

/**
 * The menu's own key handling moves focus between items, which would take focus out of the form
 * fields. Keys stay inside the form; Escape still reaches the menu and closes it.
 */
function keepTyping(event: React.KeyboardEvent<HTMLDivElement>): void {
  if (event.key === "Escape") return;
  event.stopPropagation();
}

function ActivationBody({
  state,
  messages,
  workspaceId,
  threadId,
  apiPost,
  apiPut,
  onSaved,
  onReload,
  goTo,
  t
}: {
  state: ThreadActivationState;
  messages: Message[];
  workspaceId: string;
  threadId: string;
  apiPost: ApiWrite;
  apiPut: ApiWrite;
  onSaved: (view: ThreadActivationView) => void;
  onReload: () => void;
  goTo: (href: string) => void;
  t: Translate;
}) {
  if (state.status === "loading") {
    return <p className="panel-status">{t("Loading activation policy")}</p>;
  }
  if (state.status === "error") {
    return (
      <div className="panel-status panel-status-error">
        <strong>{t("Activation policy unavailable")}</strong>
        {state.reason ? <p>{state.reason}</p> : null}
      </div>
    );
  }
  if (!state.view) return null;
  return (
    <ActivationForm
      key={threadId}
      view={state.view}
      messages={messages}
      workspaceId={workspaceId}
      threadId={threadId}
      apiPost={apiPost}
      apiPut={apiPut}
      onSaved={onSaved}
      onReload={onReload}
      goTo={goTo}
    />
  );
}
