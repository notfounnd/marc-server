import React from "react";
import { CircleAlert } from "lucide-react";
import { Badge as NeoBadge } from "@/components/ui/badge";
import { Button as NeoButton } from "@/components/ui/button";
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
  variant = "secondary",
  ...props
}: Omit<React.ComponentProps<typeof NeoButton>, "variant"> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const variants = {
    ghost: "noShadow",
    primary: "default",
    secondary: "neutral"
  } as const;

  return <NeoButton variant={variants[variant]} {...props} />;
}

export function Badge({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber";
}) {
  const variants = {
    amber: "neutral",
    green: "default",
    neutral: "neutral"
  } as const;

  return (
    <NeoBadge
      variant={variants[tone]}
      className={classNames("status-badge", `status-badge-${tone}`)}
    >
      {children}
    </NeoBadge>
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
  children,
  icon,
  title,
  detail,
  tag,
  trailing,
  active,
  closed,
  disabled,
  tooltip,
  onClick
}: {
  children?: React.ReactNode;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  tag?: string;
  trailing?: React.ReactNode;
  active?: boolean;
  closed?: boolean;
  disabled?: boolean;
  tooltip?: string;
  onClick: () => void;
}) {
  return (
    <NeoButton
      variant="neutral"
      className={classNames(
        "nav-item h-auto",
        active && "active",
        closed && "nav-item-closed"
      )}
      disabled={disabled}
      onClick={onClick}
      title={tooltip}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-copy">
        <strong>{title}</strong>
        <span className="nav-detail-row">
          {detail ? <small>{detail}</small> : null}
          {tag ? <em>{tag}</em> : null}
        </span>
        {children}
      </span>
      {trailing ? <span className="nav-trailing">{trailing}</span> : null}
    </NeoButton>
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
