import assert from "node:assert/strict";
import test from "node:test";
import { deepMemoryInWorkspace } from "../src/core/memory/deep.js";
import { deepReadinessAction } from "../src/core/memory/deep-readiness.js";
import { normalizeDeepInput } from "../src/core/memory/deep-input.js";
import { rebuildMemoryInWorkspace } from "../src/core/memory/index.js";
import { tryWithMemoryOperationLock } from "../src/core/memory/rebuild-coordination.js";
import type { MemoryStatus } from "../src/core/memory/types.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import {
  DeepFixtureStore,
  statusFixture,
  summaryMarkdown
} from "./memory-deep-fixtures.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  tempWorkspace,
  writeSummary,
  writeThreadChat
} from "./memory-test-helpers.js";

test("an open thread is not closed: memory_deep returns thread_not_closed with the exact message", async () => {
  const info = await tempWorkspace();
  await writeThreadChat(info, "open-thread-cafe0010", "Open thread");
  const store = await rebuiltStore(info);

  await assert.rejects(
    deepMemoryInWorkspace(info, deepInput(store, "open-thread-cafe0010")),
    {
      name: "MemoryDeepError",
      code: "thread_not_closed",
      message: "memory_deep only covers closed threads."
    }
  );
});

test("an unknown thread id is thread_not_found", async () => {
  const info = await tempWorkspace();
  const store = await rebuiltStore(info);

  await assert.rejects(
    deepMemoryInWorkspace(info, deepInput(store, "missing-thread")),
    { name: "MemoryDeepError", code: "thread_not_found" }
  );
});

test("a suffix shared by two eligible threads is ambiguous_thread_id", async () => {
  const info = await tempWorkspace();
  await writeThreadChat(info, "alpha-cafe0004", "Alpha");
  await writeThreadChat(info, "beta-cafe0004", "Beta");
  const store = await rebuiltStore(info);

  await assert.rejects(
    deepMemoryInWorkspace(info, deepInput(store, "cafe0004")),
    {
      name: "MemoryDeepError",
      code: "ambiguous_thread_id"
    }
  );
});

test("a traversal id is invalid_thread_id", async () => {
  const info = await tempWorkspace();
  const store = await rebuiltStore(info);

  await assert.rejects(
    deepMemoryInWorkspace(info, deepInput(store, "../outside")),
    { name: "MemoryDeepError", code: "invalid_thread_id" }
  );
});

test("a closed thread that the index does not hold is thread_not_indexed", async () => {
  const info = await tempWorkspace();
  await addClosedThread(info, "indexed-thread-cafe0005");
  const store = await rebuiltStore(info);
  await addClosedThread(info, "late-thread-cafe0006");

  await assert.rejects(
    deepMemoryInWorkspace(info, deepInput(store, "late-thread-cafe0006")),
    { name: "MemoryDeepError", code: "thread_not_indexed" }
  );
});

const INVALID_INPUTS: ReadonlyArray<readonly [string, object, string]> = [
  ["a limit above 20", { limit: 21 }, "invalid_limit"],
  ["a limit of zero", { limit: 0 }, "invalid_limit"],
  ["a fractional limit", { limit: 1.5 }, "invalid_limit"],
  ["an empty source type list", { sourceTypes: [] }, "invalid_source_types"],
  [
    "rules with a thread",
    { threadId: "any-thread-cafe0007", sourceTypes: ["rules"] },
    "invalid_source_types"
  ],
  [
    "document with a thread",
    { threadId: "any-thread-cafe0007", sourceTypes: ["summary", "document"] },
    "invalid_source_types"
  ]
];

INVALID_INPUTS.forEach(([label, extra, code]) => {
  test(`memory_deep rejects ${label} with ${code}`, async () => {
    const info = await tempWorkspace();
    const store = await rebuiltStore(info);

    await assert.rejects(
      deepMemoryInWorkspace(info, {
        ...deepInput(store, "unscoped"),
        threadId: undefined,
        ...extra
      }),
      { name: "MemoryDeepError", code }
    );
  });
});

test("a missing index returns an empty unscoped result with the rebuild action", async () => {
  const info = await tempWorkspace();
  const store = new DeepFixtureStore();

  const deep = await deepMemoryInWorkspace(info, {
    ...deepInput(store, "unscoped"),
    threadId: undefined
  });

  assert.equal(deep.mode, "unscoped");
  assert.deepEqual(deep.results, []);
  assert.equal(deep.abstained, false);
  assert.equal(deep.rerankPairs, 0);
  assert.equal(deep.indexStatus.status, "missing");
  assert.deepEqual(deep.nextActions, [
    "Run memory_rebuild before using memory_deep."
  ]);
});

