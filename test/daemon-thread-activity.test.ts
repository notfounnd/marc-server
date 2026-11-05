import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  policyCandidate,
  validatePolicy,
  type ActivationPolicy
} from "../src/core/activation-policy.js";
import { writeThreadPolicy } from "../src/core/activation-policy-store.js";
import { appendMessage, writeThreadSummary } from "../src/core/workspace.js";
import {
  ACTIVITY_QUERY_TIMEOUT_MS,
  fetchThreadActivity
} from "../src/mcp/daemon.js";
import { buildThreadActivity } from "../src/daemon/activity-snapshot.js";
import {
  createSessionRegistry,
  type SessionProbe
} from "../src/daemon/session-registry.js";
import {
  ARCHITECT,
  TOKEN,
  get,
  registered,
  send,
  startDaemon,
  workspaceWithThread
} from "./daemon-session-http-fixtures.js";
import {
  CLOCK_ISO,
  clock,
  stateHarness,
  threadPath
} from "./daemon-thread-state-fixtures.js";
import type { ThreadActivitySnapshot } from "../src/core/thread-activity-markdown.js";

const SECRETS = [
  "native-secret-123",
  "token-secret-xyz",
  "host-secret",
  "route-session",
  "route-owner-token",
  "host-a"
];
const FREE: SessionProbe = async () => ({
  state: "unbound",
  details: {
    busy: false,
    listening: false,
    reason: "test",
    pastConflict: false
  }
});

function assertNoSecrets(text: string): void {
  for (const secret of SECRETS) {
    assert.equal(text.includes(secret), false, `activity leaked ${secret}`);
  }
}

test("the activity snapshot lists bound and posting profiles, the stage outcomes and the pause history, without any native id", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));
  const scope = { workspaceId: ws.info.id, threadId: ws.threadId };
  const registry = createSessionRegistry(
    h.dataDir,
    {
      now: clock,
      newSessionId: () => "native-secret-123",
      newOwnerToken: () => "token-secret-xyz"
    },
    h.threads
  );
  await registry.acquire(
    {
      slot: { ...scope, profile: "claude-dev" },
      expectedGeneration: 0,
      hostId: "host-secret"
    },
    FREE
  );
  await appendMessage(ws.root, ws.threadId, {
    agentId: ARCHITECT,
    role: "architect",
    body: "Review."
  });
  const policy = validatePolicy(
    policyCandidate({ enabled: true }, "rev-activity", CLOCK_ISO)
  );
  assert.equal(policy.ok, true);
  const info = ws.info;
  const activePolicy = (policy as { ok: true; policy: ActivationPolicy })
    .policy;
  await writeThreadPolicy(info, ws.threadId, activePolicy);
  await h.ledger.authorize(scope, activePolicy);
  await h.threads.update(scope, (file) => ({
    value: undefined,
    file: {
      ...file,
      activation: {
        ...file.activation!,
        stages: {
          planning: { cyclesUsed: 5, extensions: [] },
          execution: { cyclesUsed: 0, extensions: [] },
          review: { cyclesUsed: 0, extensions: [] }
        }
      }
    }
  }));
  await h.ledger.setPaused(info.id, true);
  await h.ledger.setPaused(info.id, false);

  const snapshot = await buildThreadActivity({
    workspace: info,
    threadId: ws.threadId,
    threadCreatedAt: CLOCK_ISO,
    threads: h.threads,
    workspaces: h.workspaces
  });

  assert.ok(snapshot);
  const activity = snapshot as ThreadActivitySnapshot;
  assert.deepEqual(
    activity.profiles
      .map((row) => [row.profile, row.role, row.origin, row.activations])
      .sort(),
    [
      ["claude-dev", "developer", "open", 0],
      [ARCHITECT, "architect", "none", 0]
    ]
  );
  assert.equal(
    activity.profiles.find((row) => row.profile === "claude-dev")?.startedAt,
    CLOCK_ISO
  );
  assert.deepEqual(activity.stages, [
    { id: "planning", cyclesUsed: 5, max: 5, outcome: "exhausted" },
    { id: "execution", cyclesUsed: 0, max: 5, outcome: "not_reached" },
    { id: "review", cyclesUsed: 0, max: 5, outcome: "not_reached" }
  ]);
  assert.equal(activity.policyRevision, "rev-activity");
  assert.equal(activity.pausedDuringThread, "yes");
  assert.equal(activity.conflicts, 0);
  assertNoSecrets(JSON.stringify(activity));

  await writeThreadSummary(ws.root, {
    threadId: ws.threadId,
    body: "Done.",
    activity: { status: "recorded", snapshot: activity }
  });
  const summary = await fs.readFile(
    path.join(ws.root, ".marc", "threads", ws.threadId, "SUMMARY.md"),
    "utf8"
  );
  assert.ok(summary.includes("## Activity"));
  assertNoSecrets(summary);
});

test("a thread with a corrupt state file has no activity snapshot", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));
  await fs.mkdir(path.dirname(threadPath(h.dataDir, ws.info.id, ws.threadId)), {
    recursive: true
  });
  await fs.writeFile(
    threadPath(h.dataDir, ws.info.id, ws.threadId),
    "{ broken",
    "utf8"
  );

  const snapshot = await buildThreadActivity({
    workspace: ws.info,
    threadId: ws.threadId,
    threadCreatedAt: CLOCK_ISO,
    threads: h.threads,
    workspaces: h.workspaces
  });

  assert.equal(snapshot, undefined);
});

test("the daemon route returns the snapshot, is 404 for an unknown thread, and is 503 for a corrupt thread", async (t) => {
  const daemon = await startDaemon();
  t.after(() => daemon.close());
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));
  await registered(daemon, ws.info);
  const base = {
    workspaceId: ws.info.id,
    threadId: ws.threadId,
    profile: "claude-dev",
    expectedGeneration: 0
  };
  await send(daemon.baseUrl, "POST", "/api/sessions/acquire", base);
  const route = `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/activity`;

  const ok = await get(daemon.baseUrl, route);
  assert.equal(ok.status, 200);
  const body = JSON.parse(ok.text) as {
    profiles: Array<{ profile: string; origin: string }>;
  };
  assert.deepEqual(
    body.profiles.map((row) => [row.profile, row.origin]),
    [["claude-dev", "open"]]
  );
  assertNoSecrets(ok.text);

  const unknown = await get(
    daemon.baseUrl,
    `/api/workspaces/${ws.info.id}/threads/nope/activity`
  );
  assert.equal(unknown.status, 404);

  const threadFile = path.join(
    daemon.dataDir,
    "threads",
    ws.info.id,
    `${ws.threadId}.json`
  );
  await fs.writeFile(threadFile, "{ broken", "utf8");
  const corrupt = await get(daemon.baseUrl, route);
  assert.equal(corrupt.status, 503);
});

test("the closing summary asks a configured daemon, which answers with the recorded snapshot", async (t) => {
  const daemon = await startDaemon();
  t.after(() => daemon.close());
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));
  await registered(daemon, ws.info);

  const recorded = await fetchThreadActivity(
    { daemonUrl: daemon.baseUrl, token: TOKEN },
    ws.root,
    ws.threadId
  );
  assert.equal(recorded?.status, "recorded");
  assert.equal(ACTIVITY_QUERY_TIMEOUT_MS, 2000);
});
