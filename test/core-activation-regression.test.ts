import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readThreadPolicy } from "../src/core/activation-policy-store.js";
import {
  reconcileMentions,
  type ReconcileInput
} from "../src/core/thread-mentions.js";
import type { ChatMessage } from "../src/core/types.js";
import {
  createThread,
  initWorkspace,
  listThreads
} from "../src/core/workspace.js";

function message(
  id: string,
  agentId: string,
  role: string,
  body: string
): ChatMessage {
  return {
    id,
    threadId: "thread-1",
    timestamp: "2026-11-04T12:00:00.000Z",
    agentId,
    role,
    body,
    artifacts: []
  };
}

const MESSAGES: ChatMessage[] = [
  message("msg_user", "ui-user", "user", "Start the review."),
  message(
    "msg_review",
    "claude-software-architect",
    "architect",
    "Please review marc://@claude-dev now."
  ),
  message(
    "msg_dev",
    "claude-dev",
    "developer",
    "Quoting marc://@claude-dev in a progress note."
  )
];

const INPUT: ReconcileInput = {
  messages: MESSAGES,
  afterMessageId: "msg_user",
  mention: "claude-dev",
  architects: ["claude-software-architect"],
  maxChain: 3,
  closed: false
};

test("a thread without a policy keeps the manual mention decision unchanged", () => {
  assert.deepEqual(reconcileMentions(INPUT), {
    status: "mention",
    messageIds: ["msg_review"],
    authors: [{ agentId: "claude-software-architect", role: "architect" }],
    chain: { count: 0, max: 3 }
  });
});

test("the mention decision still ends a closed thread and reports a missing cursor", () => {
  assert.deepEqual(reconcileMentions({ ...INPUT, closed: true }), {
    status: "thread_closed"
  });
  assert.deepEqual(
    reconcileMentions({ ...INPUT, afterMessageId: "msg_missing" }),
    { status: "cursor_not_found" }
  );
});

test("a thread folder without policy.json reads as no policy, which is disabled", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marc-regression-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const info = await initWorkspace(root);
  const thread = await createThread(root, "Regression thread");

  assert.deepEqual(await readThreadPolicy(info, thread.id), {
    status: "none"
  });
  assert.deepEqual(
    (await listThreads(root)).map((item) => item.id),
    [thread.id]
  );
});
