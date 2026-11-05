import * as React from "react";
import { SquareArrowOutUpRight } from "lucide-react";
import type { MarkdownLinkHandler } from "./types.js";

/**
 * The go-to button: an icon that opens a marc:// reference. Its label is the title and the accessible name, so
 * the button is found by that name. The sessions menu and the waiting panel share it.
 */
export function GoToButton({
  reference,
  label,
  onOpenLink
}: {
  reference: string;
  label: string;
  onOpenLink: MarkdownLinkHandler;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      title={label}
      aria-label={label}
      data-reference={reference}
      onClick={() => void onOpenLink(reference)}
    >
      <SquareArrowOutUpRight size={14} aria-hidden="true" />
    </button>
  );
}
