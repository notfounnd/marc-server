import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./common.js";
import { draftOf, formOf } from "./thread-activation-draft.js";
import {
  failureLinesOf,
  serverFailureOf,
  type ServerFailure
} from "./thread-activation-failures.js";
import { leadBodyOf } from "./thread-activation-people.js";
import {
  faultLinesOf,
  isEnabled,
  isRecoverable,
  isRestored,
  recoverNoteKeyOf,
  showsStageOf
} from "./thread-activation-status.js";
import {
  ActivationFaults,
  ActivationStageSection,
  ActivationStatusSection
} from "./thread-activation-sections.js";
import { ParticipantsSection } from "./thread-activation-lists.js";
import {
  ActivationWaitingSection,
  type WaitingAct
} from "./thread-activation-waiting.js";
import {
  permissionPathOf,
  supervisionPathOf
} from "./thread-activation-waiting-model.js";
import {
  advanceStage,
  changeThreadLead,
  extendStage,
  recoverWorkspace,
  saveThreadPolicy
} from "./use-thread-activation.js";
import type {
  ActivationStageId,
  ApiWrite,
  Message,
  ThreadActivationView
} from "./types.js";
import { approvalWarningOf } from "./thread-activation-status.js";

/**
 * The policy panel. It mounts once the saved view has loaded and keeps the switch while the view
 * refreshes. A save or a stage change answers with the new view, and the draft restarts from it. A
 * lead change answers without the view, so the panel reloads it after every lead attempt.
 */
type CardAct = Extract<WaitingAct, { kind: "card" }>;
type PermissionAct = Extract<WaitingAct, { kind: "permission" }>;

/** A card action names its card by the message and the recipient, which the daemon reads from CHAT.md. */
function cardRequest(
  act: CardAct,
  workspaceId: string,
  threadId: string
): { path: string; body: unknown } {
  return {
    path: supervisionPathOf(workspaceId, threadId, act.action),
    body: { messageId: act.card.messageId, recipient: act.card.recipient }
  };
}

/** A permission decision names its request. The daemon accepts only the panel's own decision. */
function permissionRequest(
  act: PermissionAct,
  workspaceId: string,
  threadId: string
): { path: string; body: unknown } {
  return {
    path: permissionPathOf(workspaceId, threadId, act.requestId),
    body: { decision: act.decision }
  };
}

