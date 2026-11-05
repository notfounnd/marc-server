import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeThreadPolicy } from "../src/core/activation-policy-store.js";
import { messagesOfThreadInWorkspace } from "../src/core/threads.js";
import { createThread, initWorkspace } from "../src/core/workspace.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import { postUiMessageIn } from "../src/daemon/activation-stamp-store.js";
import type { ThreadStore } from "../src/daemon/thread-store.js";
import {
  policyFor,
  stateHarness,
  threadPath
} from "./daemon-thread-state-fixtures.js";

async function workspaceWithThread(): Promise<{
  info: WorkspaceInfo;
  threadId: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marc-ui-post-"));
  const info = await initWorkspace(root);
  const thread = await createThread(root, "UI post test");
  return { info, threadId: thread.id };
}

const INPUT = {
  agentId: "ui-user",
  body: "marc://@codex-software-architect please check the plan.",
  role: "user"
};

test("with the policy enabled, the append and the origin record happen in one step of the queue", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const { info, threadId } = await workspaceWithThread();
  t.after(() => fs.rm(info.rootPath, { recursive: true, force: true }));
  await writeThreadPolicy(info, threadId, policyFor("rev-1"));

  const steps: string[] = [];
  const recording = {
    update: async (
      scope: unknown,
      step: (file: {
        version: 1;
        generation: number;
        slots: Record<string, never>;
      }) => Promise<{ value: unknown; file?: { uiMessages?: unknown[] } }>
    ) => {
      steps.push("enter");
      const next = await step({ version: 1, generation: 0, slots: {} });
      steps.push(`uiMessages:${next.file?.uiMessages?.length ?? 0}`);
      steps.push(
        `chat:${(await messagesOfThreadInWorkspace(info, threadId)).length}`
      );
      return { status: "done" as const, value: next.value };
    }
  } as unknown as ThreadStore;

  const message = await postUiMessageIn(
    { ...h, threads: recording },
    info,
    threadId,
    INPUT
  );
  assert.equal(message.agentId, "ui-user");
  assert.deepEqual(steps, ["enter", "uiMessages:1", "chat:1"]);
});

test("an invalid state never blocks a human post: the message is appended, and no origin record is written", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const { info, threadId } = await workspaceWithThread();
  t.after(() => fs.rm(info.rootPath, { recursive: true, force: true }));
  await writeThreadPolicy(info, threadId, policyFor("rev-1"));
  await fs.mkdir(path.dirname(threadPath(h.dataDir, info.id, threadId)), {
    recursive: true
  });
  await fs.writeFile(threadPath(h.dataDir, info.id, threadId), "not json");

  const message = await postUiMessageIn(h, info, threadId, INPUT);
  const messages = await messagesOfThreadInWorkspace(info, threadId);
  assert.deepEqual(
    messages.map((item) => item.id),
    [message.id]
  );
  assert.equal(
    await fs.readFile(threadPath(h.dataDir, info.id, threadId), "utf8"),
    "not json"
  );
});

test("a state write that fails after the append returns the message once, and its mention stays ineligible", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const { info, threadId } = await workspaceWithThread();
  t.after(() => fs.rm(info.rootPath, { recursive: true, force: true }));
  await writeThreadPolicy(info, threadId, policyFor("rev-1"));

  let calls = 0;
  const failingWrite = {
    update: async (
      _scope: unknown,
      step: (file: Record<string, unknown>) => Promise<unknown>
    ) => {
      calls += 1;
      await step({ version: 1, generation: 0, slots: {} });
      throw new Error("disk full");
    }
  } as unknown as ThreadStore;

  const message = await postUiMessageIn(
    { ...h, threads: failingWrite },
    info,
    threadId,
    INPUT
  );
  assert.equal(calls, 1);
  const messages = await messagesOfThreadInWorkspace(info, threadId);
  assert.deepEqual(
    messages.map((item) => item.id),
    [message.id]
  );
  const state = await fs
    .stat(threadPath(h.dataDir, info.id, threadId))
    .catch(() => undefined);
  assert.equal(state, undefined);
});

test("an append that fails propagates its error", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const { info } = await workspaceWithThread();
  t.after(() => fs.rm(info.rootPath, { recursive: true, force: true }));
  await assert.rejects(postUiMessageIn(h, info, "thread-without-chat", INPUT));
});

test("with the policy disabled, a UI post creates no state file", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const { info, threadId } = await workspaceWithThread();
  t.after(() => fs.rm(info.rootPath, { recursive: true, force: true }));

  const message = await postUiMessageIn(h, info, threadId, INPUT);
  const messages = await messagesOfThreadInWorkspace(info, threadId);
  assert.deepEqual(
    messages.map((item) => item.id),
    [message.id]
  );
  await assert.rejects(fs.stat(threadPath(h.dataDir, info.id, threadId)));
});
