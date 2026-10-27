import {
  runFunnel,
  type FunnelCaseInput,
  type FunnelConfig,
  type FunnelRunResult
} from "../../src/core/memory/funnel-run.js";
import type { MemorySearchDepth } from "../../src/core/memory/types.js";

/**
 * The funnel variants of the E3 harness, declared as one table. A `_D<d>` variant searches exactly
 * depth d, so its judged depth is d. ADAPTIVE variants search depths 0, 1 and 2 and are graded at
 * the deepest layer they searched for the case. A variant that scores a pair the matrix does not
 * hold throws MissingRerankScore: the case is then incomplete, and it is never read as a zero.
 */
const SEARCH_DEPTHS: readonly MemorySearchDepth[] = [0, 1, 2];

export const FUNNEL_VARIANT_NAMES = [
  ...SEARCH_DEPTHS.map((depth) => `FUNNEL_D${depth}`),
  "ADAPTIVE",
  "ADAPTIVE_HM",
  ...SEARCH_DEPTHS.map((depth) => `ALL_PASSAGES_D${depth}`),
  ...SEARCH_DEPTHS.map((depth) => `ALL_CANDIDATES_D${depth}`)
] as const;

export type FunnelVariantName = (typeof FUNNEL_VARIANT_NAMES)[number];

export function isFunnelVariantName(id: string): id is FunnelVariantName {
  return (FUNNEL_VARIANT_NAMES as readonly string[]).includes(id);
}

/** The variants whose judged depth is their deepest searched layer, not a fixed depth. */
export const ADAPTIVE_FUNNEL_NAMES: readonly FunnelVariantName[] = ["ADAPTIVE", "ADAPTIVE_HM"];

type VariantRow = {
  description: string;
  depths: readonly MemorySearchDepth[];
  config: Omit<FunnelConfig, "depths">;
};

type VariantConfig = Omit<FunnelConfig, "depths">;

/** One row per search depth, sharing the description and the config of the family. */
function depthRows(
  family: string,
  description: string,
  config: VariantConfig
): Array<[string, VariantRow]> {
  return SEARCH_DEPTHS.map((depth) => [
    `${family}_D${depth}`,
    { description, depths: [depth], config }
  ]);
}

const FUNNEL_CONFIG: VariantConfig = {
  stopOn: "none",
  budgeted: true,
  passages: "budget",
  finalists: "funnel"
};

const ALL_PASSAGES_CONFIG: VariantConfig = {
  stopOn: "none",
  budgeted: false,
  passages: "all",
  finalists: "funnel"
};

/**
 * Every candidate group is a finalist, with the consolidated passages of M0 (at most three by dense
 * rank). Those records are channel records of the depth, so the closed matrix scope holds them.
 */
const ALL_CANDIDATES_CONFIG: VariantConfig = {
  stopOn: "none",
  budgeted: false,
  passages: "consolidated",
  finalists: "all"
};

export const FUNNEL_VARIANTS: Readonly<Record<FunnelVariantName, VariantRow>> = Object.fromEntries([
  ...depthRows(
    "FUNNEL",
    "Funnel at one depth: one step with the whole budget, the funnel finalists and the share of passages.",
    FUNNEL_CONFIG
  ),
  [
    "ADAPTIVE",
    {
      description:
        "Adaptive funnel over depths 0, 1 and 2: stops at a high-band top result; each step takes its share of the budget.",
      depths: SEARCH_DEPTHS,
      config: { stopOn: "high", budgeted: true, passages: "budget", finalists: "funnel" }
    }
  ],
  [
    "ADAPTIVE_HM",
    {
      description:
        "Same as ADAPTIVE, but also stops at a medium-band top result. Reported as a reference only.",
      depths: SEARCH_DEPTHS,
      config: { stopOn: "high-or-medium", budgeted: true, passages: "budget", finalists: "funnel" }
    }
  ],
  ...depthRows(
    "ALL_PASSAGES",
    "The FUNNEL finalists at one depth, with every passage of each finalist, and no budget. It measures the loss of the passage cut.",
    ALL_PASSAGES_CONFIG
  ),
  ...depthRows(
    "ALL_CANDIDATES",
    "Every candidate group at one depth is a finalist, with the consolidated passages of M0 (at most three), and no budget. It is the denominator of the group recall: it needs no score beyond the matrix.",
    ALL_CANDIDATES_CONFIG
  )
]) as Record<FunnelVariantName, VariantRow>;

/** The config that a variant runs with: its depths and its funnel settings. */
export function funnelConfigOf(name: FunnelVariantName): FunnelConfig {
  const row = FUNNEL_VARIANTS[name];
  return { ...row.config, depths: [...row.depths] };
}

/** Runs one funnel variant on a case. Throws MissingRerankScore when the matrix is incomplete. */
export function runFunnelVariant(name: FunnelVariantName, input: FunnelCaseInput): FunnelRunResult {
  return runFunnel(input, funnelConfigOf(name));
}

/**
 * The judged depth of an adaptive run: the deepest layer that the run searched for the case. A run
 * that stopped at layer 0 is graded at layer 0 only, even when a deeper layer holds a higher grade.
 */
export function deepestSearchedDepth(result: FunnelRunResult): MemorySearchDepth {
  return result.layersSearched.reduce<MemorySearchDepth>(
    (deepest, layer) => (layer > deepest ? layer : deepest),
    0
  );
}
