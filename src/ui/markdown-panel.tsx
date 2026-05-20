import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseMarcReference } from "../core/marc-references.js";
import { classNames } from "./common.js";
import {
  linkifyMarcReferences,
  marcReferenceLabel,
  transformMarkdownUrl
} from "./marc-links.js";
import type { MarkdownLinkHandler } from "./types.js";

export function MarkdownPanel({
  markdown,
  compact = false,
  onLink
}: {
  markdown: string;
  compact?: boolean;
  onLink?: MarkdownLinkHandler;
}) {
  const linkedMarkdown = useMemo(
    () => linkifyMarcReferences(markdown),
    [markdown]
  );

  return (
    <div
      className={classNames(
        "markdown-panel",
        compact && "markdown-panel-compact"
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={transformMarkdownUrl}
        components={{
          a: ({ href, children }) => {
            const target = href ?? "";
            const isExternal = /^https?:\/\//i.test(target);
            const marcLabel = parseMarcReference(target)
              ? marcReferenceLabel(target)
              : undefined;
            return (
              <a
                href={isExternal ? target : "#"}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noreferrer" : undefined}
                onClick={(event) => {
                  if (!isExternal) {
                    event.preventDefault();
                    onLink?.(target);
                  }
                }}
              >
                {marcLabel ?? children}
              </a>
            );
          }
        }}
      >
        {linkedMarkdown}
      </ReactMarkdown>
    </div>
  );
}
