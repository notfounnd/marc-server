import assert from "node:assert/strict";
import test from "node:test";
import {
  computeCaptureFingerprint,
  lexicalFieldsForQueryReplica
} from "../scripts/memory-eval/capture.js";
import {
  CachedEmbeddingProvider,
  CachedRerankingProvider
} from "../scripts/memory-eval/cached-providers.js";
import { rerankPairKey } from "../scripts/memory-eval/recording-providers.js";
import type { MemoryLexicalField } from "../src/core/memory/types.js";
import {
  dataset,
  REPOSITORY_ROOT,
  THREAD_RULES
} from "./memory-eval-capture-fixtures.js";
import { providerMetadata, rerankerMetadata } from "./memory-test-helpers.js";

const DIGEST = "digest-of-the-pinned-corpus";

test("cached providers serve recorded keys and reject missing ones", async () => {
  const vectors = new CachedEmbeddingProvider(
    providerMetadata,
    new Map([["recorded", [1, 0, 0]]])
  );
  assert.deepEqual(await vectors.embedQuery("recorded"), [1, 0, 0]);
  await assert.rejects(
    vectors.embedQuery("missing"),
    /Missing cached query vector for "missing"/
  );

  const scores = new CachedRerankingProvider(
    rerankerMetadata,
    new Map([[rerankPairKey("q", "d"), 0.5]])
  );
  assert.deepEqual(await scores.rerank("q", ["d"], 8), [0.5]);
  await assert.rejects(
    scores.rerank("q", ["d", "other"], 8),
    /Missing cached rerank score for pair/
  );
});

test("captureId ignores judgments and changes when a query changes", async () => {
  const base = await computeCaptureFingerprint(
    dataset,
    REPOSITORY_ROOT,
    DIGEST
  );

  const judged = structuredClone(dataset);
  judged.cases[0].judgments = { [THREAD_RULES]: 1 };
  const reworded = structuredClone(dataset);
  reworded.cases[0].query = "rotacao do token";

  const judgedFingerprint = await computeCaptureFingerprint(
    judged,
    REPOSITORY_ROOT,
    DIGEST
  );
  const rewordedFingerprint = await computeCaptureFingerprint(
    reworded,
    REPOSITORY_ROOT,
    DIGEST
  );
  assert.equal(judgedFingerprint.captureId, base.captureId);
  assert.notEqual(rewordedFingerprint.captureId, base.captureId);
});

const LEXICAL_SCENARIOS: Array<{
  name: string;
  query: string;
  fields: MemoryLexicalField[];
}> = [
  {
    name: "a single term adds titlePrefix",
    query: "brutalism",
    fields: ["title", "summary", "titlePrefix"]
  },
  {
    name: "several terms use title and summary only",
    query: "interface com brutalism",
    fields: ["title", "summary"]
  },
  {
    name: "surrounding spaces do not change the term count",
    query: "  toggle  ",
    fields: ["title", "summary", "titlePrefix"]
  },
  {
    name: "tab-separated terms use title and summary only",
    query: "token\tdaemon",
    fields: ["title", "summary"]
  }
];

for (const scenario of LEXICAL_SCENARIOS) {
  test(`lexical field replica: ${scenario.name}`, () => {
    assert.deepEqual(
      lexicalFieldsForQueryReplica(scenario.query),
      scenario.fields
    );
  });
}
