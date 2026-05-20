import { useTranslation } from "react-i18next";
import { Archive, Paperclip } from "lucide-react";
import { messageArtifactReference } from "../core/marc-references.js";
import { Badge, Button, EmptyState } from "./common.js";
import { MarkdownPanel } from "./markdown-panel.js";
import type { MarkdownLinkHandler, Message, ThreadPayload } from "./types.js";

export function ThreadView({
  payload,
  onAttachArtifact,
  onLink,
  onCopyReference
}: {
  payload?: ThreadPayload;
  onAttachArtifact: (message: Message) => void;
  onLink: MarkdownLinkHandler;
  onCopyReference: (reference: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();

  if (!payload) {
    return (
      <EmptyState
        title={t("Loading thread")}
        detail={t("Waiting for the daemon response.")}
      />
    );
  }

  const messages = payload.messages ?? [];
  const summary = payload.summary ? (
    <section className="summary-panel">
      <div className="section-title">
        <Archive size={16} />
        <h2>{t("Executive Summary")}</h2>
      </div>
      <MarkdownPanel markdown={payload.summary} compact onLink={onLink} />
    </section>
  ) : null;

  if (!messages.length) {
    return (
      <>
        {summary}
        {payload.markdown ? (
          <MarkdownPanel markdown={payload.markdown} onLink={onLink} />
        ) : (
          <EmptyState
            title={t("No messages")}
            detail={t("This thread has no messages yet.")}
          />
        )}
      </>
    );
  }

  return (
    <>
      {summary}
      <div className="message-list">
        {messages.map((message) => (
          <article
            className="message-card"
            id={`message-${message.id}`}
            key={message.id}
          >
            <div className="message-card-head">
              <div className="message-meta">
                <button
                  className="message-reference-pill message-reference-agent"
                  onClick={() =>
                    void onCopyReference(`marc://@${message.agentId}`)
                  }
                >
                  {message.agentId}
                </button>
                {message.role ? <Badge>{message.role}</Badge> : null}
                <button
                  className="message-reference-pill"
                  onClick={() => void onCopyReference(`marc://#${message.id}`)}
                >
                  #{message.id}
                </button>
                <Badge>{new Date(message.timestamp).toLocaleString()}</Badge>
              </div>
              <div className="message-actions">
                {message.role === "user" ? (
                  <Button
                    variant="ghost"
                    className="button-icon message-action"
                    onClick={() => onAttachArtifact(message)}
                    title={t("Attach markdown artifact")}
                  >
                    <Paperclip size={15} />
                  </Button>
                ) : null}
              </div>
            </div>
            <MarkdownPanel markdown={message.body} compact onLink={onLink} />
            {message.artifacts.length ? (
              <div className="message-artifacts">
                {message.artifacts.map((artifact) => {
                  const href = messageArtifactReference(message.id, artifact);
                  return (
                    <button
                      className="artifact-link"
                      key={artifact}
                      onClick={() => void onLink(href)}
                    >
                      <Paperclip size={14} />
                      <span>{artifact.replace(/^artifacts\//, "")}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
