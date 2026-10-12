import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createThread, getWorkspaceInfo } from "../src/core/workspace.js";
import { ThreadSummaryError } from "../src/core/thread-summary.js";
import { inspectThreadFiles } from "../src/core/thread-summary-paths.js";
import {
  createThreadSummaryPathMetadataFixture,
  type SummaryPathNode,
  type SummaryPathFixtureOverrides
} from "./core-thread-summary-path-fixtures.js";
import { tempWorkspace } from "./core-thread-summary-fixtures.js";

test("rejects path errors, symbolic links, and escaped summary paths", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Summary path metadata");
  const info = await getWorkspaceInfo(workspace);
  const threadsPath = path.join(info.marcPath, "threads");
  const threadPath = path.join(threadsPath, thread.id);
  const chatPath = path.join(threadPath, "CHAT.md");
  const summaryPath = path.join(threadPath, "SUMMARY.md");
  const outside = path.join(path.dirname(workspace), "outside-fixture");
  const missingSummaryFixture = createThreadSummaryPathMetadataFixture(
    info,
    thread.id
  );
  const missingSummaryFiles = await inspectThreadFiles(
    info,
    thread.id,
    missingSummaryFixture
  );
  assert.deepEqual(missingSummaryFiles, {
    threadPath,
    threadPathReal: await fs.realpath(threadPath),
    chatPath,
    summaryPath
  });

  const metadataEntries = [
    {
      name: "rejects an .marc symlink",
      node: { path: info.marcPath, kind: "symbolic-link", realPath: outside },
      code: "path_invalid"
    },
    {
      name: "rejects an .marc path outside its parent",
      node: { path: info.marcPath, kind: "directory", realPath: outside },
      code: "path_invalid"
    },
    {
      name: "rejects a threads symlink",
      node: { path: threadsPath, kind: "symbolic-link", realPath: outside },
      code: "path_invalid"
    },
    {
      name: "rejects a threads path outside its parent",
      node: { path: threadsPath, kind: "directory", realPath: outside },
      code: "path_invalid"
    },
    {
      name: "rejects a thread directory symlink",
      node: { path: threadPath, kind: "symbolic-link", realPath: outside },
      code: "path_invalid"
    },
    {
      name: "rejects a thread directory outside its parent",
      node: { path: threadPath, kind: "directory", realPath: outside },
      code: "path_invalid"
    },
    {
      name: "rejects a CHAT.md symlink",
      node: { path: chatPath, kind: "symbolic-link", realPath: outside },
      code: "path_invalid"
    },
    {
      name: "rejects CHAT.md outside its parent",
      node: { path: chatPath, kind: "file", realPath: outside },
      code: "path_invalid"
    },
    {
      name: "rejects a SUMMARY.md symlink",
      node: { path: summaryPath, kind: "symbolic-link", realPath: outside },
      code: "path_invalid"
    },
    {
      name: "rejects SUMMARY.md outside its parent",
      node: { path: summaryPath, kind: "file", realPath: outside },
      code: "path_invalid"
    }
  ] satisfies Array<{
    name: string;
    node: SummaryPathNode;
    code: string;
  }>;
  for (const scenario of metadataEntries) {
    await t.test(scenario.name, async () => {
      const fixture = createThreadSummaryPathMetadataFixture(info, thread.id, {
        entries: [scenario.node]
      });
      await assert.rejects(
        inspectThreadFiles(info, thread.id, fixture),
        (error: unknown) =>
          error instanceof ThreadSummaryError && error.code === scenario.code
      );
    });
  }

  const pathErrorEntries = [
    {
      name: "maps EACCES from .marc lstat to path_invalid",
      overrides: { lstatErrors: [{ path: info.marcPath, code: "EACCES" }] },
      code: "path_invalid"
    },
    {
      name: "maps missing CHAT.md lstat to thread_not_found",
      overrides: { lstatErrors: [{ path: chatPath, code: "ENOENT" }] },
      code: "thread_not_found"
    },
    {
      name: "maps CHAT.md realpath errors to path_invalid",
      overrides: { realpathErrors: [{ path: chatPath, code: "EACCES" }] },
      code: "path_invalid"
    }
  ] satisfies Array<{
    name: string;
    overrides: SummaryPathFixtureOverrides;
    code: string;
  }>;
  for (const scenario of pathErrorEntries) {
    await t.test(scenario.name, async () => {
      const fixture = createThreadSummaryPathMetadataFixture(
        info,
        thread.id,
        scenario.overrides
      );
      await assert.rejects(
        inspectThreadFiles(info, thread.id, fixture),
        (error: unknown) =>
          error instanceof ThreadSummaryError && error.code === scenario.code
      );
    });
  }

  await t.test("maps root realpath errors to thread_not_found", async () => {
    const fixture = createThreadSummaryPathMetadataFixture(info, thread.id, {
      realpathErrors: [{ path: info.rootPath, code: "EACCES" }]
    });
    await assert.rejects(
      inspectThreadFiles(info, thread.id, fixture),
      (error: unknown) =>
        error instanceof ThreadSummaryError && error.code === "thread_not_found"
    );
  });
});
