import { type AnimationEvent, type FormEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PencilSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { ModalSheetHeader } from "./modal-sheet-header.js";
import type { ThreadCreationResult } from "./thread-creation.js";
import type { Workspace } from "./types.js";

type FormState =
  | { status: "ready" }
  | { status: "create-error"; error: string }
  | { status: "read-error"; error: string }
  | { status: "invalid" };
type FormStateByStatus = {
  [Status in FormState["status"]]: Extract<FormState, { status: Status }>;
};
type FormStateErrorStrategies = {
  [Status in keyof FormStateByStatus]: (
    state: FormStateByStatus[Status]
  ) => string;
};
type ThreadCreationResultByStatus = {
  [Status in ThreadCreationResult["status"]]: Extract<
    ThreadCreationResult,
    { status: Status }
  >;
};
type ThreadCreationResultStrategies = {
  [Status in keyof ThreadCreationResultByStatus]: (
    result: ThreadCreationResultByStatus[Status]
  ) => void;
};

export function ThreadCreateModal({
  pending,
  workspace,
  onClose,
  onCreate,
  onRetryRead
}: {
  pending: boolean;
  workspace: Workspace;
  onClose: () => void;
  onCreate: (title: string) => Promise<ThreadCreationResult>;
  onRetryRead: () => Promise<ThreadCreationResult>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState("");
  const [formState, setFormState] = useState<FormState>({ status: "ready" });
  const titleRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const errorMessage = threadCreationError(formState, t);
  const resultStrategies: ThreadCreationResultStrategies = {
    created: () => setOpen(false),
    "create-error": (result) =>
      setFormState({ status: "create-error", error: result.error }),
    invalid: () => setFormState({ status: "invalid" }),
    "read-error": (result) =>
      setFormState({ status: "read-error", error: result.error }),
    stale: () => setOpen(false)
  };
  const submissionStrategies: Record<
    FormState["status"],
    () => Promise<ThreadCreationResult>
  > = {
    ready: () => onCreate(title),
    "create-error": () => onCreate(title),
    invalid: () => onCreate(title),
    "read-error": () => onRetryRead()
  };
  const failureStrategies: Record<
    FormState["status"],
    (error: string) => void
  > = {
    ready: (error) => setFormState({ status: "create-error", error }),
    "create-error": (error) => setFormState({ status: "create-error", error }),
    invalid: (error) => setFormState({ status: "create-error", error }),
    "read-error": (error) => setFormState({ status: "read-error", error })
  };

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return;
    setOpen(nextOpen);
  }

  function handleOpenAutoFocus(event: Event) {
    event.preventDefault();
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement !== document.body
    ) {
      returnFocusRef.current = activeElement;
    }
    titleRef.current?.focus();
  }

  function handleCloseAutoFocus(event: Event) {
    event.preventDefault();
    returnFocusRef.current?.focus();
  }

  function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (open) return;
    if (event.currentTarget !== event.target) return;
    onClose();
  }

  function finishWith<Status extends ThreadCreationResult["status"]>(
    result: ThreadCreationResultByStatus[Status]
  ) {
    resultStrategies[result.status](result);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormState({ status: "ready" });
    try {
      finishWith(await submissionStrategies[formState.status]());
    } catch (error) {
      failureStrategies[formState.status](
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="modal-panel artifact-sheet thread-create-sheet"
        showCloseButton={false}
        onOpenAutoFocus={handleOpenAutoFocus}
        onCloseAutoFocus={handleCloseAutoFocus}
        onAnimationEnd={handleAnimationEnd}
      >
        <ModalSheetHeader
          closeDisabled={pending}
          eyebrow={
            <>
              <PencilSparkles size={14} />
              {t("Create thread")}
            </>
          }
          title={workspace.name}
          description={workspace.rootPath}
        />
        <form className="thread-create-form" onSubmit={handleSubmit}>
          <Label className="modal-field" htmlFor="thread-create-title">
            {t("Title")}
            <Input
              ref={titleRef}
              id="thread-create-title"
              aria-label={t("Title")}
              disabled={pending || formState.status === "read-error"}
              value={title}
              placeholder={t("Thread title")}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Label>
          {errorMessage ? (
            <p className="thread-create-feedback" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <SheetFooter className="modal-actions">
            <Button
              type="button"
              variant="neutral"
              disabled={pending}
              onClick={() => handleOpenChange(false)}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                pending || (formState.status !== "read-error" && !title.trim())
              }
            >
              {pending
                ? t("Creating thread")
                : formState.status === "read-error"
                  ? t("Retry loading thread")
                  : t("Create thread")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function threadCreationError(
  state: FormState,
  t: (key: string, options?: Record<string, string>) => string
): string {
  const strategies: FormStateErrorStrategies = {
    ready: () => "",
    "create-error": (formState) =>
      t("Could not create thread: {{error}}", { error: formState.error }),
    invalid: () => t("Enter a valid thread title."),
    "read-error": (formState) =>
      t("Thread created but could not be loaded: {{error}}", {
        error: formState.error
      })
  };
  return strategies[state.status](state);
}
