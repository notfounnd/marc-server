import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readClosedThreads } from "../scripts/memory-eval/cli.js";
import { withTemporaryWorkspace } from "../scripts/memory-eval/corpus.js";
import type { PinnedCorpus } from "../scripts/memory-eval/dataset.js";
import { parseMessages } from "../src/core/markdown.js";
import { readMemoryManifest } from "../src/core/memory/index.js";
import {
  prepareMemoryInWorkspace,
  rebuildMemoryInWorkspace
} from "../src/core/memory/operations.js";
import { LanceDbMemoryVectorStore } from "../src/core/memory/store.js";
import type { MemoryOperationOptions } from "../src/core/memory/types.js";
import {
  FakeEmbeddingProvider,
  FakeQueryInterpretationProvider,
  FakeRerankingProvider
} from "./memory-test-helpers.js";
import { REPOSITORY_ROOT } from "./memory-eval-capture-fixtures.js";

const FIXTURE_ROOT = path.join(
  REPOSITORY_ROOT,
  "test",
  "fixtures",
  "memory-eval",
  "ledgerline-en"
);
const THREADS_ROOT = path.join(FIXTURE_ROOT, "threads");
const RULES_PATH = path.join(FIXTURE_ROOT, "RULES.md");
const DESIGN_PATH = path.join(FIXTURE_ROOT, "DESIGN.md");
const PINNED_PATH = path.join(
  REPOSITORY_ROOT,
  "scripts",
  "memory-eval",
  "datasets",
  "ledgerline-en.corpus.json"
);

const OPEN_THREAD_IDS = [
  "multi-currency-reconciliation-plan-1a2b3c4d",
  "mobile-companion-app-scoping-5e6f7a8b",
  "evaluate-lmdb-versus-sqlite-indexing-9c0d1e2f"
];

