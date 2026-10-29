import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryMemoryVectorStore,
  LanceDbMemoryVectorStore
} from "../src/core/memory/store.js";
import type { MemoryLayer } from "../src/core/memory/sources/contract.js";
import type { MemoryVectorStore } from "../src/core/memory/types.js";
import { recordFixture } from "./memory-deep-fixtures.js";
import { tempWorkspace } from "./memory-test-helpers.js";

const GENERATION = "thread-filter";

const RECORDS = [
  recordFixture({
    recordId: "obrien-summary",
    threadId: "o'brien-cafe0031",
    kind: "passage",
    text: "summary of o'brien"
  }),
  recordFixture({
    recordId: "obrien-passage",
    threadId: "o'brien-cafe0031",
    kind: "passage",
    text: "second passage"
  }),
  recordFixture({
    recordId: "obrien-artifact",
    threadId: "o'brien-cafe0031",
    kind: "passage",
    text: "artifact of o'brien",
    sourceType: "artifact",
    layer: 1
  }),
  recordFixture({
    recordId: "plain-summary",
    threadId: "plain-cafe0032",
    kind: "passage",
    text: "plain thread"
  }),
  recordFixture({
    recordId: "inject-summary",
    threadId: "x' OR '1'='1",
    kind: "passage",
    text: "injection-shaped id"
  })
];

const READ_CASES: ReadonlyArray<
  readonly [
    string,
    { layers?: readonly MemoryLayer[]; threadId?: string },
    string[]
  ]
> = [
  [
    "a thread id returns that thread only",
    { threadId: "o'brien-cafe0031" },
    ["obrien-artifact", "obrien-passage", "obrien-summary"]
  ],
  [
    "a thread with layers returns the rows of those layers only",
    { threadId: "o'brien-cafe0031", layers: [1] },
    ["obrien-artifact"]
  ],
  [
    "a quote inside an id stays literal: a prefix of it matches nothing",
    { threadId: "o'brien" },
    []
  ],
  [
    "an id shaped like an injection is compared as text",
    { threadId: "x' OR '1'='1" },
    ["inject-summary"]
  ],
  [
    "without a thread, the layers filter behaves as before",
    { layers: [0] },
    ["inject-summary", "obrien-passage", "obrien-summary", "plain-summary"]
  ]
];

const STORES: ReadonlyArray<readonly [string, () => MemoryVectorStore]> = [
  ["the in-memory store", () => new InMemoryMemoryVectorStore()],
  ["the LanceDB store", () => new LanceDbMemoryVectorStore()]
];

STORES.forEach(([storeLabel, createStore]) => {
  READ_CASES.forEach(([label, options, expectedIds]) => {
    test(`readRows on ${storeLabel}: ${label}`, async () => {
      const info = await tempWorkspace();
      const store = createStore();
      await store.rebuild(
        info,
        RECORDS,
        RECORDS.map(() => [1, 0, 0]),
        GENERATION
      );

      const rows = await store.readRows?.(info, GENERATION, options);

      assert.deepEqual(
        (rows ?? []).map((row) => row.recordId).sort(),
        [...expectedIds].sort()
      );
    });
  });
});
