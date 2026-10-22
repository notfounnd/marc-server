import type { MemoryBand } from "../types.js";

/**
 * Heuristic confidence cuts on the M0 eligibility. They are the production values of
 * production.fallbackCuts in the fit of capture 1b68a7e3f4e6 (fit.json). They order the
 * results by relative confidence; they are not probabilities of relevance.
 */
export const MEMORY_BAND_CUTS = {
  high: 0.9998832326558279,
  medium: 0.8958386806238463,
  low: 0.029530510370742287
} as const;

/** Cuts in descending order: a score belongs to the first band whose cut it reaches. */
const BAND_CUTS: ReadonlyArray<{ band: MemoryBand; cut: number }> = [
  { band: "high", cut: MEMORY_BAND_CUTS.high },
  { band: "medium", cut: MEMORY_BAND_CUTS.medium },
  { band: "low", cut: MEMORY_BAND_CUTS.low }
];

/**
 * The band of an eligibility. A score below the lowest cut is also low, so every
 * admitted hit has a band. Admission is decided before this function is called.
 */
export function memoryBandOf(eligibility: number): MemoryBand {
  const reached = BAND_CUTS.find(({ cut }) => eligibility >= cut);
  return reached?.band ?? "low";
}
