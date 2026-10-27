import { cosineSimilarity } from "./vector-math.js";

/**
 * Selection rules of the E3 funnel: the finalists by fusion and by passage rank, the passages
 * of each finalist, the reranker rank by group, and the closed scope of the captured matrix.
 * Pure: no model runs and no file is read.
 */

const NO_PASSAGE_RANK = Number.MAX_SAFE_INTEGER;

function compareText(left: string, right: string): number {
  return left < right ? -1 : Number(left > right);
}

export type FunnelGroup = {
  groupId: string;
  /** fusionWithoutRerankerScore of the group. */
  fusion: number;
  /** Best dense rank among the group's passages; undefined when the group has none. */
  bestPassageRank?: number;
};

/**
 * The first ceil(K/2) groups by fusion, in descending order and then by groupId. The remaining
 * slots go to the groups that were not chosen, by their best passage rank (ascending), then by
 * fusion and groupId. Groups without a passage come last in that dense part.
 */
export function selectFinalists(
  groups: readonly FunnelGroup[],
  k: number
): string[] {
  const byFusion = [...groups].sort(
    (left, right) =>
      right.fusion - left.fusion || compareText(left.groupId, right.groupId)
  );
  const chosen = byFusion.slice(0, Math.ceil(k / 2));
  const rest = byFusion
    .slice(chosen.length)
    .sort(
      (left, right) =>
        passageRankOf(left) - passageRankOf(right) ||
        right.fusion - left.fusion ||
        compareText(left.groupId, right.groupId)
    );
  const picked = rest.slice(0, Math.max(0, k - chosen.length));
  return [...chosen, ...picked].map((group) => group.groupId);
}

function passageRankOf(group: FunnelGroup): number {
  return group.bestPassageRank ?? NO_PASSAGE_RANK;
}

/** One record of a group, with its vector. The identity row exists only in layer zero. */
export type FunnelRow = {
  recordId: string;
  kind: "identity" | "passage";
  vector: readonly number[];
};

/** `cosine` takes the best passages by similarity; `cosine-fts` interleaves them with FTS matches. */
export type RerankSelectionMode = "cosine" | "cosine-fts";

/**
 * The passages of one finalist that go to the reranker, at most `limit`. The identity enters
 * only when the group has no passage in the rows, and then it takes one slot.
 */
export function selectRerankPassages(
  queryVector: readonly number[],
  rows: readonly FunnelRow[],
  limit: number,
  mode: RerankSelectionMode = "cosine",
  ftsRecordIds: ReadonlySet<string> = new Set()
): string[] {
  const passages = rows.filter((row) => row.kind === "passage");
  const pool = passages.length > 0 ? passages : rows;
  const query = [...queryVector];
  const byCosine = pool
    .map((row) => ({
      recordId: row.recordId,
      similarity: cosineSimilarity(query, row.vector)
    }))
    .sort(
      (left, right) =>
        right.similarity - left.similarity ||
        compareText(left.recordId, right.recordId)
    )
    .map((item) => item.recordId);
  if (mode === "cosine") return byCosine.slice(0, limit);
  const matched = byCosine.filter((recordId) => ftsRecordIds.has(recordId));
  return interleaveUnique(byCosine, matched, limit);
}

/**
 * Takes items alternately from two lists, starting with the first, without repeating one. When
 * one list runs out, the other keeps going, up to `limit`.
 */
export function interleaveUnique(
  primary: readonly string[],
  secondary: readonly string[],
  limit: number
): string[] {
  const lists = [primary, secondary];
  const pointers = [0, 0];
  const taken = new Set<string>();
  const out: string[] = [];
  let turn = 0;
  let exhausted = 0;
  while (out.length < limit && exhausted < lists.length) {
    const next = nextUnseen(lists[turn] ?? [], pointers[turn] ?? 0, taken);
    pointers[turn] = next.pointer;
    turn = (turn + 1) % lists.length;
    if (next.recordId === undefined) {
      exhausted += 1;
      continue;
    }
    exhausted = 0;
    taken.add(next.recordId);
    out.push(next.recordId);
  }
  return out;
}

function nextUnseen(
  list: readonly string[],
  from: number,
  taken: ReadonlySet<string>
): { recordId: string | undefined; pointer: number } {
  let index = from;
  while (index < list.length && taken.has(list[index] ?? "")) index += 1;
  return {
    recordId: index < list.length ? list[index] : undefined,
    pointer: index + 1
  };
}

/**
 * The identity rank used by the funnel fusion. A group with no identity uses the rank of its
 * best passage instead: the pre-declared recuo of the funnel (E3 plan, section 4).
 */
export function effectiveIdentityRank(
  identityRank: number | undefined,
  bestPassageRank: number | undefined
): number | undefined {
  return identityRank ?? bestPassageRank;
}

/**
 * Whether the selected passages hold the evidence. The check uses the passageId of each
 * passage: another passage of the same section does not count.
 */
export function evidenceSurvived(
  selectedPassageIds: readonly string[],
  evidencePassageIds: readonly string[]
): boolean {
  return selectedPassageIds.some((passageId) =>
    evidencePassageIds.includes(passageId)
  );
}

export type ScopeGroup = {
  groupId: string;
  fusion: number;
  bestPassageRank?: number;
  identityRecordId?: string;
  passageRecordIds: readonly string[];
};

export type MatrixScopeInput = {
  /** Every record of every channel of every depth. */
  channelRecordIds: readonly string[];
  /** Candidate groups of every depth. */
  groups: readonly ScopeGroup[];
  kMax: number;
  /** Groups with degree of two or more, known from the previous evaluation. */
  knownGroupIds: ReadonlySet<string>;
  /** Groups that own the source of a case's evidence. */
  evidenceGroupIds: ReadonlySet<string>;
};

/**
 * The closed scope of the captured matrix: every channel record, the identity of every group,
 * all passages of the first kMax groups by fusion and by passage rank, and all passages of the
 * known and evidence groups. Every finalist of any K <= kMax falls inside it.
 */
export function matrixScope(input: MatrixScopeInput): Set<string> {
  const scope = new Set<string>(input.channelRecordIds);
  for (const group of input.groups) {
    if (group.identityRecordId !== undefined) scope.add(group.identityRecordId);
  }
  const selected = new Set<string>([
    ...topGroupIds(input.groups, input.kMax, byFusionOrder),
    ...topGroupIds(input.groups, input.kMax, byPassageOrder),
    ...input.knownGroupIds,
    ...input.evidenceGroupIds
  ]);
  for (const group of input.groups) {
    if (!selected.has(group.groupId)) continue;
    for (const recordId of group.passageRecordIds) scope.add(recordId);
  }
  return scope;
}

function topGroupIds(
  groups: readonly ScopeGroup[],
  limit: number,
  order: (left: ScopeGroup, right: ScopeGroup) => number
): string[] {
  return [...groups]
    .sort(order)
    .slice(0, limit)
    .map((group) => group.groupId);
}

function byFusionOrder(left: ScopeGroup, right: ScopeGroup): number {
  return right.fusion - left.fusion || compareText(left.groupId, right.groupId);
}

function byPassageOrder(left: ScopeGroup, right: ScopeGroup): number {
  return (
    passageRankOf(left) - passageRankOf(right) || byFusionOrder(left, right)
  );
}
