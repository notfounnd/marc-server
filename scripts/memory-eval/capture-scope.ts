import {
  catalogRowsAt,
  groupsOf,
  type CatalogRow
} from "../../src/core/memory/funnel-groups.js";
import { matrixScope, type ScopeGroup } from "../../src/core/memory/funnel-selection.js";
import type {
  MemorySearchChannels,
  MemorySearchDepth,
  MemoryVectorRow
} from "../../src/core/memory/types.js";
import {
  DOCUMENT_GROUP_PREFIX,
  RULES_GROUP,
  RULES_PATH,
  type EvalCase
} from "./dataset.js";

/**
 * K_max of the T0 study, the largest viable K of the budget B = 232 (grid 8 to 30). It bounds the
 * closed scope of the matrix. It is not the K of any decision: that comes from the folds in T2.
 */
export const E3_K_MAX = 30;

/** Depths whose scope is closed: each one selects its own groups and their passages up to its layers. */
const SCOPE_DEPTHS: readonly MemorySearchDepth[] = [0, 1, 2];

/** Fusion of a known or evidence group that no channel of the depth reaches. It only keeps its passages in scope. */
const OUTSIDE_FUSION = -1;

/** Groups with degree two or more in the case's own judgments, layer 0 and layers 1 and 2. */
export function knownGroupIdsOf(evalCase: EvalCase): Set<string> {
  const grades = [
    evalCase.judgments,
    evalCase.layerJudgments?.[1] ?? {},
    evalCase.layerJudgments?.[2] ?? {}
  ];
  return new Set(
    grades.flatMap((gradesOfLayer) =>
      Object.entries(gradesOfLayer)
        .filter(([, grade]) => grade >= 2)
        .map(([groupId]) => groupId)
    )
  );
}

/** The group that owns a corpus file: its thread, `@rules`, or `@document/<path>`. */
export function groupIdOfSource(sourcePath: string): string {
  if (sourcePath === RULES_PATH) return RULES_GROUP;
  const parts = sourcePath.split("/");
  if (parts[0] === "threads" && parts.length > 2) return parts[1];
  return `${DOCUMENT_GROUP_PREFIX}${sourcePath}`;
}

/** The groups that own the evidence quotes of a case. */
export function evidenceGroupIdsOf(evalCase: EvalCase): Set<string> {
  return new Set((evalCase.evidence ?? []).map((item) => groupIdOfSource(item.sourcePath)));
}

export type ScopeInput = {
  /** Live channels of each captured depth for the effective query. Each depth defines its own groups. */
  channelsByDepth: Partial<Record<MemorySearchDepth, MemorySearchChannels>>;
  /** Every record of the temporary index, with its vector. */
  rows: readonly MemoryVectorRow[];
  knownGroupIds: ReadonlySet<string>;
  evidenceGroupIds: ReadonlySet<string>;
  kMax: number;
};

/**
 * The closed scope of the matrix for one case. Each depth d selects its groups from its own channels
 * (matrixScope, with kMax), and every passage of a chosen group that lies in the layers up to d is in
 * scope. The scopes of the depths are united. Sorted by recordId.
 */
export function scopeRecordIdsOf(input: ScopeInput): string[] {
  const vectors = new Map(input.rows.map((row) => [row.recordId, row.vector]));
  const catalog = catalogOfRows(input.rows);
  const scope = new Set<string>();
  for (const depth of SCOPE_DEPTHS) {
    const channels = input.channelsByDepth[depth];
    if (channels === undefined)
      throw new Error(`The matrix scope needs the channels of depth ${depth}.`);
    for (const recordId of scopeAt(depth, channels, vectors, catalog, input)) scope.add(recordId);
  }
  return [...scope].sort();
}

function scopeAt(
  depth: MemorySearchDepth,
  channels: MemorySearchChannels,
  vectors: ReadonlyMap<string, readonly number[]>,
  catalog: ReadonlyMap<string, readonly CatalogRow[]>,
  input: ScopeInput
): string[] {
  const groups = groupsOf(channels, vectors);
  const channelGroupIds = new Set(groups.map((group) => group.groupId));
  const scopeGroups: ScopeGroup[] = groups.map((group) => ({
    groupId: group.groupId,
    fusion: group.fusion,
    bestPassageRank: group.bestPassageRank,
    identityRecordId: group.identity?.record.recordId,
    passageRecordIds: passageIdsAt(catalog, group.groupId, depth)
  }));
  const outside = [...new Set([...input.knownGroupIds, ...input.evidenceGroupIds])]
    .filter((groupId) => !channelGroupIds.has(groupId))
    .map((groupId) => ({
      groupId,
      fusion: OUTSIDE_FUSION,
      identityRecordId: catalogRowsAt(catalog, groupId, depth).find((row) => row.kind === "identity")?.recordId,
      passageRecordIds: passageIdsAt(catalog, groupId, depth)
    }));
  return [
    ...matrixScope({
      channelRecordIds: recordIdsOfChannels(channels),
      groups: [...scopeGroups, ...outside],
      kMax: input.kMax,
      knownGroupIds: input.knownGroupIds,
      evidenceGroupIds: input.evidenceGroupIds
    })
  ];
}

/** The catalog of a capture: the identity and passage rows of every group, with their layers and vectors. */
export function catalogOfRows(rows: readonly MemoryVectorRow[]): Map<string, CatalogRow[]> {
  const byGroup = new Map<string, CatalogRow[]>();
  for (const row of rows) {
    if (row.kind !== "identity" && row.kind !== "passage") continue;
    const entry: CatalogRow = { recordId: row.recordId, kind: row.kind, layer: row.layer, vector: row.vector };
    byGroup.set(row.threadId, [...(byGroup.get(row.threadId) ?? []), entry]);
  }
  return byGroup;
}

function passageIdsAt(
  catalog: ReadonlyMap<string, readonly CatalogRow[]>,
  groupId: string,
  depth: MemorySearchDepth
): string[] {
  return catalogRowsAt(catalog, groupId, depth)
    .filter((row) => row.kind === "passage")
    .map((row) => row.recordId);
}

function recordIdsOfChannels(channels: MemorySearchChannels): string[] {
  return [
    ...channels.identities.map((hit) => hit.record.recordId),
    ...channels.passages.map((hit) => hit.record.recordId),
    ...channels.lexical.map((hit) => hit.record.recordId)
  ];
}
