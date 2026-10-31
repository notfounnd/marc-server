import * as React from "react";
import { SignalHigh, SignalLow, SignalMedium } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MemoryBand } from "./types.js";

/** Band labels state relative confidence, never a percentage. */
const BAND_SIGNALS: Readonly<
  Record<MemoryBand, { Icon: LucideIcon; labelKey: string }>
> = {
  high: { Icon: SignalHigh, labelKey: "High confidence" },
  medium: { Icon: SignalMedium, labelKey: "Medium confidence" },
  low: { Icon: SignalLow, labelKey: "Low confidence" }
};

export function MemorySearchBandSignal({
  band,
  t
}: {
  band: MemoryBand;
  t: (key: string) => string;
}) {
  const signal = BAND_SIGNALS[band];
  if (!signal) return null;
  const label = t(signal.labelKey);
  return (
    <span className="memory-search-signal-row">
      <span
        className="memory-search-signal"
        role="img"
        aria-label={label}
        title={label}
        data-band={band}
      >
        <signal.Icon size={16} aria-hidden="true" />
      </span>
    </span>
  );
}
