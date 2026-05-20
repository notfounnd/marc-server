import React from "react";
import { CircleAlert } from "lucide-react";
import type { Thread } from "./types.js";

export function classNames(
  ...values: Array<string | false | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export function isClosedThread(thread: Thread): boolean {
  return (
    thread.status === "closed" || Boolean(thread.closedAt || thread.summaryPath)
  );
}

export function Button({
  children,
  variant = "secondary",
  onClick,
  disabled,
  title,
  className
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      className={classNames("button", `button-${variant}`, className)}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber";
}) {
  return (
    <span className={classNames("badge", `badge-${tone}`)}>{children}</span>
  );
}

export function EmptyState({
  title,
  detail
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="empty-state">
      <CircleAlert size={18} />
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

export function NavItem({
  icon,
  title,
  detail,
  tag,
  active,
  closed,
  onClick
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  tag?: string;
  active?: boolean;
  closed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={classNames(
        "nav-item",
        active && "active",
        closed && "nav-item-closed"
      )}
      onClick={onClick}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-copy">
        <strong>{title}</strong>
        <span className="nav-detail-row">
          {detail ? <small>{detail}</small> : null}
          {tag ? <em>{tag}</em> : null}
        </span>
      </span>
    </button>
  );
}

export function parseAgentProfile(markdown: string): {
  title: string;
  role?: string;
  model?: string;
} {
  return {
    title: markdown.match(/^#\s+(.+)$/m)?.[1] ?? "Agent",
    role: markdown.match(/^Role:\s+(.+)$/m)?.[1],
    model: markdown.match(/^Model:\s+(.+)$/m)?.[1]
  };
}
