import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { rebuildMemoryInWorkspace } from "../src/core/memory/index.js";
import { resolveMemoryQueryInterpretation } from "../src/core/memory/recall-support.js";
import {
  InMemoryMemoryVectorStore,
  readMemoryManifest
} from "../src/core/memory/store.js";
import {
  FakeEmbeddingProvider,
  FakeQueryInterpretationProvider,
  FakeRerankingProvider,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";
import { writeFileAt } from "./memory-layers-fixtures.js";

// The query has a one-letter typo of the term. The interpreter can only offer the term back
// when the vocabulary it reads contains it, so the test checks the variants it was given.
const QUERY = "brutalizm";
const TERM = "brutalism";

test("the interpreter does not see a term that exists only in a layer-two chat message", async () => {
  // Scenario: the summary says nothing about the term; the chat message of the same thread does.
  const variants = await interpreterVariantsOf({
    summaryText: "Composer layout notes.",
    chatBody: `${TERM} interface for the composer.`
  });
  assert.equal(variants.includes(TERM), false);
});

test("the interpreter sees the same term when layer zero holds it", async () => {
  // Scenario: the summary contains the term; the chat message repeats the same text.
  const variants = await interpreterVariantsOf({
    summaryText: `${TERM} interface for the composer.`,
    chatBody: `${TERM} interface for the composer.`
  });
  assert.equal(variants.includes(TERM), true);
});

async function interpreterVariantsOf(input: {
  summaryText: string;
  chatBody: string;
}): Promise<string[]> {
  const info = await tempWorkspace();
  await writeSummary(
    info,
    "t1",
    ["# Summary - notes", "", "Thread: `t1`", "", input.summaryText].join("\n")
  );
  await writeFileAt(
    path.join(info.marcPath, "threads", "t1", "CHAT.md"),
    chatMessageWith("m1", input.chatBody)
  );
  const store = new InMemoryMemoryVectorStore();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  await rebuildMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    indexedLayers: [0, 1, 2]
  });
  const manifest = await readMemoryManifest(info);
  const interpreter = new FakeQueryInterpretationProvider(["0"]);
  await resolveMemoryQueryInterpretation(
    info,
    {
      query: QUERY,
      queryMode: "auto",
      provider,
      reranker,
      interpreter,
      store
    },
    store,
    manifest?.generation
  );
  return interpreter.calls.flatMap((call) => call.variants);
}

function chatMessageWith(id: string, body: string): string {
  return [
    "# Chat",
    "",
    "<!-- marc-message",
    `id: ${id}`,
    "threadId: t1",
    "timestamp: 2026-10-01T00:00:00.000Z",
    "agentId: agent",
    "-->",
    body,
    "<!-- /marc-message -->"
  ].join("\n");
}
