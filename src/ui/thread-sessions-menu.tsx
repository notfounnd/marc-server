import * as React from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { keepFocusAfterGoTo } from "./app-reference-actions.js";
import { HeaderMenu, closeThen } from "./header-menu.js";
import { showNotification } from "./notifications.js";
import { DegradedNotice } from "./thread-sessions-row.js";
import { PendingPanel } from "./thread-sessions-pending.js";
import { SlotGroups } from "./thread-sessions-groups.js";
import {
  useThreadSessions,
  type ThreadSessionsState,
  type ThreadSessionsStatus
} from "./use-thread-sessions.js";
import type {
  ApiGet,
  MarkdownLinkHandler,
  Thread,
  ThreadSessionsView,
  Translate,
  Workspace
} from "./types.js";

/** Which collapsible sections are open. Both start collapsed. */
export type Expansion = { pending: boolean; other: boolean };

const COLLAPSED: Expansion = { pending: false, other: false };

/** Read-only sessions menu beside the thread title. It shows the derived state of each profile
 * slot and copies its native Claude command. It never acquires, opens or kills a session. */
export function ThreadSessionsMenu({
  api,
  workspace,
  thread,
  syncMark,
  onOpenLink
}: {
  api: ApiGet;
  workspace: Workspace;
  thread: Thread;
  syncMark: Date | undefined;
  onOpenLink: MarkdownLinkHandler;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Expansion>(COLLAPSED);
  const sessions = useThreadSessions({
    api,
    workspaceId: workspace.id,
    threadId: thread.id,
    syncMark,
    open
  });
  const count = warningCountOf(sessions);
  const label = triggerLabel(t, count);
  const toggle = (key: keyof Expansion): void =>
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  const navigating = React.useRef(false);
  const goTo = closeThen(() => {
    navigating.current = true;
    setOpen(false);
  }, onOpenLink);

  return (
    <HeaderMenu
      icon={Users}
      label={label}
      title={t("Thread sessions")}
      headSlot={
        <PendingChip
          count={count}
          expanded={expanded.pending}
          onToggle={() => toggle("pending")}
          t={t}
        />
      }
      count={count}
      open={open}
      onOpenChange={setOpen}
      triggerClassName="sessions-trigger"
      onCloseAutoFocus={keepFocusAfterGoTo(navigating)}
    >
      <ThreadSessionsBody
        sessions={sessions}
        t={t}
        onOpenLink={goTo}
        onCopy={(text) => copyCommand(text, t)}
        expanded={expanded}
        onToggle={toggle}
      />
    </HeaderMenu>
  );
}

/** The pending count on the button. It is zero until the first view arrives. */
export function warningCountOf(sessions: ThreadSessionsState): number {
  return sessions.view?.warnings.length ?? 0;
}

/** The button's accessible name and title. The count joins the name only when items are pending. */
export function triggerLabel(t: Translate, count: number): string {
  if (count === 0) return t("Thread sessions");
  return t("Thread sessions, pending: {{count}}", { count });
}

/** The Pending chip in the menu header. It is hidden at zero, and shows the count and its state otherwise. */
export function PendingChip({
  count,
  expanded,
  onToggle,
  t
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  t: Translate;
}) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      className="sessions-chip-toggle"
      aria-expanded={expanded}
      onClick={onToggle}
    >
      <span>{t("Pending")}</span>
      <span className="sessions-count-chip">{count}</span>
    </button>
  );
}

type BodyProps = {
  sessions: ThreadSessionsState;
  t: Translate;
  onOpenLink: MarkdownLinkHandler;
  onCopy: (text: string) => void;
  expanded: Expansion;
  onToggle: (key: keyof Expansion) => void;
};

/** Dispatch table: fetch status to the body it shows. */
const BODY_RENDERERS: Record<
  ThreadSessionsStatus,
  (props: BodyProps) => React.ReactNode
> = {
  loading: ({ t }) => <p className="panel-status">{t("Loading sessions")}</p>,
  error: ({ t, sessions }) => (
    <div className="panel-status panel-status-error">
      <strong>{t("Sessions unavailable")}</strong>
      {sessions.reason ? <p>{sessions.reason}</p> : null}
    </div>
  ),
  ready: ({ sessions, t, onOpenLink, onCopy, expanded, onToggle }) => (
    <ReadyBody
      view={sessions.view}
      t={t}
      onOpenLink={onOpenLink}
      onCopy={onCopy}
      expanded={expanded}
      onToggle={onToggle}
    />
  )
};

/** Presentational body, so the rendering can be tested without the dropdown. */
export function ThreadSessionsBody(props: BodyProps) {
  return (
    <div className="popover-body">
      {BODY_RENDERERS[props.sessions.status](props)}
    </div>
  );
}

function ReadyBody({
  view,
  t,
  onOpenLink,
  onCopy,
  expanded,
  onToggle
}: {
  view?: ThreadSessionsView;
  t: Translate;
  onOpenLink: MarkdownLinkHandler;
  onCopy: (text: string) => void;
  expanded: Expansion;
  onToggle: (key: keyof Expansion) => void;
}) {
  if (!view) return null;
  return (
    <>
      <PendingPanel
        warnings={view.warnings}
        open={expanded.pending}
        t={t}
        onOpenLink={onOpenLink}
      />
      <SlotGroups
        slots={view.slots}
        t={t}
        onCopy={onCopy}
        otherOpen={expanded.other}
        onToggleOther={() => onToggle("other")}
      />
      <DegradedNotice view={view} t={t} />
    </>
  );
}

function copyCommand(text: string, t: Translate): void {
  void writeClipboard(text).then(
    () => showNotification(t("Command copied")),
    () => showNotification(t("Could not copy the command"), "error")
  );
}

async function writeClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/** Every label key the menu can show, for the catalog test. Table keys are not literal t() calls. */
export const MENU_LABEL_KEYS: string[] = [
  "Thread sessions",
  "Thread sessions, pending: {{count}}",
  "Loading sessions",
  "Sessions unavailable",
  "No agent profiles to show.",
  "Pending",
  "Active",
  "Ended",
  "Other profiles · {{count}}",
  "Command copied",
  "Could not copy the command"
];
