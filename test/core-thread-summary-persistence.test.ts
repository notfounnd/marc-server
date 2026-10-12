import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createThread, getWorkspaceInfo } from "../src/core/workspace.js";
import {
  ThreadSummaryError,
  writeThreadSummaryInWorkspace
} from "../src/core/thread-summary.js";
import {
  getSummaryPath,
  tempWorkspace
} from "./core-thread-summary-fixtures.js";

test("sanitizes source persistence failure and removes its temporary file", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Persistence failure");
  const summaryPath = getSummaryPath(workspace, thread.id);
  const info = await getWorkspaceInfo(workspace);
  await assert.rejects(
    writeThreadSummaryInWorkspace(
      info,
      {
        threadId: thread.id,
        body: "This source write must fail."
      },
      {
        rename: async () => Promise.reject(new Error("private filesystem path"))
      }
    ),
    (error: unknown) =>
      error instanceof ThreadSummaryError && error.code === "write_failed"
  );

  assert.equal(
    await fs.access(summaryPath).then(
      () => true,
      () => false
    ),
    false
  );
  assert.equal(
    (await fs.readdir(path.dirname(summaryPath))).some((name) =>
      name.startsWith(".SUMMARY.md.")
    ),
    false
  );
});
