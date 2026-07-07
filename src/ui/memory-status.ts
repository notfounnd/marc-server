export type MemoryIndicatorStatus =
  | "ready"
  | "missing"
  | "stale"
  | "model_missing"
  | "incompatible"
  | "rebuilding"
  | "degraded";

export type MemoryIndicatorIcon =
  | "DatabaseBackup"
  | "DatabaseCheck"
  | "DatabaseX"
  | "DatabaseZap";

export type MemoryIndicatorTone = "action" | "busy" | "error" | "ready";

export type MemoryIndicator = {
  icon: MemoryIndicatorIcon;
  tone: MemoryIndicatorTone;
  label: string;
};

export type MemoryIndicatorHealth = {
  status: MemoryIndicatorStatus;
};

const INDICATORS: Record<MemoryIndicatorStatus, MemoryIndicator> = {
  degraded: {
    icon: "DatabaseX",
    label: "Memory degraded",
    tone: "error"
  },
  incompatible: {
    icon: "DatabaseX",
    label: "Memory incompatible",
    tone: "error"
  },
  missing: {
    icon: "DatabaseBackup",
    label: "Memory missing",
    tone: "action"
  },
  model_missing: {
    icon: "DatabaseBackup",
    label: "Memory model missing",
    tone: "action"
  },
  ready: {
    icon: "DatabaseCheck",
    label: "Memory ready",
    tone: "ready"
  },
  rebuilding: {
    icon: "DatabaseZap",
    label: "Memory rebuilding",
    tone: "busy"
  },
  stale: {
    icon: "DatabaseBackup",
    label: "Memory stale",
    tone: "action"
  }
};

export function memoryIndicatorForStatus(
  health: MemoryIndicatorHealth | undefined
): MemoryIndicator | undefined {
  if (!health) return undefined;
  return INDICATORS[health.status];
}
