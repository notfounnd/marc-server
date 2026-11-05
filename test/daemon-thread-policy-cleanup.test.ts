import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  POLICY_FILE_NAME,
  removeThreadPolicy
} from "../src/core/activation-policy-store.js";
import {
  createThread,
  initWorkspace,
  writeThreadSummary
} from "../src/core/workspace.js";
import {
  closedThreadChecker,
  forgetIfClosed,
  removeClosedThreads
} from "../src/daemon/thread-cleanup.js";
import { listNames, stateHarness } from "./daemon-thread-state-fixtures.js";

const EMPTY_FILE = { version: 1 as const, generation: 1, slots: {} };

function policyFile(marcPath: string, threadId: string): string {
  return path.join(marcPath, "threads", threadId, POLICY_FILE_NAME);
}

async function exists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(
    () => true,
    () => false
  );
}

async function setup(t: TestContext, label: string) {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const root = await fs.mkdtemp(path.join(h.dataDir, "..", label));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const info = await initWorkspace(root);
  return { h, root, info };
}

test("startup removes the policy file of a closed thread without state, keeps the open one, and leaves the rest of the folder", async (t) => {
  const { h, root, info } = await setup(t, "marc-policy-startup-");
  const closed = await createThread(root, "Closed work");
  const open = await createThread(root, "Open work");
  await writeThreadSummary(root, { threadId: closed.id, body: "Done." });
  await fs.writeFile(policyFile(info.marcPath, closed.id), "{}\n");
  await fs.writeFile(policyFile(info.marcPath, open.id), "{}\n");

  await removeClosedThreads([info], h.threads);

  assert.equal(await exists(policyFile(info.marcPath, closed.id)), false);
  assert.equal(await exists(policyFile(info.marcPath, open.id)), true);
  assert.equal(
    await exists(path.join(info.marcPath, "threads", closed.id, "SUMMARY.md")),
    true
  );
});

test("a second cleanup pass changes nothing and does not fail on the missing policy file", async (t) => {
  const { h, root, info } = await setup(t, "marc-policy-second-");
  const closed = await createThread(root, "Closed work");
  await writeThreadSummary(root, { threadId: closed.id, body: "Done." });
  await fs.writeFile(policyFile(info.marcPath, closed.id), "{}\n");

  await removeClosedThreads([info], h.threads);
  await removeClosedThreads([info], h.threads);

  assert.equal(await exists(policyFile(info.marcPath, closed.id)), false);
});

test("removing a policy file that is already gone is not an error", async (t) => {
  const { root, info } = await setup(t, "marc-policy-absent-");
  const open = await createThread(root, "Never had a policy");

  await removeThreadPolicy(info, open.id);

  assert.equal(await exists(policyFile(info.marcPath, open.id)), false);
});

test("the folder watcher forgets a closed thread's state and policy, and leaves an open thread alone", async (t) => {
  const { h, root, info } = await setup(t, "marc-policy-watch-");
  const closed = await createThread(root, "Closing work");
  const open = await createThread(root, "Still open");
  const closedScope = { workspaceId: info.id, threadId: closed.id };
  const openScope = { workspaceId: info.id, threadId: open.id };
  await h.threads.update(closedScope, () => ({
    value: undefined,
    file: EMPTY_FILE
  }));
  await h.threads.update(openScope, () => ({
    value: undefined,
    file: EMPTY_FILE
  }));
  await fs.writeFile(policyFile(info.marcPath, closed.id), "{}\n");
  await fs.writeFile(policyFile(info.marcPath, open.id), "{}\n");
  await writeThreadSummary(root, { threadId: closed.id, body: "Done." });
  const store = { getWorkspace: async () => info } as never;
  assert.equal(await closedThreadChecker(store)(closedScope), true);

  await forgetIfClosed(store, h.threads, info, closed.id);
  await forgetIfClosed(store, h.threads, info, open.id);

  assert.equal(await exists(policyFile(info.marcPath, closed.id)), false);
  assert.equal(await exists(policyFile(info.marcPath, open.id)), true);
  assert.deepEqual(await listNames(path.join(h.dataDir, "threads", info.id)), [
    `${open.id}.json`,
    `${open.id}.meta.json`
  ]);
});

test("a workspace that cannot be read keeps the state and the policy file of its threads", async (t) => {
  const { h, root, info } = await setup(t, "marc-policy-unreadable-");
  const closed = await createThread(root, "Closed work");
  const scope = { workspaceId: info.id, threadId: closed.id };
  await writeThreadSummary(root, { threadId: closed.id, body: "Done." });
  await h.threads.update(scope, () => ({ value: undefined, file: EMPTY_FILE }));
  await fs.writeFile(policyFile(info.marcPath, closed.id), "{}\n");
  const unreadable = { ...info, marcPath: path.join(root, "no-such-marc") };

  await removeClosedThreads([unreadable], h.threads);

  assert.equal(await exists(policyFile(info.marcPath, closed.id)), true);
  assert.deepEqual(await listNames(path.join(h.dataDir, "threads", info.id)), [
    `${closed.id}.json`,
    `${closed.id}.meta.json`
  ]);
});
