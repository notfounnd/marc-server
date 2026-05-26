import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleHelp, MessageSquareText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { MAX_MESSAGE_CHARS, validateMessageBody } from "../core/guards.js";
import {
  applyAutocompleteOption,
  buildAutocompleteOptions,
  detectAutocompleteRequest,
  getAutocompleteRemoteThreadId,
  type ComposerAutocompleteOption,
  type ComposerAutocompleteRequest
} from "./composer-autocomplete.js";
import { Button, classNames } from "./common.js";
import type { Agent, Message, Thread } from "./types.js";

export function Composer({
  agentId,
  body,
  agents,
  threads,
  messages,
  sending,
  onAgentIdChange,
  onBodyChange,
  onSend,
  loadThreadMessages
}: {
  agentId: string;
  body: string;
  agents: Agent[];
  threads: Thread[];
  messages: Message[];
  sending: boolean;
  onAgentIdChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSend: () => void;
  loadThreadMessages: (threadId: string) => Promise<Message[]>;
}) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autocompleteListRef = useRef<HTMLDivElement>(null);
  const [autocomplete, setAutocomplete] = useState<{
    request: ComposerAutocompleteRequest;
    options: ComposerAutocompleteOption[];
    activeIndex: number;
  }>();
  const trimmedBody = body.trim();
  const validation = validateMessageBody(body);
  const remainingChars = Math.max(0, MAX_MESSAGE_CHARS - trimmedBody.length);
  const isOverCharacterLimit = trimmedBody.length > MAX_MESSAGE_CHARS;
  const canSend = Boolean(trimmedBody) && validation.ok && !sending;

  useEffect(() => {
    const activeItem =
      autocompleteListRef.current?.querySelector<HTMLButtonElement>(
        ".composer-autocomplete-item.active"
      );
    activeItem?.scrollIntoView({ block: "nearest" });
  }, [autocomplete?.activeIndex]);

  async function openAutocomplete() {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? body.length;
    const request = detectAutocompleteRequest(body, cursor);
    if (!request) {
      setAutocomplete(undefined);
      return;
    }

    const remoteThreadId = getAutocompleteRemoteThreadId(request);
    const remoteMessages = remoteThreadId
      ? await loadThreadMessages(remoteThreadId)
      : undefined;
    const options = buildAutocompleteOptions(request, {
      agents,
      threads,
      currentMessages: messages,
      remoteMessages
    });

    setAutocomplete({
      request,
      options,
      activeIndex: 0
    });
  }

  function insertAutocompleteOption(option: ComposerAutocompleteOption) {
    if (!autocomplete) return;
    const result = applyAutocompleteOption(
      body,
      autocomplete.request,
      option.value
    );
    onBodyChange(result.value);
    setAutocomplete(undefined);
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(result.cursor, result.cursor);
    }, 0);
  }

  function handleComposerKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (event.ctrlKey && event.code === "Space") {
      event.preventDefault();
      void openAutocomplete();
      return;
    }

    if (!autocomplete) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setAutocomplete(undefined);
      return;
    }

    if (!autocomplete.options.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setAutocomplete((current) =>
        current
          ? {
              ...current,
              activeIndex: (current.activeIndex + 1) % current.options.length
            }
          : current
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setAutocomplete((current) =>
        current
          ? {
              ...current,
              activeIndex:
                (current.activeIndex - 1 + current.options.length) %
                current.options.length
            }
          : current
      );
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insertAutocompleteOption(autocomplete.options[autocomplete.activeIndex]);
    }
  }

  return (
    <Card className="composer">
      <div className="composer-head">
        <div>
          <h3>{t("Post to this thread")}</h3>
          <p>
            {t("Messages are appended to the same CHAT.md that agents read.")}
          </p>
        </div>
        <Label>
          {t("Sender")}
          <Input
            value={agentId}
            onChange={(event) => onAgentIdChange(event.target.value)}
            placeholder="ui-user"
          />
        </Label>
      </div>
      <div className="composer-input-wrap">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(event) => {
            onBodyChange(event.target.value);
            setAutocomplete(undefined);
          }}
          onKeyDown={handleComposerKeyDown}
          placeholder={t(
            "Write a note, decision, or instruction for the agents..."
          )}
          rows={5}
        />
        {autocomplete ? (
          <div
            ref={autocompleteListRef}
            className="composer-autocomplete"
            role="listbox"
            aria-label={t("mARC reference suggestions")}
          >
            {autocomplete.options.length ? (
              autocomplete.options.map((option, index) => (
                <button
                  className={classNames(
                    "composer-autocomplete-item",
                    index === autocomplete.activeIndex && "active",
                    option.closed && "composer-autocomplete-closed",
                    option.parentMessageId && "composer-autocomplete-child"
                  )}
                  key={`${option.type}:${option.value}`}
                  onFocus={() =>
                    setAutocomplete((current) =>
                      current ? { ...current, activeIndex: index } : current
                    )
                  }
                  onMouseEnter={() =>
                    setAutocomplete((current) =>
                      current ? { ...current, activeIndex: index } : current
                    )
                  }
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertAutocompleteOption(option);
                  }}
                  role="option"
                  aria-selected={index === autocomplete.activeIndex}
                >
                  <span className="composer-autocomplete-kind">
                    {t(option.type)}
                  </span>
                  <span className="composer-autocomplete-main">
                    {option.label}
                  </span>
                  <small>{t(option.detail)}</small>
                </button>
              ))
            ) : (
              <div className="composer-autocomplete-empty">
                {t("No references found")}
              </div>
            )}
          </div>
        ) : null}
      </div>
      <div className="composer-actions">
        <span
          className={classNames(
            "composer-count",
            isOverCharacterLimit && "composer-count-limit"
          )}
        >
          {t("{{count}} chars left", { count: remainingChars })}
        </span>
        {!validation.ok && trimmedBody ? (
          <span className="composer-warning">{validation.reason}</span>
        ) : null}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="composer-tip">
                <CircleHelp size={16} />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {t(
                "For large notes, post a short message first and then attach a markdown artifact to it."
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button variant="primary" onClick={onSend} disabled={!canSend}>
          <MessageSquareText size={15} />
          {sending ? t("Posting") : t("Post message")}
        </Button>
      </div>
    </Card>
  );
}
