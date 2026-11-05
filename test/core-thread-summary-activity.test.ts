import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type {
  ActivityRecord,
  ThreadActivitySnapshot
} from "../src/core/thread-activity-markdown.js";
import { UNAVAILABLE_LINE } from "../src/core/thread-activity-markdown.js";
import {
  createThread,
  initWorkspace,
  writeThreadSummary
} from "../src/core/workspace.js";

const SNAPSHOT: ThreadActivitySnapshot = {
  threadId: "x",
  profiles: [
    { profile: "claude-dev", role: "developer", origin: "open", activations: 0 }
  ],
  stages: [],
  policyRevision: null,
  pausedDuringThread: "never",
  conflicts: 0
};
const RECORDED: ActivityRecord = { status: "recorded", snapshot: SNAPSHOT };

async function workspaceWithThread(t: {
  after(fn: () => unknown): void;
}): Promise<{ root: string; threadId: string }> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-summary-activity-")
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await initWorkspace(root);
  const thread = await createThread(root, "Activity summary");
  return { root, threadId: thread.id };
}

async function summaryOf(root: string, threadId: string): Promise<string> {
  return fs.readFile(
    path.join(root, ".marc", "threads", threadId, "SUMMARY.md"),
    "utf8"
  );
}

/** The header is everything before the first separator line after the metadata. */
function headerOf(summary: string): string {
  return summary.slice(0, summary.indexOf("\n---\n"));
}

test("a summary without activity has no Activity section and keeps the header layout", async (t) => {
  const { root, threadId } = await workspaceWithThread(t);

  await writeThreadSummary(root, { threadId, body: "Done." });

  const summary = await summaryOf(root, threadId);
  assert.equal(summary.includes("## Activity"), false);
  assert.match(
    summary,
    /^# Activity summary\n\nThread: marc:\/\/\$[^\n]+\n\nClosed: `[^`]+`\n\n---\n\nDone\.\n$/
  );
});

test("a recorded activity sits in the header, before the separator, and the body follows it", async (t) => {
  const { root, threadId } = await workspaceWithThread(t);

  await writeThreadSummary(root, {
    threadId,
    body: "Done.",
    activity: RECORDED
  });

  const summary = await summaryOf(root, threadId);
  const header = headerOf(summary);
  assert.ok(header.includes("## Activity"));
  assert.ok(header.includes("| claude-dev | developer | open | - | - | 0 |"));
  assert.ok(summary.endsWith("\n---\n\nDone.\n"));
});

test("an unavailable daemon writes the single explanatory line in the Activity section", async (t) => {
  const { root, threadId } = await workspaceWithThread(t);

  await writeThreadSummary(root, {
    threadId,
    body: "Done.",
    activity: { status: "unavailable" }
  });

  const header = headerOf(await summaryOf(root, threadId));
  assert.ok(header.includes(`## Activity\n\n${UNAVAILABLE_LINE}`));
});

test("an update keeps the Activity block that the header already has and changes only the body", async (t) => {
  const { root, threadId } = await workspaceWithThread(t);
  const created = await writeThreadSummary(root, {
    threadId,
    body: "First.",
    activity: RECORDED
  });
  const beforeHeader = headerOf(await summaryOf(root, threadId));

  await writeThreadSummary(root, {
    threadId,
    body: "Second.",
    mode: "update",
    expectedSummaryRevision: created.summaryRevision
  });

  const summary = await summaryOf(root, threadId);
  assert.equal(headerOf(summary), beforeHeader);
  assert.ok(summary.endsWith("\n---\n\nSecond.\n"));
});

test("a caller body cannot write into the header, even with an Activity heading and a separator", async (t) => {
  const { root, threadId } = await workspaceWithThread(t);
  const forged = "## Activity\n\nforged row\n\n---\n\nforged-body";

  await writeThreadSummary(root, {
    threadId,
    body: forged,
    activity: RECORDED
  });

  const summary = await summaryOf(root, threadId);
  const header = headerOf(summary);
  assert.equal(header.includes("forged"), false);
  assert.ok(summary.indexOf("forged-body") > summary.indexOf("\n---\n"));
  assert.equal(summary.split("## Activity").length - 1, 2);
});
