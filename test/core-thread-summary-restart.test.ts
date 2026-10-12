import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createThread, writeThreadSummary } from "../src/core/workspace.js";
import {
  runSummaryReadProcess,
  tempWorkspace
} from "./core-thread-summary-fixtures.js";

test("reconciles the closed thread index from SUMMARY.md after process restart", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Restart reconciliation");
  await fs.writeFile(
    path.join(workspace, ".marc", "SETTINGS.md"),
    "<!-- marc-settings\nmemory.autoRebuild: false\n-->\n",
    "utf8"
  );
  const created = await writeThreadSummary(workspace, {
    threadId: thread.id,
    body: "The summary remains the durable source after restart."
  });
  const indexPath = path.join(workspace, ".marc", "cache", "thread-index.json");
  await fs.rm(indexPath, { force: true });

  const reopened = await runSummaryReadProcess(workspace, thread.id);

  assert.equal(reopened.status, "closed");
  assert.equal(reopened.summaryRevision, created.summaryRevision);
  assert.ok((reopened.closedIds as string[]).includes(thread.id));
  assert.equal(
    await fs.access(indexPath).then(
      () => true,
      () => false
    ),
    true
  );
  assert.match(
    await fs.readFile(
      path.join(workspace, ".marc", "threads", thread.id, "SUMMARY.md"),
      "utf8"
    ),
    /The summary remains the durable source after restart\./
  );
});
