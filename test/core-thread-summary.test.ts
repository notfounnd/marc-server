import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createThread,
  listThreads,
  readThread,
  readThreadInfo,
  writeThreadSummary
} from "../src/core/workspace.js";
import { ThreadSummaryError } from "../src/core/thread-summary.js";
import {
  getSummaryPath,
  tempWorkspace
} from "./core-thread-summary-fixtures.js";

test("creates a canonical summary and returns the revision read with it", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Summary lifecycle");
  const body =
    "\n\nSynthesis.\r\nLine with hard break.  \r\n\r\n## Delivery\r\n\r\n- Markdown preserved. \t\r\n\n";
  const result = await writeThreadSummary(workspace, {
    threadId: thread.id,
    body
  });
  const markdown = await fs.readFile(
    getSummaryPath(workspace, thread.id),
    "utf8"
  );
  const normalizedBody =
    "Synthesis.\nLine with hard break.  \n\n## Delivery\n\n- Markdown preserved. \t";

  assert.equal(result.reference, `marc://$${thread.id}`);
  assert.equal(result.status, "closed");
  assert.equal(result.outcome, "created");
  assert.equal(new Date(result.closedAt).toISOString(), result.closedAt);
  assert.equal(
    markdown,
    `# ${thread.title}\n\nThread: marc://$${thread.id}\n\nClosed: \`${result.closedAt}\`\n\n---\n\n${normalizedBody}\n`
  );
  assert.equal(
    result.summaryRevision,
    createHash("sha256").update(Buffer.from(markdown, "utf8")).digest("hex")
  );

  const transcript = await readThread(workspace, thread.id, {
    includeSummary: true
  });
  const info = await readThreadInfo(workspace, thread.id);
  const withoutSummary = await readThread(workspace, thread.id, {
    includeSummary: false
  });
  assert.equal(transcript.summary, markdown);
  assert.equal(transcript.summaryRevision, result.summaryRevision);
  assert.equal(info.summaryRevision, result.summaryRevision);
  assert.equal(info.status, "closed");
  assert.equal(info.closedAt, result.closedAt);
  assert.equal("summaryRevision" in withoutSummary, false);
  assert.equal(
    (await listThreads(workspace, { status: "closed" }))[0]?.id,
    thread.id
  );
});

test("create retries are idempotent and conflicting creates preserve the source", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Idempotent summary");
  const input = {
    threadId: thread.id,
    body: "Synthesis.\n\n## Result\n\nComplete."
  };
  const first = await writeThreadSummary(workspace, input);
  const file = getSummaryPath(workspace, thread.id);
  const before = await fs.readFile(file, "utf8");
  const beforeMtime = (await fs.stat(file)).mtimeMs;
  const retry = await writeThreadSummary(workspace, input);

  assert.equal(retry.outcome, "unchanged");
  assert.equal(retry.closedAt, first.closedAt);
  assert.equal(retry.summaryRevision, first.summaryRevision);
  assert.equal((await fs.stat(file)).mtimeMs, beforeMtime);
  await assert.rejects(
    writeThreadSummary(workspace, {
      threadId: thread.id,
      body: "Different body."
    }),
    (error: unknown) =>
      error instanceof ThreadSummaryError && error.code === "summary_exists"
  );
  assert.equal(await fs.readFile(file, "utf8"), before);
});

test("rejects a non-string body as invalid input", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Invalid summary input");

  await assert.rejects(
    writeThreadSummary(workspace, {
      threadId: thread.id,
      body: null as unknown as string
    }),
    (error: unknown) =>
      error instanceof ThreadSummaryError && error.code === "invalid_input"
  );
  await assert.rejects(fs.access(getSummaryPath(workspace, thread.id)));
});

test("revision-checks updates, preserves close time, and accepts an equivalent retry", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Summary update");
  const created = await writeThreadSummary(workspace, {
    threadId: thread.id,
    body: "Initial."
  });
  const body = "Updated synthesis.\n\n## Result\n\nComplete.";
  const updated = await writeThreadSummary(workspace, {
    threadId: thread.id,
    mode: "update",
    expectedSummaryRevision: created.summaryRevision,
    body
  });
  const retry = await writeThreadSummary(workspace, {
    threadId: thread.id,
    mode: "update",
    expectedSummaryRevision: created.summaryRevision,
    body
  });

  assert.equal(updated.outcome, "updated");
  assert.equal(updated.closedAt, created.closedAt);
  assert.equal(retry.outcome, "unchanged");
  assert.equal(retry.summaryRevision, updated.summaryRevision);
  await assert.rejects(
    writeThreadSummary(workspace, {
      threadId: thread.id,
      mode: "update",
      expectedSummaryRevision: created.summaryRevision,
      body: "A different update."
    }),
    (error: unknown) =>
      error instanceof ThreadSummaryError && error.code === "revision_conflict"
  );
});

test("readers retain compatibility with existing noncanonical thread directory IDs", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Legacy readable thread");
  const legacyId = "legacy-readable-thread";
  const legacyPath = path.join(workspace, ".marc", "threads", legacyId);
  await fs.rename(thread.path, legacyPath);

  const transcript = await readThread(workspace, legacyId, {
    includeSummary: true
  });
  const info = await readThreadInfo(workspace, legacyId);
  assert.equal(transcript.summary, undefined);
  assert.equal("summaryRevision" in transcript, false);
  assert.equal(info.id, legacyId);
  assert.equal("summaryRevision" in info, false);
  await assert.rejects(
    writeThreadSummary(workspace, {
      threadId: legacyId,
      body: "Writer requires a canonical ID."
    }),
    (error: unknown) =>
      error instanceof ThreadSummaryError && error.code === "invalid_thread"
  );
  await assert.rejects(fs.access(path.join(legacyPath, "SUMMARY.md")));
});