export function ActivationForm({
  view,
  messages,
  workspaceId,
  threadId,
  apiPost,
  apiPut,
  onSaved,
  onReload,
  goTo
}: {
  view: ThreadActivationView;
  messages: Message[];
  workspaceId: string;
  threadId: string;
  apiPost: ApiWrite;
  apiPut: ApiWrite;
  onSaved: (saved: ThreadActivationView) => void;
  onReload: () => void;
  goTo: (href: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = React.useState(() => draftOf(view));
  const [failure, setFailure] = React.useState<ServerFailure | undefined>();
  const [saving, setSaving] = React.useState(false);
  const [recovering, setRecovering] = React.useState(false);
  const [acting, setActing] = React.useState(false);
  const [replacing, setReplacing] = React.useState(false);

  async function submit(): Promise<void> {
    setSaving(true);
    setFailure(undefined);
    try {
      const saved = await saveThreadPolicy(
        apiPut,
        workspaceId,
        threadId,
        formOf(draft, view.policy, view.legacyStage)
      );
      setDraft(draftOf(saved));
      setReplacing(false);
      onSaved(saved);
    } catch (error) {
      setFailure(serverFailureOf(error));
    } finally {
      setSaving(false);
    }
  }

  function save(): void {
    if (view.policyState === "invalid" && !replacing) {
      setReplacing(true);
      return;
    }
    void submit();
  }

  /** One stage call. A refusal shows its line and reloads the view, so the panel shows the stage that stands. */
  async function attempt(
    call: () => Promise<ThreadActivationView>
  ): Promise<void> {
    setActing(true);
    setFailure(undefined);
    try {
      onSaved(await call());
    } catch (error) {
      setFailure(serverFailureOf(error));
      onReload();
    } finally {
      setActing(false);
    }
  }

  function extend(): void {
    const budget = view.budget;
    if (budget === null) return;
    void attempt(() =>
      extendStage(apiPost, workspaceId, threadId, budget.currentStage)
    );
  }

  function advance(to: ActivationStageId): void {
    const budget = view.budget;
    if (budget === null) return;
    void attempt(() =>
      advanceStage(apiPost, workspaceId, threadId, budget.currentStage, to)
    );
  }

  async function makeLead(agentId: string): Promise<void> {
    setActing(true);
    setFailure(undefined);
    try {
      await changeThreadLead(
        apiPut,
        workspaceId,
        threadId,
        leadBodyOf(agentId, view.lead)
      );
    } catch (error) {
      setFailure(serverFailureOf(error));
    } finally {
      setActing(false);
      onReload();
    }
  }

  async function recover(): Promise<void> {
    setRecovering(true);
    setFailure(undefined);
    try {
      await recoverWorkspace(apiPost, workspaceId);
      onReload();
    } catch (error) {
      setFailure(serverFailureOf(error));
    } finally {
      setRecovering(false);
    }
  }

  /**
   * One call of the waiting section. Every call reloads the view afterwards, so a row that the daemon
   * refused or that another action already settled shows the state that stands.
   */
  async function supervise(act: WaitingAct): Promise<void> {
    const request =
      act.kind === "card"
        ? cardRequest(act, workspaceId, threadId)
        : permissionRequest(act, workspaceId, threadId);
    setActing(true);
    setFailure(undefined);
    try {
      await apiPost(request.path, request.body);
    } catch (error) {
      setFailure(serverFailureOf(error));
    } finally {
      setActing(false);
      onReload();
    }
  }

  const failureLines = failure ? failureLinesOf(failure, t) : [];
  const busy = saving || acting || recovering;
  const approvals = view.approvedAgents ?? [];

  return (
    <div>
      <div className="popover-body">
        <ActivationStatusSection
          view={view}
          enabled={draft.enabled}
          onToggle={(enabled) =>
            setDraft((current) => ({ ...current, enabled }))
          }
          t={t}
        />
        <ActivationFaults
          lines={faultLinesOf(view)}
          recoverable={isRecoverable(view)}
          recoverNoteKey={recoverNoteKeyOf(view)}
          busy={recovering}
          onRecover={() => void recover()}
          t={t}
        />
        {showsStageOf(view) && view.budget ? (
          <ActivationStageSection
            view={view}
            budget={view.budget}
            busy={busy}
            onExtend={() => void extend()}
            onAdvance={advance}
            t={t}
          />
        ) : null}
        <ActivationWaitingSection
          view={view}
          messages={messages}
          busy={busy}
          goTo={goTo}
          onAct={(act) => void supervise(act)}
          t={t}
        />
        {isEnabled(view) && !isRestored(view) ? (
          <ParticipantsSection
            participants={view.participants}
            lead={view.lead}
            approved={approvals}
            busy={busy}
            onMakeLead={(agentId) => void makeLead(agentId)}
            t={t}
          />
        ) : null}
      </div>
      <div className="activation-footer">
        <span className="activation-hint">
          {t("Saved changes create a new revision.")}
        </span>
        {view.legacyStage !== null && draft.enabled ? (
          <p className="activation-line" data-tone="warn">
            {t(
              "Saving moves this thread from an earlier stage to Planning. Its cycle history is kept."
            )}
          </p>
        ) : null}
        {approvals.length > 0 ? (
          <p className="activation-line" data-tone="warn">
            {approvalWarningOf(approvals.length, t)}
          </p>
        ) : null}
        <div className="activation-errors" role="alert">
          {failureLines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        {replacing ? (
          <div className="activation-confirm">
            <span className="activation-note">
              {t(
                "The saved policy file cannot be read. Replacing it discards its content."
              )}
            </span>
            <Button variant="primary" disabled={saving} onClick={save}>
              {t("Replace unreadable policy")}
            </Button>
            <Button variant="secondary" onClick={() => setReplacing(false)}>
              {t("Cancel")}
            </Button>
          </div>
        ) : (
          <Button variant="primary" disabled={busy} onClick={save}>
            {t("Save")}
          </Button>
        )}
      </div>
    </div>
  );
}
