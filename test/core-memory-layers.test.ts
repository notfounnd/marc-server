import assert from "node:assert/strict";
import test from "node:test";
import {
  MEMORY_DEPTH_LAYERS,
  isMemorySearchDepth,
  layersForDepth,
  presentLayersOf,
  MEMORY_SEARCH_DEPTH_RANGE_MESSAGE
} from "../src/core/memory/search-depth.js";
import { mergeByScore } from "../src/core/memory/layered-search.js";
import { artifactMessageId } from "../src/core/memory/sources/artifact.js";
import { semanticRecallHits } from "../src/core/memory/hybrid-ranking.js";
import {
  chatFile,
  chatMessage,
  ranked,
  record
} from "./memory-layers-fixtures.js";

test("each depth searches the layers up to its own number", () => {
  // Scenario: depth 0 is layer 0; depth 1 adds layer 1; depth 2 adds layer 2.
  assert.deepEqual(MEMORY_DEPTH_LAYERS[0], [0]);
  assert.deepEqual(MEMORY_DEPTH_LAYERS[1], [0, 1]);
  assert.deepEqual(MEMORY_DEPTH_LAYERS[2], [0, 1, 2]);
});

test("a depth searches only the layers the index holds", () => {
  // Scenario: depth 2 over an index that holds layers 0 and 2 searches 0 and 2.
  assert.deepEqual(layersForDepth(2, [0, 2]), [0, 2]);
  // Scenario: production holds layer 0 only, so every depth searches layer 0.
  assert.deepEqual(layersForDepth(2, [0]), [0]);
});

test("the layers present in an index come from its records, in layer order", () => {
  assert.deepEqual(
    presentLayersOf([{ layer: 2 }, { layer: 0 }, { layer: 2 }]),
    [0, 2]
  );
});

test("depth accepts 0, 1 and 2 and refuses 3 and malformed values", () => {
  assert.equal(isMemorySearchDepth(0), true);
  assert.equal(isMemorySearchDepth(2), true);
  assert.equal(isMemorySearchDepth(3), false);
  assert.equal(isMemorySearchDepth(-1), false);
  assert.equal(isMemorySearchDepth(1.5), false);
  assert.equal(isMemorySearchDepth("1"), false);
});

test("the depth refusal explains the layers", () => {
  assert.match(MEMORY_SEARCH_DEPTH_RANGE_MESSAGE, /counts corpus layers/);
  assert.match(MEMORY_SEARCH_DEPTH_RANGE_MESSAGE, /Depth 3 is not available/);
});

test("one list of hits is kept exactly as it was", () => {
  const list = [
    { score: 0.2, id: "b" },
    { score: 0.9, id: "a" }
  ];
  assert.deepEqual(mergeByScore([list]), list);
});

test("several lists merge by score, and a tie keeps the list order", () => {
  // Scenario: layer 0 has 0.9 and 0.5; layer 1 has 0.5 and 0.7. The 0.5 of layer 0 stays first.
  const merged = mergeByScore([
    [
      { score: 0.9, id: "L0-a" },
      { score: 0.5, id: "L0-b" }
    ],
    [
      { score: 0.5, id: "L1-a" },
      { score: 0.7, id: "L1-b" }
    ]
  ]);
  assert.deepEqual(
    merged.map((item) => item.id),
    ["L0-a", "L1-b", "L0-b", "L1-a"]
  );
});

test("a summary hit is a thread group, referenced by its thread", () => {
  const [hit] = semanticRecallHits([
    ranked(record("t1", "summary", { sourceType: "summary" }))
  ]);
  assert.equal(hit?.groupKind, "thread");
  assert.equal(hit?.groupId, "t1");
  assert.equal(hit?.threadId, "t1");
  assert.equal(hit?.reference, "marc://$t1");
});

test("a chat hit is referenced by its message", () => {
  const [hit] = semanticRecallHits([
    ranked(record("t1", "passage", { sourceType: "chat", messageId: "m2" }))
  ]);
  assert.equal(hit?.reference, "marc://$t1/#m2");
});

test("an artifact hit is referenced by its message and its file", () => {
  const [hit] = semanticRecallHits([
    ranked(
      record("t1", "passage", {
        sourceType: "artifact",
        messageId: "m2",
        artifactFileName: "plano.md"
      })
    )
  ]);
  assert.equal(hit?.reference, "marc://$t1/#m2/!plano.md");
});

test("an artifact without a linking message is referenced by its thread", () => {
  const [hit] = semanticRecallHits([
    ranked(
      record("t1", "passage", {
        sourceType: "artifact",
        artifactFileName: "plano.md"
      })
    )
  ]);
  assert.equal(hit?.reference, "marc://$t1");
  assert.equal(hit?.groupKind, "thread");
});

test("a rules hit is a rules group with no thread and no summary", () => {
  const [hit] = semanticRecallHits([
    ranked(
      record("@rules", "passage", {
        sourceType: "rules",
        sourcePath: ".marc/RULES.md"
      })
    )
  ]);
  assert.equal(hit?.groupKind, "rules");
  assert.equal(hit?.groupId, "@rules");
  assert.equal(hit?.threadId, undefined);
  assert.equal(hit?.summaryPath, undefined);
  assert.equal(hit?.reference, ".marc/RULES.md");
});

test("a document hit is a document group referenced by its path", () => {
  const [hit] = semanticRecallHits([
    ranked(
      record("@document/docs/policy.md", "passage", {
        sourceType: "document",
        sourcePath: "docs/policy.md"
      })
    )
  ]);
  assert.equal(hit?.groupKind, "document");
  assert.equal(hit?.threadId, undefined);
  assert.equal(hit?.reference, "docs/policy.md");
});

test("the artifact's linking message is the first CHAT.md message that lists it", () => {
  const chat = chatFile([
    chatMessage("m1", "artifacts/other.md"),
    chatMessage("m2", "artifacts/plano.md, artifacts/extra.md"),
    chatMessage("m3", "artifacts/plano.md")
  ]);
  assert.equal(artifactMessageId(chat, "plano.md"), "m2");
});

test("an artifact that no message lists has no message id", () => {
  const chat = chatFile([chatMessage("m1", "artifacts/other.md")]);
  assert.equal(artifactMessageId(chat, "plano.md"), undefined);
});

test("an artifact of a thread without a chat has no message id", () => {
  assert.equal(artifactMessageId(undefined, "plano.md"), undefined);
});