test("a held operation lock returns an empty result with the retry action, without an error", async () => {
  const info = await tempWorkspace();
  await addClosedThread(info, "locked-thread-cafe0008");
  const store = await rebuiltStore(info);

  const unscoped = await withHeldOperationLock(info, () =>
    deepMemoryInWorkspace(info, {
      ...deepInput(store, "unscoped"),
      threadId: undefined
    })
  );
  const scoped = await withHeldOperationLock(info, () =>
    deepMemoryInWorkspace(info, deepInput(store, "locked-thread-cafe0008"))
  );

  assert.deepEqual(unscoped.results, []);
  assert.equal(unscoped.abstained, false);
  assert.deepEqual(unscoped.nextActions, [
    "Retry after the current memory operation completes."
  ]);
  assert.equal(scoped.mode, "scoped");
  assert.equal(scoped.threadId, "locked-thread-cafe0008");
  assert.deepEqual(scoped.results, []);
  assert.deepEqual(scoped.nextActions, [
    "Retry after the current memory operation completes."
  ]);
});

const READINESS_CASES: ReadonlyArray<
  readonly [string, Partial<MemoryStatus>, string | undefined]
> = [
  ["a ready index needs no action", {}, undefined],
  [
    "an index that cannot be read yet asks for memory_prepare",
    { rebuildReady: false },
    "Run memory_prepare before using memory_deep."
  ],
  [
    "a missing index asks for memory_rebuild",
    { status: "missing" },
    "Run memory_rebuild before using memory_deep."
  ],
  [
    "an incompatible index asks for memory_rebuild with the reason",
    { status: "incompatible" },
    "Run memory_rebuild because the embedding provider changed."
  ],
  [
    "an index that is not searchable asks for memory_prepare",
    { searchReady: false },
    "Run memory_prepare before using memory_deep."
  ],
  [
    "the first blocking condition decides, even when two apply",
    { rebuildReady: false, status: "missing" },
    "Run memory_prepare before using memory_deep."
  ]
];

READINESS_CASES.forEach(([label, overrides, expected]) => {
  test(`readiness: ${label}`, () => {
    assert.equal(deepReadinessAction(statusFixture(overrides)), expected);
  });
});

const NORMALIZE_CASES: ReadonlyArray<readonly [string, object, number]> = [
  ["the default limit is 5", {}, 5],
  ["limit 1 is accepted", { limit: 1 }, 1],
  ["limit 20 is accepted", { limit: 20 }, 20],
  ["rules are accepted without a thread", { sourceTypes: ["rules"] }, 5],
  [
    "summary, artifact and chat are accepted with a thread",
    { threadId: "x", sourceTypes: ["summary", "artifact", "chat"] },
    5
  ]
];

NORMALIZE_CASES.forEach(([label, extra, limit]) => {
  test(`normalizeDeepInput: ${label}`, () => {
    assert.equal(
      normalizeDeepInput({ query: "toogle", ...extra }).limit,
      limit
    );
  });
});

function deepInput(store: DeepFixtureStore, threadId: string) {
  return {
    provider: new FakeEmbeddingProvider(),
    reranker: new FakeRerankingProvider(),
    store,
    query: "toogle",
    threadId
  };
}

/** A workspace index built from the closed threads on disk, with its own store. */
async function rebuiltStore(info: WorkspaceInfo): Promise<DeepFixtureStore> {
  const store = new DeepFixtureStore();
  await rebuildMemoryInWorkspace(info, {
    provider: new FakeEmbeddingProvider(),
    reranker: new FakeRerankingProvider(),
    store
  });
  return store;
}

async function addClosedThread(
  info: WorkspaceInfo,
  threadId: string
): Promise<void> {
  await writeSummary(
    info,
    threadId,
    summaryMarkdown(threadId, "Toggle settings")
  );
  await writeThreadChat(info, threadId, threadId);
}

/** Runs `run` while another operation holds the memory lock, then releases the lock. */
async function withHeldOperationLock<T>(
  info: WorkspaceInfo,
  run: () => Promise<T>
): Promise<T> {
  const held = deferred();
  const release = deferred();
  const holder = tryWithMemoryOperationLock(info, async () => {
    held.resolve();
    await release.promise;
  });
  await held.promise;
  try {
    return await run();
  } finally {
    release.resolve();
    await holder;
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve: () => resolve() };
}
