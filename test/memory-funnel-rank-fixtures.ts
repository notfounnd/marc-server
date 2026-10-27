import type {
  FunnelCaseInput,
  FunnelRunResult
} from "../src/core/memory/funnel-run.js";
import {
  SEMANTIC_ELIGIBILITY_THRESHOLD,
  semanticRerankingDocument,
  type RankedMemoryThread
} from "../src/core/memory/semantic-ranking.js";
import type {
  MemoryLexicalSearchHit,
  MemorySearchChannels,
  MemorySearchHit,
  RerankingProvider
} from "../src/core/memory/types.js";
import { runFunnelVariant } from "../scripts/memory-eval/funnel-variants.js";
import { record } from "./memory-layers-fixtures.js";

export type RankPassage = { id: string; score: number; rerank: number };
export type RankGroup = {
  id: string;
  identity: number;
  identityRerank: number;
  passages: RankPassage[];
};

export const RANK_FIXTURE_BUDGET = 232;

/**
 * The channels, the reranker and the funnel input of a case built from declared data. Each passage has its own
 * text, so its reranker document, and so its score, is its own. `titleIds` declares the passages that have a
 * lexical title hit. A group without passages is an identity-only group. Every record is built with its group,
 * so no lookup or branch decides which record a hit or a score belongs to.
 */
export function rankFixtureOf(
  groups: readonly RankGroup[],
  titleIds: readonly string[]
): {
  channels: MemorySearchChannels;
  reranker: RerankingProvider;
  input: FunnelCaseInput;
} {
  const built = groups.map((group) => ({
    group,
    identityRecord: record(group.id, "identity", {
      recordId: `${group.id}-identity`,
      layer: 0
    }),
    passages: group.passages.map((passage) => ({
      passage,
      record: record(group.id, "passage", {
        recordId: passage.id,
        layer: 0,
        text: `${passage.id} text`
      })
    }))
  }));
  const identities: MemorySearchHit[] = built.map((item) => ({
    record: item.identityRecord,
    score: item.group.identity
  }));
  const passages: MemorySearchHit[] = built.flatMap((item) =>
    item.passages.map((entry) => ({
      record: entry.record,
      score: entry.passage.score
    }))
  );
  const lexical: MemoryLexicalSearchHit[] = passages
    .filter((hit) => titleIds.includes(hit.record.recordId))
    .map((hit) => ({
      field: "title",
      record: hit.record,
      score: 1,
      vectorScore: hit.score
    }));
  const channels: MemorySearchChannels = { identities, passages, lexical };
  const rerankEntries = [
    ...built.map((item) => ({
      record: item.identityRecord,
      score: item.group.identityRerank
    })),
    ...built.flatMap((item) =>
      item.passages.map((entry) => ({
        record: entry.record,
        score: entry.passage.rerank
      }))
    )
  ];
  const documentScores = new Map(
    rerankEntries.map(
      (entry) => [semanticRerankingDocument(entry.record), entry.score] as const
    )
  );
  const reranker = {
    rerank: async (_query: string, documents: string[]) =>
      documents.map((document) => documentScores.get(document) ?? 0)
  } as unknown as RerankingProvider;
  const scores = new Map(
    rerankEntries.map((entry) => [entry.record.recordId, entry.score] as const)
  );
  const vectors = new Map(
    rerankEntries.map((entry) => [entry.record.recordId, [1, 0]] as const)
  );
  const input: FunnelCaseInput = {
    queryVector: [1, 0],
    channelsByDepth: { 0: channels },
    vectors,
    catalog: new Map(),
    scores,
    ftsRecordIds: new Set(),
    budget: RANK_FIXTURE_BUDGET,
    k: groups.length,
    mode: "cosine"
  };
  return { channels, reranker, input };
}

/** What M0 admits, in its order: the threads whose eligibility reaches the threshold. */
export function admittedOfM0(
  threads: RankedMemoryThread[]
): Array<[string, number]> {
  return threads
    .filter((thread) => thread.eligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD)
    .map((thread) => [thread.evidence.record.threadId, thread.eligibility]);
}

/** What the funnel admits with every candidate group, in its order. */
export function admittedOfAllCandidates(
  input: FunnelCaseInput
): Array<[string, number]> {
  return admittedOfRun(runFunnelVariant("ALL_CANDIDATES_D0", input));
}

function admittedOfRun(run: FunnelRunResult): Array<[string, number]> {
  return run.admitted.map((item) => [item.groupId, item.eligibility]);
}
