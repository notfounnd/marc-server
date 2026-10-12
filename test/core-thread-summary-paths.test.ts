import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createThread, writeThreadSummary } from "../src/core/workspace.js";
import { ThreadSummaryError } from "../src/core/thread-summary.js";
import { tempWorkspace } from "./core-thread-summary-fixtures.js";

const isPathInvalid = (error: unknown) =>
  error instanceof ThreadSummaryError && error.code === "path_invalid";

test("rejects traversal and uppercase write aliases before creating summaries", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  await assert.rejects(
    writeThreadSummary(workspace, {
      threadId: "../outside-12345678",
      body: "Rejected."
    }),
    (error: unknown) =>
      error instanceof ThreadSummaryError && error.code === "invalid_thread"
  );
  const thread = await createThread(workspace, "Canonical write identity");
  const chatPath = path.join(
    workspace,
    ".marc",
    "threads",
    thread.id,
    "CHAT.md"
  );
  const chat = await fs.readFile(chatPath, "utf8");
  await fs.writeFile(chatPath, chat.replace(/^Thread:.*\r?\n/m, ""), "utf8");
  await assert.rejects(
    writeThreadSummary(workspace, {
      threadId: thread.id.toUpperCase(),
      body: "Case alias must not share another lock key."
    }),
    (error: unknown) =>
      error instanceof ThreadSummaryError && error.code === "invalid_thread"
  );
  await assert.rejects(
    fs.access(path.join(path.dirname(chatPath), "SUMMARY.md"))
  );
});

test("rejects .marc, threads, and thread directory junctions before writes", async (t) => {
  const workspace = await tempWorkspace();
  const outside = await tempWorkspace();
  t.after(() =>
    Promise.all([
      fs.rm(workspace, { recursive: true, force: true }),
      fs.rm(outside, { recursive: true, force: true })
    ])
  );
  const outsideThread = await createThread(outside, "Outside source");
  const marcPath = path.join(workspace, ".marc");
  const outsideMarc = path.join(outside, ".marc");
  await fs.symlink(outsideMarc, marcPath, "junction");

  await assert.rejects(
    writeThreadSummary(workspace, {
      threadId: outsideThread.id,
      body: "Stay inside."
    }),
    isPathInvalid
  );
  assert.equal(
    await fileExists(
      path.join(outsideMarc, "threads", outsideThread.id, "SUMMARY.md")
    ),
    false
  );
  await fs.unlink(marcPath);
  await fs.mkdir(marcPath, { recursive: true });
  await fs.symlink(
    path.join(outsideMarc, "threads"),
    path.join(marcPath, "threads"),
    "junction"
  );

  await assert.rejects(
    writeThreadSummary(workspace, {
      threadId: outsideThread.id,
      body: "Still stay inside."
    }),
    isPathInvalid
  );
  assert.equal(
    await fileExists(path.join(marcPath, "cache", "write-locks")),
    false
  );
  assert.equal(
    await fileExists(
      path.join(outsideMarc, "threads", outsideThread.id, "SUMMARY.md")
    ),
    false
  );

  await fs.unlink(path.join(marcPath, "threads"));
  await fs.rmdir(marcPath);
  await fs.mkdir(marcPath, { recursive: true });
  const local = await createThread(workspace, "Thread directory link");
  const localThreadPath = path.join(marcPath, "threads", local.id);
  const outsideThreadPath = path.join(outside, "moved-thread");
  await fs.rename(localThreadPath, outsideThreadPath);
  await fs.symlink(outsideThreadPath, localThreadPath, "junction");
  await assert.rejects(
    writeThreadSummary(workspace, {
      threadId: local.id,
      body: "Reject linked thread."
    }),
    isPathInvalid
  );
  assert.equal(
    await fileExists(path.join(outsideThreadPath, "SUMMARY.md")),
    false
  );
});

test("rejects CHAT.md and SUMMARY.md junctions without writing through them", async (t) => {
  const chatWorkspace = await tempWorkspace();
  const summaryWorkspace = await tempWorkspace();
  const outside = await tempWorkspace();
  t.after(() =>
    Promise.all([
      fs.rm(chatWorkspace, { recursive: true, force: true }),
      fs.rm(summaryWorkspace, { recursive: true, force: true }),
      fs.rm(outside, { recursive: true, force: true })
    ])
  );
  const chatThread = await createThread(chatWorkspace, "Linked chat");
  const chatPath = path.join(
    chatWorkspace,
    ".marc",
    "threads",
    chatThread.id,
    "CHAT.md"
  );
  const outsideChat = path.join(outside, "chat-target", "CHAT.md");
  await fs.mkdir(path.dirname(outsideChat), { recursive: true });
  await fs.writeFile(outsideChat, "outside chat source", "utf8");
  await fs.unlink(chatPath);
  await fs.symlink(path.dirname(outsideChat), chatPath, "junction");
  await assert.rejects(
    writeThreadSummary(chatWorkspace, {
      threadId: chatThread.id,
      body: "Do not write through CHAT."
    }),
    isPathInvalid
  );
  assert.equal(await fs.readFile(outsideChat, "utf8"), "outside chat source");

  const summaryThread = await createThread(
    summaryWorkspace,
    "Linked summary file"
  );
  const summaryPath = path.join(
    summaryWorkspace,
    ".marc",
    "threads",
    summaryThread.id,
    "SUMMARY.md"
  );
  const outsideSummary = path.join(outside, "summary-target", "SUMMARY.md");
  await fs.mkdir(path.dirname(outsideSummary), { recursive: true });
  await fs.writeFile(outsideSummary, "outside summary source", "utf8");
  await fs.symlink(path.dirname(outsideSummary), summaryPath, "junction");
  await assert.rejects(
    writeThreadSummary(summaryWorkspace, {
      threadId: summaryThread.id,
      body: "Do not write through SUMMARY."
    }),
    isPathInvalid
  );
  assert.equal(
    await fs.readFile(outsideSummary, "utf8"),
    "outside summary source"
  );
});

async function fileExists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(
    () => true,
    () => false
  );
}
