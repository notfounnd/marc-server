import assert from "node:assert/strict";
import test from "node:test";
import {
  rankHybridMemoryHits,
  semanticRecallHits
} from "../src/core/memory/hybrid-ranking.js";
import type {
  MemoryLexicalSearchHit,
  MemoryRecordKind,
  MemorySearchChannels,
  MemorySearchHit,
  MemoryVectorRecord
} from "../src/core/memory/types.js";
import { FakeRerankingProvider } from "./memory-test-helpers.js";

test("hybrid ranking never admits a lexical-only weak candidate", async () => {
  const reranker = new FakeRerankingProvider(() => [0.01]);
  const channels: MemorySearchChannels = {
    identities: [],
    passages: [],
    lexical: [lexicalHit("incidental", "title", 8, 0.1)]
  };

  const ranked = await rankHybridMemoryHits("brutalism", channels, reranker);

  assert.deepEqual(ranked, []);
});

test("hybrid ranking uses title evidence only after semantic eligibility", async () => {
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map((document) => (document.includes("target") ? 0.8 : 0.82))
  );
  const channels: MemorySearchChannels = {
    identities: [
      vectorHit("incidental", "identity", 0.9),
      vectorHit("target", "identity", 0.89)
    ],
    passages: [
      vectorHit("incidental", "passage", 0.89),
      vectorHit("target", "passage", 0.88)
    ],
    lexical: [lexicalHit("target", "title", 9, 0.89)]
  };

  const ranked = await rankHybridMemoryHits("brutalism", channels, reranker);
  const results = semanticRecallHits(ranked);

  assert.equal(results[0]?.threadId, "target");
  assert.ok(results.every((result) => result.score >= 0.5));
  assert.ok(
    results.every(
      (result, index) =>
        index === 0 || result.score <= results[index - 1]!.score
    )
  );
});

function vectorHit(
  threadId: string,
  kind: MemoryRecordKind,
  score: number
): MemorySearchHit {
  return { record: record(threadId, kind), score };
}

function lexicalHit(
  threadId: string,
  field: MemoryLexicalSearchHit["field"],
  score: number,
  vectorScore: number
): MemoryLexicalSearchHit {
  return {
    field,
    record: record(threadId, "identity"),
    score,
    vectorScore
  };
}

function record(threadId: string, kind: MemoryRecordKind): MemoryVectorRecord {
  return {
    recordId: `${threadId}:${kind}`,
    threadId,
    title: `${threadId} title`,
    summaryPath: `/tmp/${threadId}/SUMMARY.md`,
    relativeSummaryPath: `threads/${threadId}/SUMMARY.md`,
    reference: `marc://$${threadId}`,
    kind,
    sectionTitle: kind === "passage" ? "Result" : undefined,
    text: `${threadId} ${kind}`,
    embeddingText: `${threadId} ${kind}`
  };
}
