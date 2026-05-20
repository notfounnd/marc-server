import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  appendMessage,
  createThread,
  initWorkspace,
  readRules,
  readThreadInfo,
  readThreadSince,
  readThreadTail
} from "../src/core/workspace.js";

async function tempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "marc-core-"));
}

test("initializes the canonical .marc layout", async () => {
  const workspace = await tempWorkspace();
  const info = await initWorkspace(workspace);

  assert.equal(info.rootPath, workspace);
  assert.equal(path.basename(info.marcPath), ".marc");
  await fs.access(path.join(workspace, ".marc", "INSTRUCTIONS.md"));
  await fs.access(path.join(workspace, ".marc", "RULES.md"));
  await fs.access(path.join(workspace, ".marc", "agents"));
  await fs.access(path.join(workspace, ".marc", "threads"));

  const rules = await readRules(workspace);
  assert.match(rules, /- Use `agent_list` to discover registered agents\./);
  assert.match(
    rules,
    /- Use `agent_read_profile` to inspect a specific agent profile\./
  );
  assert.doesNotMatch(rules, /Registered Agents \(Marckers\)/);
  assert.doesNotMatch(rules, /codex-dev/);
});

test("reads threads incrementally by message cursor", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Incremental context");
  const first = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: "First message."
  });
  const second = await appendMessage(workspace, thread.id, {
    agentId: "copilot-dev",
    body: "Second message."
  });
  const third = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: "Third message."
  });

  const incremental = await readThreadSince(workspace, thread.id, first.id);

  assert.equal(incremental.ok, true);
  assert.equal(incremental.messageCount, 3);
  assert.equal(incremental.lastMessageId, third.id);
  assert.deepEqual(
    incremental.messages.map((item) => item.id),
    [second.id, third.id]
  );
});

test("reports cursor failure without silently returning the full thread", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Missing cursor");
  const message = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: "Existing message."
  });

  const incremental = await readThreadSince(
    workspace,
    thread.id,
    "msg_missing"
  );

  assert.equal(incremental.ok, false);
  assert.equal(incremental.error, "cursor_not_found");
  assert.equal(incremental.shouldReadFullThread, true);
  assert.equal(incremental.lastMessageId, message.id);
  assert.equal(incremental.messages.length, 0);
});

test("reads cheap thread info and tail messages", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Thread metadata");
  const first = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: "First message."
  });
  const second = await appendMessage(workspace, thread.id, {
    agentId: "copilot-dev",
    body: "Second message."
  });
  const third = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: "Third message."
  });

  const info = await readThreadInfo(workspace, thread.id);
  const tail = await readThreadTail(workspace, thread.id, { limit: 2 });

  assert.equal(info.id, thread.id);
  assert.equal(info.messageCount, 3);
  assert.equal(info.lastMessageId, third.id);
  assert.equal(info.updatedAt, third.timestamp);
  assert.equal(info.summaryAvailable, false);
  assert.deepEqual(
    tail.messages.map((item) => item.id),
    [second.id, third.id]
  );
  assert.equal(tail.messageCount, 3);
  assert.equal(tail.lastMessageId, third.id);
  assert.notEqual(first.id, second.id);
});
