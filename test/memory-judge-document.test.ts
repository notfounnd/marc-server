import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { asSearchRecord } from "../scripts/memory-eval/capture-types.js";
import {
  JUDGE_DOCUMENT_TOKENS,
  judgeCacheKey,
  judgeDocumentOf,
  judgeDocumentSha256,
  type TokenTruncator
} from "../src/core/memory/scoring/judge-document.js";
import type { MemoryVectorRecord } from "../src/core/memory/types.js";
import { captureFixture } from "./memory-eval-capture-fixtures.js";

const keepText: TokenTruncator = (text) => text;

async function seedOf(t: TestContext): Promise<MemoryVectorRecord> {
  const capture = await captureFixture(t);
  const first = capture.records[0];
  assert.ok(first !== undefined, "the fixture capture has records");
  return asSearchRecord(first);
}

/** A record with the seed's fields and its own id and text. */
function recordOf(
  seed: MemoryVectorRecord,
  recordId: string,
  text: string
): MemoryVectorRecord {
  return { ...seed, recordId, text };
}

test("the document is the identity text, a blank line and the best passage", async (t: TestContext) => {
  const seed = await seedOf(t);
  const identity = recordOf(seed, "identity-a", "Identity A");
  const passages = [
    recordOf(seed, "p-1", "first passage"),
    recordOf(seed, "p-2", "second passage")
  ];
  const scores = new Map<string, number>([
    ["p-1", 0.2],
    ["p-2", 0.9]
  ]);
  assert.equal(
    judgeDocumentOf({
      identity,
      passages,
      rerankScores: scores,
      truncate: keepText
    }),
    "Identity A\n\nsecond passage"
  );
});

test("the document of a thread does not change with the scores of other candidates", async (t: TestContext) => {
  const seed = await seedOf(t);
  const identity = recordOf(seed, "identity-a", "Identity A");
  const passages = [
    recordOf(seed, "p-1", "first passage"),
    recordOf(seed, "p-2", "second passage")
  ];
  const own = new Map<string, number>([
    ["p-1", 0.2],
    ["p-2", 0.9]
  ]);
  const withOthers = new Map<string, number>([
    ...own,
    ["other-1", 1],
    ["other-2", 0.99]
  ]);
  const alone = judgeDocumentOf({
    identity,
    passages,
    rerankScores: own,
    truncate: keepText
  });
  const amongOthers = judgeDocumentOf({
    identity,
    passages: [passages[1], passages[0]],
    rerankScores: withOthers,
    truncate: keepText
  });
  assert.equal(amongOthers, alone);
});

test("a tie between passages goes to the smallest recordId, in any order", async (t: TestContext) => {
  const seed = await seedOf(t);
  const identity = recordOf(seed, "identity-a", "Identity A");
  const bravo = recordOf(seed, "p-b", "bravo passage");
  const alpha = recordOf(seed, "p-a", "alpha passage");
  const tied = new Map<string, number>([
    ["p-a", 0.5],
    ["p-b", 0.5]
  ]);
  const forward = judgeDocumentOf({
    identity,
    passages: [bravo, alpha],
    rerankScores: tied,
    truncate: keepText
  });
  const backward = judgeDocumentOf({
    identity,
    passages: [alpha, bravo],
    rerankScores: tied,
    truncate: keepText
  });
  assert.equal(forward, "Identity A\n\nalpha passage");
  assert.equal(backward, forward);
});

test("a thread without a selected passage is judged on its identity text", async (t: TestContext) => {
  const seed = await seedOf(t);
  const identity = recordOf(seed, "identity-a", "Identity A");
  assert.equal(
    judgeDocumentOf({
      identity,
      passages: [],
      rerankScores: new Map(),
      truncate: keepText
    }),
    "Identity A"
  );
});

test("a passage without a rerank score stops the document", async (t: TestContext) => {
  const seed = await seedOf(t);
  const identity = recordOf(seed, "identity-a", "Identity A");
  const passage = recordOf(seed, "p-1", "first passage");
  assert.throws(
    () =>
      judgeDocumentOf({
        identity,
        passages: [passage],
        rerankScores: new Map(),
        truncate: keepText
      }),
    /Missing rerank score for record p-1/
  );
});

test("the judged text goes once to the truncator, with the token budget", async (t: TestContext) => {
  const seed = await seedOf(t);
  const identity = recordOf(seed, "identity-a", "Identity A");
  const passage = recordOf(seed, "p-1", "first passage");
  const calls: Array<[string, number]> = [];
  const recording: TokenTruncator = (text, maxTokens) => {
    calls.push([text, maxTokens]);
    return text;
  };
  judgeDocumentOf({
    identity,
    passages: [passage],
    rerankScores: new Map([["p-1", 0.5]]),
    truncate: recording
  });
  assert.equal(JUDGE_DOCUMENT_TOKENS, 512);
  assert.deepEqual(calls, [
    ["Identity A\n\nfirst passage", JUDGE_DOCUMENT_TOKENS]
  ]);
});

test("a long document keeps its leading tokens, cut at the budget", async (t: TestContext) => {
  const seed = await seedOf(t);
  const longText = Array.from({ length: 600 }, (_, index) => `w${index}`).join(
    " "
  );
  const identity = recordOf(seed, "identity-a", longText);
  const firstWords: TokenTruncator = (text, maxTokens) =>
    text.split(" ").slice(0, maxTokens).join(" ");
  const document = judgeDocumentOf({
    identity,
    passages: [],
    rerankScores: new Map(),
    truncate: firstWords
  });
  const words = document.split(" ");
  assert.equal(words.length, JUDGE_DOCUMENT_TOKENS);
  assert.equal(
    words[JUDGE_DOCUMENT_TOKENS - 1],
    `w${JUDGE_DOCUMENT_TOKENS - 1}`
  );
});

test("the document hash is hex SHA-256 and changes with the text", () => {
  const hash = judgeDocumentSha256("Identity A");
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(judgeDocumentSha256("Identity A"), hash);
  assert.notEqual(judgeDocumentSha256("Identity B"), hash);
});

test("the cache key separates the model, the effective query, the thread and the document", () => {
  const base = {
    model: "onnx-community/Qwen3-Reranker-0.6B-ONNX",
    effectiveQuery: "settings",
    threadId: "thread-1",
    documentSha256: judgeDocumentSha256("Identity A")
  };
  const key = judgeCacheKey(base);
  assert.equal(judgeCacheKey({ ...base }), key);
  const changes = [
    { model: "onnx-community/kev-0.6b-ONNX" },
    { effectiveQuery: "settings in JSON" },
    { threadId: "thread-2" },
    { documentSha256: judgeDocumentSha256("Identity B") }
  ];
  for (const change of changes) {
    assert.notEqual(judgeCacheKey({ ...base, ...change }), key);
  }
});
