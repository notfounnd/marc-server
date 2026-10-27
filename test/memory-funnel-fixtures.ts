import type {
  MemorySearchChannels,
  MemorySearchHit,
  MemoryVectorRecord
} from "../src/core/memory/types.js";
import type { FunnelCaseInput } from "../src/core/memory/funnel-run.js";
import type { CatalogRow } from "../src/core/memory/funnel-groups.js";
import { record } from "./memory-layers-fixtures.js";

const SOURCE_BY_LAYER = {
  0: "summary",
  1: "artifact",
  2: "chat"
} as const;

const MESSAGE_BY_LAYER: Record<0 | 1 | 2, string | undefined> = {
  0: undefined,
  1: undefined,
  2: "m1"
};

/**
 * A three-layer case. Thread t1 has its identity and a summary passage in layer 0, an
 * artifact passage in layer 1 and a chat passage in layer 2. Thread t2 has a chat passage
 * only, in layer 2. Every record has a vector and a reranker score; the query is [1, 0].
 */
export const QUERY_VECTOR = [1, 0];

export const IDENTITY_T1 = memberOf("t1", "identity", 0, "t1-identity");
export const SUMMARY_T1 = memberOf("t1", "passage", 0, "t1-summary");
export const ARTIFACT_T1 = memberOf("t1", "passage", 1, "t1-artifact");
export const CHAT_T1 = memberOf("t1", "passage", 2, "t1-chat");
export const CHAT_T2 = memberOf("t2", "passage", 2, "t2-chat");

/** Layer-zero channels, then layer one, then layer two: the channels of each depth. */
export function channelsAt(depth: 0 | 1 | 2): MemorySearchChannels {
  const members = [
    IDENTITY_T1,
    SUMMARY_T1,
    ARTIFACT_T1,
    CHAT_T1,
    CHAT_T2
  ].filter((member) => member.layer <= depth);
  return {
    identities: members
      .filter((member) => member.record.kind === "identity")
      .map(hitOf),
    passages: members
      .filter((member) => member.record.kind === "passage")
      .map(hitOf),
    lexical: []
  };
}

/** A complete case input with the given budget and K, and the vectors and scores of the members. */
export function caseInput(
  overrides: Partial<FunnelCaseInput> = {}
): FunnelCaseInput {
  return {
    queryVector: QUERY_VECTOR,
    channelsByDepth: { 0: channelsAt(0), 1: channelsAt(1), 2: channelsAt(2) },
    vectors: new Map(
      ALL_MEMBERS.map((member) => [member.record.recordId, member.vector])
    ),
    catalog: catalogOfMembers(),
    scores: new Map(
      ALL_MEMBERS.map((member) => [member.record.recordId, member.score])
    ),
    ftsRecordIds: new Set<string>(),
    budget: 12,
    k: 2,
    mode: "cosine",
    cuts: { high: 0.9, medium: 0.5 },
    ...overrides
  };
}

type Member = {
  record: MemoryVectorRecord;
  layer: 0 | 1 | 2;
  vector: number[];
  score: number;
};

const ALL_MEMBERS: Member[] = [
  IDENTITY_T1,
  SUMMARY_T1,
  ARTIFACT_T1,
  CHAT_T1,
  CHAT_T2
];

function memberOf(
  threadId: string,
  kind: "identity" | "passage",
  layer: 0 | 1 | 2,
  recordId: string
): Member {
  return {
    record: record(threadId, kind, {
      recordId,
      layer,
      sourceType: SOURCE_BY_LAYER[layer],
      messageId: MESSAGE_BY_LAYER[layer]
    }),
    layer,
    vector: [0.95, 0.05],
    score: 0.9
  };
}

function hitOf(member: Member): MemorySearchHit {
  return { record: member.record, score: 0.9 };
}

/** The catalog of the members: every identity and passage of each thread, with its layer and vector. */
export function catalogOfMembers(
  members: readonly Member[] = ALL_MEMBERS
): Map<string, CatalogRow[]> {
  const byGroup = new Map<string, CatalogRow[]>();
  for (const member of members) {
    const kind = member.record.kind === "identity" ? "identity" : "passage";
    const row: CatalogRow = {
      recordId: member.record.recordId,
      kind,
      layer: member.layer,
      vector: member.vector
    };
    byGroup.set(member.record.threadId, [
      ...(byGroup.get(member.record.threadId) ?? []),
      row
    ]);
  }
  return byGroup;
}
