import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { createThread, writeThreadSummary } from "../src/core/workspace.js";
import { ThreadSummaryError } from "../src/core/thread-summary.js";
import {
  getSummaryPath,
  summaryRevision,
  tempWorkspace
} from "./core-thread-summary-fixtures.js";

test("legacy update retry preserves source bytes and mtime before normalization", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Historical title");
  const file = getSummaryPath(workspace, thread.id);
  const oldDate = new Date("2021-03-04T05:06:07.000Z");
  const body = [
    "Synthesis from a historic record.",
    "",
    "```md",
    "Thread: marc://$another-thread-12345678",
    "Closed:",
    "---",
    "```",
    "",
    "The body remains free Markdown."
  ].join("\n");
  const legacy = `# Resumo - ${thread.title}\n\n${body}\n`;
  await fs.writeFile(file, legacy, "utf8");
  await fs.utimes(file, oldDate, oldDate);
  const originalMtime = (await fs.stat(file)).mtimeMs;
  const originalRevision = summaryRevision(legacy);

  const retry = await writeThreadSummary(workspace, {
    threadId: thread.id,
    mode: "update",
    expectedSummaryRevision: "0".repeat(64),
    body
  });

  assert.equal(retry.outcome, "unchanged");
  assert.equal(await fs.readFile(file, "utf8"), legacy);
  assert.equal((await fs.stat(file)).mtimeMs, originalMtime);

  const updatedBody = `${body}\n\nUpdate after review.`;
  const updated = await writeThreadSummary(workspace, {
    threadId: thread.id,
    mode: "update",
    expectedSummaryRevision: originalRevision,
    body: updatedBody
  });
  const canonical = await fs.readFile(file, "utf8");
  assert.equal(updated.closedAt, oldDate.toISOString());
  assert.ok(
    canonical.startsWith(
      `# ${thread.title}\n\nThread: marc://$${thread.id}\n\nClosed: \`${oldDate.toISOString()}\`\n\n---\n\n`
    )
  );
  assert.ok(canonical.includes("Thread: marc://$another-thread-12345678"));
  assert.ok(canonical.includes("Closed:\n---"));
  assert.ok(canonical.endsWith(`${updatedBody}\n`));
});

test("legacy raw thread IDs and inline references are accepted without a divider", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Legacy raw reference");
  const file = getSummaryPath(workspace, thread.id);
  const closedAt = "2022-04-03T02:01:00.1Z";
  const legacy = [
    `# Resumo - ${thread.title}`,
    "",
    `Thread: \`$${thread.id}\``,
    "",
    `Closed: \`${closedAt}\``,
    "",
    "Synthesis body.",
    "",
    "## Result",
    "Legacy result."
  ].join("\n");
  await fs.writeFile(file, legacy, "utf8");
  const result = await writeThreadSummary(workspace, {
    threadId: thread.id,
    mode: "update",
    expectedSummaryRevision: summaryRevision(legacy),
    body: "Updated legacy body."
  });

  assert.equal(result.closedAt, closedAt);
  const markdown = await fs.readFile(file, "utf8");
  assert.ok(
    markdown.startsWith(`# ${thread.title}\n\nThread: marc://$${thread.id}`)
  );
  assert.ok(markdown.includes(`Closed: \`${closedAt}\``));
  assert.ok(markdown.endsWith("Updated legacy body.\n"));
});

test("legacy divider without Thread or Closed metadata remains an idempotent source", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Legacy divider only");
  const file = getSummaryPath(workspace, thread.id);
  const oldDate = new Date("2020-06-07T08:09:10.000Z");
  const legacy = `# Resumo - ${thread.title}\n\n---\n\nSynthesis without explicit metadata.\n`;
  await fs.writeFile(file, legacy, "utf8");
  await fs.utimes(file, oldDate, oldDate);
  const mtime = (await fs.stat(file)).mtimeMs;

  const retry = await writeThreadSummary(workspace, {
    threadId: thread.id,
    mode: "update",
    expectedSummaryRevision: "0".repeat(64),
    body: "Synthesis without explicit metadata."
  });

  assert.equal(retry.outcome, "unchanged");
  assert.equal(retry.closedAt, oldDate.toISOString());
  assert.equal(await fs.readFile(file, "utf8"), legacy);
  assert.equal((await fs.stat(file)).mtimeMs, mtime);
});

test("legacy contradictions and explicit invalid close dates are rejected", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Invalid historical metadata");
  const file = getSummaryPath(workspace, thread.id);
  const invalidRecords = [
    `# Resumo\n\nThread: marc://$another-thread-12345678\n\nOld body.\n`,
    `# Resumo\n\nClosed:\n\nOld body.\n`,
    `# Resumo\n\nClosed: 2022-04-03T02:01:00.000Z\nClosed: 2022-04-03T02:01:00.000Z\n\nOld body.\n`
  ];

  for (const legacy of invalidRecords) {
    await fs.writeFile(file, legacy, "utf8");
    const revision = summaryRevision(legacy);
    await assert.rejects(
      writeThreadSummary(workspace, {
        threadId: thread.id,
        mode: "update",
        expectedSummaryRevision: revision,
        body: "An intentional update."
      }),
      (error: unknown) =>
        error instanceof ThreadSummaryError && error.code === "metadata_invalid"
    );
    assert.equal(await fs.readFile(file, "utf8"), legacy);
  }
});
