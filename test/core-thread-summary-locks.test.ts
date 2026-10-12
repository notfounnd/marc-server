import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  appendMessage,
  createThread,
  writeThreadSummary
} from "../src/core/workspace.js";
import { ThreadSummaryError } from "../src/core/thread-summary.js";
import {
  getSummaryPath,
  runSummaryUpdateProcess,
  tempWorkspace
} from "./core-thread-summary-fixtures.js";
import {
  threadWriteResource,
  withWorkspaceWriteLock
} from "../src/core/write-coordination.js";

test("serializes competing updates and preserves concurrent chat and artifact writes", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Summary lock");
  const created = await writeThreadSummary(workspace, {
    threadId: thread.id,
    body: "Initial."
  });
  const updates = await Promise.allSettled([
    writeThreadSummary(workspace, {
      threadId: thread.id,
      mode: "update",
      expectedSummaryRevision: created.summaryRevision,
      body: "First concurrent update."
    }),
    writeThreadSummary(workspace, {
      threadId: thread.id,
      mode: "update",
      expectedSummaryRevision: created.summaryRevision,
      body: "Second concurrent update."
    })
  ]);
  assert.equal(updates.filter((item) => item.status === "fulfilled").length, 1);
  const failure = updates.find((item) => item.status === "rejected");
  assert.ok(failure?.status === "rejected");
  assert.ok(failure.reason instanceof ThreadSummaryError);
  assert.equal(failure.reason.code, "revision_conflict");

  const chatPath = path.join(
    workspace,
    ".marc",
    "threads",
    thread.id,
    "CHAT.md"
  );
  const chatBefore = await fs.readFile(chatPath, "utf8");
  const artifact = path.join(
    workspace,
    ".marc",
    "threads",
    thread.id,
    "artifacts",
    "preserved.md"
  );
  await fs.writeFile(artifact, "artifact source", "utf8");
  await Promise.all([
    writeThreadSummary(workspace, {
      threadId: thread.id,
      mode: "update",
      expectedSummaryRevision: (
        updates.find(
          (item) => item.status === "fulfilled"
        ) as PromiseFulfilledResult<{
          summaryRevision: string;
        }>
      ).value.summaryRevision,
      body: "Final update."
    }),
    appendMessage(workspace, thread.id, {
      agentId: "codex-dev",
      body: "Message remains."
    })
  ]);
  assert.match(await fs.readFile(chatPath, "utf8"), /Message remains\./);
  assert.ok((await fs.readFile(chatPath, "utf8")).startsWith(chatBefore));
  assert.equal(await fs.readFile(artifact, "utf8"), "artifact source");
  assert.match(
    await fs.readFile(getSummaryPath(workspace, thread.id), "utf8"),
    /Final update\./
  );
});

test("serializes competing updates from separate processes", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Cross-process summary writes");
  const created = await writeThreadSummary(workspace, {
    threadId: thread.id,
    body: "Initial."
  });
  const processes = await Promise.all([
    runSummaryUpdateProcess(
      workspace,
      thread.id,
      created.summaryRevision,
      "Process one."
    ),
    runSummaryUpdateProcess(
      workspace,
      thread.id,
      created.summaryRevision,
      "Process two."
    )
  ]);
  assert.deepEqual(
    processes.map((child) => child.results.length),
    [1, 1]
  );
  const childPids = processes.map((child) => child.pid);
  assert.equal(new Set(childPids).size, 2);
  assert.ok(
    childPids.every(
      (pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid
    )
  );
  const results = processes.flatMap((child) => child.results);
  assert.equal(
    results.filter(
      (result) => result.status === "fulfilled" && result.outcome === "updated"
    ).length,
    1
  );
  assert.equal(
    results.filter(
      (result) =>
        result.status === "rejected" &&
        result.errorName === "ThreadSummaryError" &&
        result.errorCode === "revision_conflict"
    ).length,
    1
  );
  const successfulUpdate = results.find(
    (result) => result.status === "fulfilled"
  );
  assert.ok(successfulUpdate);
  const persistedSummary = await fs.readFile(
    getSummaryPath(workspace, thread.id)
  );
  assert.equal(
    successfulUpdate.summaryRevision,
    createHash("sha256").update(persistedSummary).digest("hex")
  );
  assert.match(
    persistedSummary.toString("utf8"),
    new RegExp(successfulUpdate.body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
});

test("different thread resources do not share the summary write lock", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const first = await createThread(workspace, "First lock resource");
  const second = await createThread(workspace, "Second lock resource");
  let enteredLock: () => void = () => undefined;
  let releaseLock: () => void = () => undefined;
  const entered = new Promise<void>((resolve) => (enteredLock = resolve));
  const hold = new Promise<void>((resolve) => (releaseLock = resolve));
  const heldLock = withWorkspaceWriteLock(
    path.join(workspace, ".marc"),
    threadWriteResource(first.id),
    async () => {
      enteredLock();
      await hold;
    }
  );
  await entered;
  let timer: NodeJS.Timeout | undefined;
  try {
    const secondWrite = writeThreadSummary(workspace, {
      threadId: second.id,
      body: "Independent."
    });
    const completed = await Promise.race([
      secondWrite.then(() => true),
      new Promise<boolean>(
        (resolve) => (timer = setTimeout(() => resolve(false), 5000))
      )
    ]);
    assert.equal(completed, true);
  } finally {
    clearTimeout(timer);
    releaseLock();
    await heldLock;
  }
});
