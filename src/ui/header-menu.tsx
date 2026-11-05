import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "./common.js";
import { MenuHead } from "./menu-head.js";
import type { MarkdownLinkHandler } from "./types.js";

/**
 * The pressed look of a header trigger while its menu is open. Every header menu uses it, so the
 * buttons stay pressed alike. It is a trigger class, not a Button variant.
 */
export const PRESSED_TRIGGER_CLASS =
  "data-[state=open]:translate-x-boxShadowX data-[state=open]:translate-y-boxShadowY data-[state=open]:shadow-none";

/** A go-to action closes the menu first, so the page scrolls to the message and the menu does not cover it. */
export function closeThen(
  close: () => void,
  onOpenLink: MarkdownLinkHandler
): MarkdownLinkHandler {
  return (href) => {
    close();
    return onOpenLink(href);
  };
}

/**
 * A header button that opens a popover: the icon button with its optional count, and the popover
 * with its header and its body. The caller owns the open state and the body; this component owns
 * the trigger and the popover frame, so every header menu looks and behaves the same way.
 */
export function HeaderMenu({
  icon: Icon,
  label,
  title,
  headSlot,
  count,
  open,
  onOpenChange,
  onCloseAutoFocus,
  triggerClassName,
  children
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  headSlot?: React.ReactNode;
  count?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  const triggerClass = [
    "button-icon count-trigger",
    triggerClassName,
    PRESSED_TRIGGER_CLASS
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="header-action">
      <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={open ? "primary" : "secondary"}
            className={triggerClass}
            title={label}
            aria-label={label}
          >
            <Icon size={14} />
            {count !== undefined && count > 0 ? (
              <span className="count-badge">{count}</span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="popover-menu"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <MenuHead icon={<Icon size={14} />} title={title}>
            {headSlot}
          </MenuHead>
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
