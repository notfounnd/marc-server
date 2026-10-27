import {
  hybridAdmissionOrder,
  hybridScore,
  type LexicalRanks
} from "./hybrid-ranking.js";
import type { DepthGroup } from "./funnel-groups.js";
import { evidenceOf } from "./funnel-groups.js";
import {
  consolidateThreads,
  numericRanks,
  rankThreadCandidates,
  SEMANTIC_ELIGIBILITY_THRESHOLD,
  type RankedEvidence,
  type ThreadCandidate
} from "./semantic-ranking.js";
import type { MemoryBand } from "./types.js";

/** A pair that the funnel needs but the matrix does not hold. The case is incomplete. */
export class MissingRerankScore extends Error {
  constructor(readonly recordId: string) {
    super(`Missing rerank score for record ${recordId}.`);
    this.name = "MissingRerankScore";
  }
}

export type FunnelAdmitted = {
  groupId: string;
  rankingScore: number;
  hybridScore: number;
  eligibility: number;
  /** Set only when the run has band cuts. */
  band?: MemoryBand;
  /** Passages of the group that were scored or reused, in request order. */
  chosenPassages: string[];
};

type UsableGroup = { groupId: string; recordIds: readonly string[] };

/** One scored passage of the step, in the order the step lists them: the order M0 enumerates its evidence. */
type StepEntry = {
  groupId: string;
  recordId: string;
  score: number;
  denseRank: number;
};

/** The best entry of a group: its global rank among the entries of the step, with its score and dense rank. */
type BestEntry = {
  recordId: string;
  rank: number;
  score: number;
  denseRank: number;
};

/** The dense rank of a passage that the channels do not hold. It sorts after every channel passage. */
const NO_CHANNEL_RANK = Number.MAX_SAFE_INTEGER;

/**
 * Scores the usable pairs of the kept finalists and ranks them with the M0 rerank: the rank of a group is the
 * global position of its best passage among every passage scored in the step. It applies the production
 * eligibility and orders the admitted groups by the production hybrid.
 */
export function admittedOf(
  usableByGroup: readonly UsableGroup[],
  byId: ReadonlyMap<string, DepthGroup>,
  scores: ReadonlyMap<string, number>,
  lexicalRanks: LexicalRanks,
  cuts?: { high: number; medium: number }
): FunnelAdmitted[] {
  const best = bestEntriesOf(stepEntriesOf(usableByGroup, byId, scores));
  const candidates = usableByGroup.flatMap(({ groupId }) =>
    candidateFor(byId.get(groupId), best.get(groupId))
  );
  const chosenOf = new Map(
    usableByGroup.map(({ groupId, recordIds }) => [groupId, recordIds] as const)
  );
  return admittedOfCandidates(candidates, lexicalRanks, cuts).map((item) => ({
    ...item,
    chosenPassages: [...(chosenOf.get(item.groupId) ?? [])]
  }));
}

/**
 * The admitted groups of a set of thread candidates, with the M0 admission: the signals and the semantic
 * eligibility come from rankThreadCandidates, and the hybrid order with the monotone ceiling comes from
 * hybridAdmissionOrder, which M0 also uses. The candidates carry the reranker rank, so the caller decides it.
 */
export function admittedOfCandidates(
  candidates: ThreadCandidate[],
  lexicalRanks: LexicalRanks,
  cuts?: { high: number; medium: number }
): FunnelAdmitted[] {
  return hybridAdmissionOrder(rankThreadCandidates(candidates), lexicalRanks)
    .filter((thread) => thread.eligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD)
    .map((thread) => ({
      groupId: thread.evidence.record.threadId,
      rankingScore: thread.rankingScore,
      hybridScore: hybridScore(thread, lexicalRanks),
      eligibility: thread.eligibility,
      band: bandWithCuts(thread.eligibility, cuts),
      chosenPassages: []
    }));
}

function candidateFor(
  group: DepthGroup | undefined,
  best: BestEntry | undefined
): ThreadCandidate[] {
  if (group === undefined || best === undefined) return [];
  return [candidateOf(group, best)];
}

/**
 * The thread candidate of a finalist. Its passages are the channel passages of M0, so the dense signals do not
 * depend on how many passages the funnel selects. The reranker evidence, rank and score are those of its best entry.
 */
function candidateOf(group: DepthGroup, best: BestEntry): ThreadCandidate {
  return {
    identity: group.identity,
    passages: channelPassagesOf(group),
    rerankerEvidence: evidenceOf(group, best.recordId),
    rerankerRank: best.rank,
    rerankerScore: best.score
  };
}

/** The passages that M0 keeps for a group's channels: the consolidation of semantic-ranking.ts. */
function channelPassagesOf(group: DepthGroup): RankedEvidence[] {
  return consolidateThreads(group.passages)[0]?.passages ?? [];
}

function stepEntriesOf(
  usableByGroup: readonly UsableGroup[],
  byId: ReadonlyMap<string, DepthGroup>,
  scores: ReadonlyMap<string, number>
): StepEntry[] {
  return usableByGroup.flatMap(({ groupId, recordIds }) =>
    recordIds.map((recordId) => ({
      groupId,
      recordId,
      score: scoreOf(scores, recordId),
      denseRank: denseRankOf(byId.get(groupId), recordId)
    }))
  );
}

function denseRankOf(group: DepthGroup | undefined, recordId: string): number {
  if (group === undefined) return NO_CHANNEL_RANK;
  return evidenceOf(group, recordId)?.denseRank ?? NO_CHANNEL_RANK;
}

/**
 * The M0 rerank of the step (semantic-ranking.ts): the global rank of each entry, by score (numericRanks, where a
 * tie keeps the order of the entries), and the best entry of each group, by score and then dense rank
 * (applyBestPassage). A full tie keeps the first entry of the step.
 */
function bestEntriesOf(entries: readonly StepEntry[]): Map<string, BestEntry> {
  const ranks = numericRanks(entries.map((entry) => entry.score));
  const best = new Map<string, BestEntry>();
  entries.forEach((entry, index) => {
    const current = best.get(entry.groupId);
    if (current !== undefined && !isBetterEntry(entry, current)) return;
    best.set(entry.groupId, {
      recordId: entry.recordId,
      rank: ranks[index] ?? entries.length,
      score: entry.score,
      denseRank: entry.denseRank
    });
  });
  return best;
}

/** M0's order of the entries of a candidate: higher score first, then lower dense rank. */
function isBetterEntry(
  entry: { score: number; denseRank: number },
  current: { score: number; denseRank: number }
): boolean {
  if (entry.score !== current.score) return entry.score > current.score;
  return entry.denseRank < current.denseRank;
}

function scoreOf(
  scores: ReadonlyMap<string, number>,
  recordId: string
): number {
  const score = scores.get(recordId);
  if (score === undefined) throw new MissingRerankScore(recordId);
  return score;
}

/** The band of an eligibility under explicit cuts: high, medium or low. Without cuts there is no band. */
export function bandWithCuts(
  eligibility: number,
  cuts?: { high: number; medium: number }
): MemoryBand | undefined {
  if (cuts === undefined) return undefined;
  if (eligibility >= cuts.high) return "high";
  if (eligibility >= cuts.medium) return "medium";
  return "low";
}
