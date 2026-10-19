import assert from "node:assert/strict";
import test from "node:test";
import {
  rankSemanticMemoryCandidates,
  rankSemanticMemoryHits
} from "../src/core/memory/semantic-ranking.js";
import type {
  MemoryRecordKind,
  MemorySearchHit,
  MemoryVectorRecord
} from "../src/core/memory/types.js";
import { FakeRerankingProvider } from "./memory-test-helpers.js";
import { summaryProvenanceFixture } from "./memory-provenance-fixtures.js";

test("semantic ranking reranks passages and consolidates their threads", async () => {
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map(passageScore)
  );
  const hits = [
    hit("target", "identity", 0.91, "Primary interface subject"),
    hit("bridge", "identity", 0.85, "Related component subject"),
    hit("incidental", "identity", 0.78, "Search calibration"),
    hit("target", "passage", 0.89, "Implemented the interface style"),
    hit("bridge", "passage", 0.88, "Related component evidence"),
    hit("incidental", "passage", 0.87, "An example mentioned the interface")
  ];

  const ranked = await rankSemanticMemoryCandidates(
    "interface style",
    hits,
    reranker
  );

  assert.equal(reranker.rerankCalls, 1);
  assert.equal(reranker.rerankedDocuments[0]?.length, 3);
  assert.doesNotMatch(
    reranker.rerankedDocuments[0]?.[0] ?? "",
    /Primary interface subject/
  );
  assert.equal(ranked[0]?.evidence.record.threadId, "target");
  assert.equal(
    ranked[0]?.evidence.record.text,
    "Implemented the interface style"
  );
});

function passageScore(document: string): number {
  if (document.includes("An example mentioned the interface")) return 0.9;
  if (document.includes("Implemented the interface style")) return 0.8;
  return 0.1;
}

test("semantic ranking sends at most three passages per thread", async () => {
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map((document) =>
      document.includes("third passage") ? 0.8 : 0.2
    )
  );
  const hits = [
    hit("target", "identity", 0.95, "target identity"),
    hit("target", "passage", 0.94, "first passage"),
    hit("target", "passage", 0.93, "second passage"),
    hit("target", "passage", 0.92, "third passage"),
    hit("target", "passage", 0.91, "fourth passage"),
    hit("other", "identity", 0.9, "other identity"),
    hit("other", "passage", 0.89, "other passage")
  ];

  const ranked = await rankSemanticMemoryCandidates("target", hits, reranker);

  assert.equal(reranker.rerankedDocuments[0]?.length, 4);
  assert.ok(
    reranker.rerankedDocuments[0]?.every(
      (document) => !document.includes("fourth passage")
    )
  );
  assert.equal(ranked[0]?.evidence.record.text, "third passage");
});

test("semantic eligibility abstains when consolidated evidence is weak", async () => {
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map(() => 0.01)
  );
  const hits = [
    hit("incidental", "identity", 0.82, "Unrelated project note"),
    hit("incidental", "passage", 0.8, "Unrelated operational details")
  ];

  const ranked = await rankSemanticMemoryHits(
    "international invoice tax reconciliation",
    hits,
    reranker
  );

  assert.deepEqual(ranked, []);
});

test("semantic eligibility recognizes retriever and reranker agreement", async () => {
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map((document) => {
      if (document.includes("calibration evidence")) return 0.22;
      if (document.includes("target evidence")) return 0.18;
      return 0.01;
    })
  );
  const hits = [
    hit("target", "identity", 0.8, "target identity"),
    hit("calibration", "identity", 0.79, "calibration identity"),
    hit("calibration", "passage", 0.78, "calibration evidence"),
    hit("distractor-a", "passage", 0.77, "distractor a"),
    hit("distractor-b", "passage", 0.76, "distractor b"),
    hit("target", "passage", 0.75, "target evidence")
  ];

  const candidates = await rankSemanticMemoryCandidates(
    "target query",
    hits,
    reranker
  );
  const target = candidates.find(
    (thread) => thread.evidence.record.threadId === "target"
  );

  assert.ok((target?.semanticEligibility ?? 0) >= 0.5);
});

test("semantic eligibility does not use ranking margin without model agreement", async () => {
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map((document) =>
      document.includes("incidental evidence") ? 0.1 : 0.01
    )
  );
  const identities = Array.from({ length: 15 }, (_unused, index) =>
    hit(
      `distractor-${index}`,
      "identity",
      0.95 - index * 0.01,
      `distractor ${index}`
    )
  );
  const hits = [
    ...identities,
    hit("incidental", "identity", 0.79, "incidental identity"),
    hit("incidental", "passage", 0.78, "incidental evidence")
  ];

  const ranked = await rankSemanticMemoryHits(
    "unrelated query",
    hits,
    reranker
  );

  assert.ok(
    ranked.every((thread) => thread.evidence.record.threadId !== "incidental")
  );
});

test("only the leading result uses ranking margin as confidence", async () => {
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map((document) => {
      if (document.includes("third title")) return 0.03;
      if (document.includes("first title")) return 0.02;
      return 0.01;
    })
  );
  const hits = [
    hit("first", "identity", 0.84, "first identity"),
    hit("second", "identity", 0.83, "second identity"),
    hit("third", "identity", 0.82, "third identity"),
    hit("fourth", "identity", 0.81, "fourth identity"),
    hit("second", "passage", 0.8, "second passage"),
    hit("third", "passage", 0.79, "third passage"),
    hit("fourth", "passage", 0.78, "fourth passage"),
    hit("first", "passage", 0.77, "first passage")
  ];

  const ranked = await rankSemanticMemoryCandidates(
    "unrelated query",
    hits,
    reranker
  );

  assert.ok((ranked[0]?.signals.rankingMargin ?? 0) >= 0);
  assert.ok(
    ranked.slice(1).every((thread) => thread.signals.rankingMargin === 0)
  );
  assert.ok(
    ranked.every(
      (thread, index) =>
        index === 0 || thread.eligibility <= ranked[index - 1]!.eligibility
    )
  );
});

function hit(
  threadId: string,
  kind: MemoryRecordKind,
  score: number,
  text: string
): MemorySearchHit {
  return {
    record: record(threadId, kind, text),
    score
  };
}

function record(
  threadId: string,
  kind: MemoryRecordKind,
  text: string
): MemoryVectorRecord {
  return {
    recordId: `${threadId}:${kind}`,
    threadId,
    title: `${threadId} title`,
    summaryPath: `/tmp/${threadId}/SUMMARY.md`,
    relativeSummaryPath: `threads/${threadId}/SUMMARY.md`,
    reference: `marc://$${threadId}`,
    kind,
    sectionTitle: kind === "passage" ? "Result" : undefined,
    text,
    embeddingText: text,
    ...summaryProvenanceFixture(threadId, text)
  };
}
