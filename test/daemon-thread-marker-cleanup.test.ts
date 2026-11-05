import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { writeFileAtomically } from "../src/core/write-coordination.js";
import {
  createThread,
  initWorkspace,
  writeThreadSummary
} from "../src/core/workspace.js";
import {
  closedThreadChecker,
  removeClosedThreads
} from "../src/daemon/thread-cleanup.js";
import { listNames, stateHarness } from "./daemon-thread-state-fixtures.js";

/** Every name left in a thread's folder. An empty list means neither the data file nor the marker remains. */
async function folderOf(
  dataDir: string,
  workspaceId: string
): Promise<string[]> {
  return listNames(path.join(dataDir, "threads", workspaceId)).catch(() => []);
}

const EMPTY_FILE = { version: 1 as const, generation: 1, slots: {} };

test("closure removes the data file and the marker together, through the same queue as every write", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const root = await fs.mkdtemp(
    path.join(h.dataDir, "..", "marc-marker-closure-")
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const info = await initWorkspace(root);
  const thread = await createThread(root, "Closing work");
  const scope = { workspaceId: info.id, threadId: thread.id };
  await h.threads.update(scope, () => ({ value: undefined, file: EMPTY_FILE }));
  assert.equal((await folderOf(h.dataDir, info.id)).length, 2);

  await writeThreadSummary(root, { threadId: thread.id, body: "Done." });
  const isClosed = closedThreadChecker({
    getWorkspace: async () => info
  } as never);
  assert.equal(await isClosed(scope), true);
  await h.threads.remove(scope);

  assert.deepEqual(await folderOf(h.dataDir, info.id), []);
});

test("startup removes both the data file and the marker of a closed thread, and an orphan marker left by an interrupted removal", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const root = await fs.mkdtemp(
    path.join(h.dataDir, "..", "marc-marker-startup-")
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const info = await initWorkspace(root);
  const closed = await createThread(root, "Closed while down");
  const orphan = await createThread(root, "Orphan marker");
  await h.threads.update({ workspaceId: info.id, threadId: closed.id }, () => ({
    value: undefined,
    file: EMPTY_FILE
  }));
  await writeThreadSummary(root, { threadId: closed.id, body: "Done." });
  await writeFileAtomically(
    path.join(h.dataDir, "threads", info.id, `${orphan.id}.meta.json`),
    "{}\n"
  );
  await writeThreadSummary(root, { threadId: orphan.id, body: "Done too." });

  await removeClosedThreads([info], h.threads);

  assert.deepEqual(await folderOf(h.dataDir, info.id), []);
});

test("startup keeps the data file and marker of an open thread, and a second pass changes nothing", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const root = await fs.mkdtemp(
    path.join(h.dataDir, "..", "marc-marker-open-")
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const info = await initWorkspace(root);
  const open = await createThread(root, "Still open");
  await h.threads.update({ workspaceId: info.id, threadId: open.id }, () => ({
    value: undefined,
    file: EMPTY_FILE
  }));

  await removeClosedThreads([info], h.threads);
  await removeClosedThreads([info], h.threads);

  assert.deepEqual(await folderOf(h.dataDir, info.id), [
    `${open.id}.json`,
    `${open.id}.meta.json`
  ]);
});
