import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  validatePolicy,
  policyCandidate,
  type ActivationPolicy
} from "../src/core/activation-policy.js";
import { writeThreadPolicy } from "../src/core/activation-policy-store.js";
import { appendMessage, initWorkspace } from "../src/core/workspace.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import { runWaitCommand } from "../src/cli-wait-command.js";
import { workspaceWithThread } from "./daemon-session-http-fixtures.js";
import { CLOCK_ISO } from "./daemon-thread-state-fixtures.js";

type Printed = {
  status: string;
  exitCode: number;
  messageIds?: string[];
  next: string;
};

/** A wait over the real command: the cursor is the last message before the test's own writes. */
async function startWait(
  root: string,
  threadId: string,
  since: string
): Promise<{ done: Promise<number>; lines: string[] }> {
  const lines: string[] = [];
  const done = runWaitCommand(
    {
      workspace: root,
      thread: threadId,
      mention: "claude-dev",
      since,
      session: "session-under-test",
      "data-dir": path.join(root, "no-daemon"),
      "daemon-url": "http://127.0.0.1:1",
      "timeout-minutes": "2"
    },
    { sessionDefault: undefined, print: (line) => lines.push(line) }
  );
  return { done, lines };
}

async function policyFile(
  root: string,
  threadId: string,
  enabled: boolean,
  info: WorkspaceInfo
): Promise<void> {
  const result = validatePolicy(
    policyCandidate({ enabled }, `rev-${enabled ? "on" : "off"}`, CLOCK_ISO)
  );
  const policy = (result as { ok: true; policy: ActivationPolicy }).policy;
  await writeThreadPolicy(info, threadId, policy);
  const file = path.join(root, ".marc", "threads", threadId, "policy.json");
  assert.ok(await fs.stat(file));
}

/** An F3a version 1 file, as an earlier build left it. Read as outdated, it still governs an enabled thread. */
async function legacyPolicyFile(
  root: string,
  threadId: string,
  enabled: boolean
): Promise<void> {
  const directory = path.join(root, ".marc", "threads", threadId);
  await fs.mkdir(directory, { recursive: true });
  const legacy = {
    version: 1,
    revision: "rev-legacy",
    enabled,
    mode: "confirm",
    participants: ["claude-dev"],
    stages: [
      {
        id: "proposta",
        description: "Proposal",
        maxPasses: 3,
        exitCondition: ""
      }
    ],
    attemptCap: 2,
    pendingTtlMinutes: 1440,
    updatedAt: CLOCK_ISO
  };
  await fs.writeFile(
    path.join(directory, "policy.json"),
    JSON.stringify(legacy)
  );
}

function printedOf(lines: string[]): Printed {
  return JSON.parse(lines.join("")) as Printed;
}

async function seededWorkspace(t: { after(fn: () => unknown): void }): Promise<{
  root: string;
  info: WorkspaceInfo;
  threadId: string;
  since: string;
}> {
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));
  const info = await initWorkspace(ws.root);
  const before = await appendMessage(ws.root, ws.threadId, {
    agentId: "ui-user",
    role: "user",
    body: "Start."
  });
  return { root: ws.root, info, threadId: ws.threadId, since: before.id };
}

test("a thread whose policy is enabled at the start exits 9 with daemon_unavailable when no daemon answers, and no mention is released", async (t) => {
  const ws = await seededWorkspace(t);
  await appendMessage(ws.root, ws.threadId, {
    agentId: "claude-software-architect",
    role: "architect",
    body: "Please review marc://@claude-dev."
  });
  await policyFile(ws.root, ws.threadId, true, ws.info);

  const wait = await startWait(ws.root, ws.threadId, ws.since);
  const code = await wait.done;

  const line = printedOf(wait.lines);
  assert.deepEqual(
    [code, line.status, line.exitCode, line.messageIds],
    [9, "daemon_unavailable", 9, undefined]
  );
  assert.ok(line.next.includes("daemon"));
});

test("a policy enabled while the wait runs ends it on the next tick with exit 9, and the mention that arrived is not released", async (t) => {
  const ws = await seededWorkspace(t);
  const wait = await startWait(ws.root, ws.threadId, ws.since);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await policyFile(ws.root, ws.threadId, true, ws.info);
  await appendMessage(ws.root, ws.threadId, {
    agentId: "claude-software-architect",
    role: "architect",
    body: "Please review marc://@claude-dev."
  });

  const code = await wait.done;

  const line = printedOf(wait.lines);
  assert.deepEqual(
    [code, line.status, line.messageIds],
    [9, "daemon_unavailable", undefined]
  );
});

test("a disabled policy keeps the manual flow: the mention is released with exit 0", async (t) => {
  const ws = await seededWorkspace(t);
  await policyFile(ws.root, ws.threadId, false, ws.info);
  await appendMessage(ws.root, ws.threadId, {
    agentId: "claude-software-architect",
    role: "architect",
    body: "Please review marc://@claude-dev."
  });

  const wait = await startWait(ws.root, ws.threadId, ws.since);
  const code = await wait.done;

  assert.deepEqual([code, printedOf(wait.lines).status], [0, "mention"]);
});

test("a disabled policy saved while the wait runs does not end it, and the next mention is released", async (t) => {
  const ws = await seededWorkspace(t);
  await policyFile(ws.root, ws.threadId, false, ws.info);
  const wait = await startWait(ws.root, ws.threadId, ws.since);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await policyFile(ws.root, ws.threadId, false, ws.info);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await appendMessage(ws.root, ws.threadId, {
    agentId: "claude-software-architect",
    role: "architect",
    body: "Please review marc://@claude-dev."
  });

  const code = await wait.done;

  assert.deepEqual([code, printedOf(wait.lines).status], [0, "mention"]);
});

test("an enabled F3a version 1 policy still governs the thread: exit 9 without a daemon, and nothing is released", async (t) => {
  const ws = await seededWorkspace(t);
  await legacyPolicyFile(ws.root, ws.threadId, true);
  await appendMessage(ws.root, ws.threadId, {
    agentId: "claude-software-architect",
    role: "architect",
    body: "Please review marc://@claude-dev."
  });

  const wait = await startWait(ws.root, ws.threadId, ws.since);
  const code = await wait.done;

  assert.deepEqual(
    [code, printedOf(wait.lines).status],
    [9, "daemon_unavailable"]
  );
});

test("a thread with no policy keeps the manual flow unchanged: regression", async (t) => {
  const ws = await seededWorkspace(t);
  await appendMessage(ws.root, ws.threadId, {
    agentId: "claude-software-architect",
    role: "architect",
    body: "Please review marc://@claude-dev."
  });

  const wait = await startWait(ws.root, ws.threadId, ws.since);
  const code = await wait.done;

  assert.deepEqual([code, printedOf(wait.lines).status], [0, "mention"]);
});
