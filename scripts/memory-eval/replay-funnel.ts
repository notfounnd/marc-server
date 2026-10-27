import fs from "node:fs/promises";
import { validateFunnelBudget } from "../../src/core/memory/funnel-budget.js";
import type { RerankSelectionMode } from "../../src/core/memory/funnel-selection.js";
import type { FunnelParams } from "./variants.js";

/** The selection modes of the funnel. There is no default: the command must name one. */
const SELECTION_MODES: readonly RerankSelectionMode[] = ["cosine", "cosine-fts"];

/** The command-line values of the funnel. A missing value is `undefined`, never a default. */
export type FunnelOptions = {
  budget: string | undefined;
  k: string | undefined;
  mode: string | undefined;
  bandCutsPath: string | undefined;
};

/**
 * The funnel parameters of a replay. Budget, K and the mode are all required; without one of them
 * the result is `undefined`, and every funnel variant is then incomplete with missing-funnel-params.
 * The band cuts are read from their own file and checked; they are optional, and only the adaptive
 * variants need them. Invalid values stop the command before any case is replayed.
 */
export async function funnelParamsOf(options: FunnelOptions): Promise<FunnelParams | undefined> {
  const budget = integerOf(options.budget);
  const k = integerOf(options.k);
  const mode = modeOf(options.mode);
  if (budget === undefined || k === undefined || mode === undefined) return undefined;
  validateFunnelBudget(budget, k);
  const cuts = options.bandCutsPath === undefined ? undefined : await readBandCuts(options.bandCutsPath);
  return { budget, k, mode, cuts };
}

/** The band cuts of a JSON file with numeric `high`, `medium` and `low`, in descending order. */
export async function readBandCuts(filePath: string): Promise<{ high: number; medium: number }> {
  const value = JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>;
  if (!isCut(value.high) || !isCut(value.medium) || !isCut(value.low))
    throw new Error(`${filePath} must hold numeric high, medium and low band cuts.`);
  if (!(value.high >= value.medium && value.medium >= value.low))
    throw new Error(`${filePath}: the band cuts must satisfy high >= medium >= low.`);
  return { high: value.high, medium: value.medium };
}

/** The command-line lists of the worksheet grid: one budget, a list of K values and a list of modes. */
export type FunnelGridOptions = {
  budget: string | undefined;
  ks: string | undefined;
  modes: string | undefined;
};

/**
 * The grid of the worksheet: every K of the list with every mode of the list, at one budget, each
 * checked by the same budget rule as a replay. Only the worksheet calls it, so only its runs are
 * exhaustive; the replay parser above never sets that flag. Undefined when a value is missing or invalid.
 */
export function funnelWorksheetGridOf(options: FunnelGridOptions): FunnelParams[] | undefined {
  const budget = integerOf(options.budget);
  const ks = listOf(options.ks, (item) => integerOf(item));
  const modes = listOf(options.modes, (item) => modeOf(item));
  if (budget === undefined || ks === undefined || modes === undefined) return undefined;
  const grid: FunnelParams[] = [];
  for (const k of ks) {
    validateFunnelBudget(budget, k);
    for (const mode of modes) grid.push({ budget, k, mode, exhaustiveSteps: true });
  }
  return grid;
}

/** The items of a comma-separated list, each parsed; undefined when the list is missing or one item is invalid. */
function listOf<T>(value: string | undefined, parse: (item: string) => T | undefined): T[] | undefined {
  if (value === undefined) return undefined;
  const items = value.split(",").map((item) => parse(item.trim()));
  if (items.some((item) => item === undefined)) return undefined;
  return items as T[];
}

function integerOf(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function modeOf(value: string | undefined): RerankSelectionMode | undefined {
  return SELECTION_MODES.find((mode) => mode === value);
}

function isCut(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