async function threadIds(): Promise<string[]> {
  const entries = await fs.readdir(THREADS_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function closedThreadIds(): Promise<string[]> {
  const closed = await readClosedThreads(THREADS_ROOT);
  return [...closed.keys()].sort();
}

function readThreadFile(threadId: string, file: string): Promise<string> {
  return fs.readFile(path.join(THREADS_ROOT, threadId, file), "utf8");
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

function countSections(markdown: string): number {
  return markdown.split("\n").filter((line) => line.startsWith("## ")).length;
}

function hasValidSummaryHeader(threadId: string, markdown: string): boolean {
  return (
    /^# .+/.test(markdown) &&
    markdown.includes(`\nThread: marc://$${threadId}\n`) &&
    /^Closed: `[^`]+`$/m.test(markdown)
  );
}

function hasValidChatHeader(threadId: string, markdown: string): boolean {
  return (
    /^# .+/.test(markdown) &&
    markdown.includes(`Thread: \`${threadId}\``) &&
    /^Created: `[^`]+`$/m.test(markdown)
  );
}

test("the fixture has 33 thread folders: 30 closed and 3 open", async () => {
  const ids = await threadIds();
  const closed = await closedThreadIds();
  assert.equal(ids.length, 33);
  assert.equal(closed.length, 30);
  assert.deepEqual(
    closed,
    ids.filter((id) => !OPEN_THREAD_IDS.includes(id))
  );
  assert.deepEqual(
    ids.filter((id) => OPEN_THREAD_IDS.includes(id)),
    [...OPEN_THREAD_IDS].sort()
  );
});

test("closed summaries have a valid header, 150-600 words and 2-5 sections", async () => {
  const closed = await closedThreadIds();
  const summaries = await Promise.all(
    closed.map(async (threadId) => ({
      threadId,
      markdown: await readThreadFile(threadId, "SUMMARY.md")
    }))
  );
  assert.equal(summaries.length, 30);
  const headerViolations = summaries
    .filter(
      ({ threadId, markdown }) => !hasValidSummaryHeader(threadId, markdown)
    )
    .map(({ threadId }) => threadId);
  assert.deepEqual(headerViolations, []);
  const sizeViolations = summaries
    .map(({ threadId, markdown }) => ({
      threadId,
      words: countWords(markdown),
      sections: countSections(markdown)
    }))
    .filter(
      ({ words, sections }) =>
        words < 150 || words > 600 || sections < 2 || sections > 5
    );
  assert.deepEqual(sizeViolations, []);
});

test("every CHAT has a valid header and 4-10 messages of its own thread", async () => {
  const ids = await threadIds();
  const chats = await Promise.all(
    ids.map(async (threadId) => ({
      threadId,
      markdown: await readThreadFile(threadId, "CHAT.md")
    }))
  );
  assert.equal(chats.length, 33);
  const headerViolations = chats
    .filter(({ threadId, markdown }) => !hasValidChatHeader(threadId, markdown))
    .map(({ threadId }) => threadId);
  assert.deepEqual(headerViolations, []);
  const parsed = chats.map(({ threadId, markdown }) => ({
    threadId,
    messages: parseMessages(markdown)
  }));
  const countViolations = parsed
    .filter(({ messages }) => messages.length < 4 || messages.length > 10)
    .map(({ threadId, messages }) => ({ threadId, count: messages.length }));
  assert.deepEqual(countViolations, []);
  const foreignMessages = parsed.flatMap(({ threadId, messages }) =>
    messages
      .filter((message) => message.threadId !== threadId)
      .map((message) => message.id)
  );
  assert.deepEqual(foreignMessages, []);
});

test("artifacts are 0-3 per thread and every cited artifact exists", async () => {
  const ids = await threadIds();
  const folderCounts = await Promise.all(
    ids.map(async (threadId) => ({
      threadId,
      count: (await fs.readdir(path.join(THREADS_ROOT, threadId, "artifacts")))
        .length
    }))
  );
  assert.deepEqual(
    folderCounts.filter(({ count }) => count > 3),
    []
  );
  const cited = await Promise.all(
    ids.map(async (threadId) => {
      const messages = parseMessages(await readThreadFile(threadId, "CHAT.md"));
      return messages.flatMap((message) =>
        message.artifacts.map((file) => ({ threadId, file }))
      );
    })
  );
  const citedPerThread = cited.map((items) => items.length);
  assert.deepEqual(
    citedPerThread.filter((count) => count > 3),
    []
  );
  const missing = cited
    .flat()
    .filter(
      ({ threadId, file }) =>
        !existsSync(path.join(THREADS_ROOT, threadId, file))
    );
  assert.deepEqual(missing, []);
});

test("the pinned corpus lists exactly the closed threads", async () => {
  const pinned = JSON.parse(
    await fs.readFile(PINNED_PATH, "utf8")
  ) as PinnedCorpus;
  assert.equal(pinned.corpus, "ledgerline-en");
  assert.equal(pinned.threadIds.length, 30);
  assert.deepEqual([...pinned.threadIds].sort(), await closedThreadIds());
});

test("a temporary rebuild indexes the 30 closed threads and ignores the 3 open ones", async () => {
  const ids = await threadIds();
  const closed = await closedThreadIds();
  assert.equal(closed.length, 30);
  await withTemporaryWorkspace(
    { threadsRoot: THREADS_ROOT, threadIds: ids, rulesPath: RULES_PATH },
    async (info) => {
      const store = new LanceDbMemoryVectorStore();
      const options: MemoryOperationOptions = {
        provider: new FakeEmbeddingProvider(),
        reranker: new FakeRerankingProvider(),
        interpreter: new FakeQueryInterpretationProvider(["0"]),
        store
      };
      await prepareMemoryInWorkspace(info, options);
      await rebuildMemoryInWorkspace(info, options);
      const manifest = await readMemoryManifest(info);
      const rows = await store.readRows(info, manifest?.generation);
      const indexed = [...new Set(rows.map((row) => row.threadId))].sort();
      assert.deepEqual(indexed, closed);
    }
  );
});

test("DESIGN.md cites only existing threads and documents 21 of them", async () => {
  const ids = await threadIds();
  const design = await fs.readFile(DESIGN_PATH, "utf8");
  const cited = [...design.matchAll(/`([a-z0-9-]+-[0-9a-f]{8})`/g)].map(
    (match) => match[1]
  );
  const unknown = cited.filter((id) => !ids.includes(id));
  assert.deepEqual(unknown, []);
  assert.equal(new Set(cited).size, 21);
});
