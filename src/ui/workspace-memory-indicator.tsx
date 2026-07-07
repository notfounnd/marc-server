import {
  DatabaseBackup,
  DatabaseCheck,
  DatabaseX,
  DatabaseZap
} from "lucide-react";
import { classNames } from "./common.js";
import {
  memoryIndicatorForStatus,
  type MemoryIndicatorIcon
} from "./memory-status.js";
import type { MemoryIndexHealth } from "./types.js";

const MEMORY_INDICATOR_ICONS = {
  DatabaseBackup,
  DatabaseCheck,
  DatabaseX,
  DatabaseZap
} satisfies Record<MemoryIndicatorIcon, typeof DatabaseCheck>;

export function workspaceMemoryIndicator(
  health: MemoryIndexHealth | undefined,
  t: (key: string) => string
) {
  const indicator = memoryIndicatorForStatus(health);
  if (!indicator) return undefined;
  const Icon = MEMORY_INDICATOR_ICONS[indicator.icon];
  const label = t(indicator.label);
  return (
    <span
      aria-label={label}
      className={classNames(
        "memory-indicator",
        `memory-indicator-${indicator.tone}`
      )}
      title={label}
    >
      <Icon size={16} />
    </span>
  );
}
