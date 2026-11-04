import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { HOST, SESSION_A, STARTED } from "./daemon-session-fixtures.js";
import {
  ARCHITECT,
  get,
  registered,
  send,
  startDaemon,
  workspaceWithThread
} from "./daemon-session-http-fixtures.js";
import {
  agentsJson,
  startDaemonWithAgents
} from "./daemon-session-open-command-fixtures.js";

test("observe refuses bad payloads, ignores non-adopting profiles, and adopts a verified free slot", async () => {
  const daemon = await startDaemonWithAgents(
    agentsJson({ pid: 100, startedAt: STARTED, sessionId: SESSION_A })
  );
  const ws = await workspaceWithThread();
  try {
    await registered(daemon, ws.info);
    const bad = await send(daemon.baseUrl, "POST", "/api/sessions/observe", {
      workspaceId: ws.info.id
    });
    assert.equal(bad.status, 400);

    const identity = {
      nativeSessionId: SESSION_A,
      pid: 100,
      ppid: 100,
      hostId: HOST
    };
    const observed = (agentId: string) => ({
      workspaceId: ws.info.id,
      threadId: ws.threadId,
      agentId,
      observedAt: "2026-11-03T12:00:00.000Z",
      identity
    });
    const user = await send(
      daemon.baseUrl,
      "POST",
      "/api/sessions/observe",
      observed("ui-user")
    );
    assert.deepEqual(JSON.parse(user.text), {
      decision: "ignored",
      reason: "non_adopting_role"
    });
    const unknown = await send(
      daemon.baseUrl,
      "POST",
      "/api/sessions/observe",
      observed("nobody")
    );
    assert.deepEqual(JSON.parse(unknown.text), {
      decision: "ignored",
      reason: "unregistered_profile"
    });

    const adopted = await send(
      daemon.baseUrl,
      "POST",
      "/api/sessions/observe",
      observed(ARCHITECT)
    );
    assert.equal(adopted.status, 200);
    assert.deepEqual(JSON.parse(adopted.text), {
      decision: "adopted",
      generation: 1
    });

    const view = await get(
      daemon.baseUrl,
      `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/sessions`
    );
    const body = JSON.parse(view.text) as {
      slots: Array<{
        profile: string;
        state: string;
        details: { reason: string };
        binding: { origin: string } | null;
      }>;
    };
    const architect = body.slots.find((slot) => slot.profile === ARCHITECT);
    assert.equal(architect?.binding?.origin, "adopted");
    assert.equal(architect?.state, "online");
    assert.equal(architect?.details.reason, "owner_listed");
  } finally {
    await daemon.close();
  }
});

test("an unknown workspace is 404 and an invalid registry reports every slot unknown", async () => {
  const daemon = await startDaemon();
  const ws = await workspaceWithThread();
  try {
    const missing = await get(
      daemon.baseUrl,
      "/api/workspaces/nope/threads/x/sessions"
    );
    assert.equal(missing.status, 404);

    await registered(daemon, ws.info);
    await fs.writeFile(
      path.join(daemon.dataDir, "sessions.json"),
      "{ broken",
      "utf8"
    );
    const view = await get(
      daemon.baseUrl,
      `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/sessions`
    );
    const body = JSON.parse(view.text) as {
      registry: { status: string; reason: string };
      slots: Array<{ state: string; details: { reason: string } }>;
    };
    assert.deepEqual(body.registry, {
      status: "invalid",
      reason: "unreadable_json"
    });
    assert.deepEqual(
      body.slots.map((slot) => [slot.state, slot.details.reason]),
      [
        ["unknown", "registry_invalid"],
        ["unknown", "registry_invalid"]
      ]
    );
  } finally {
    await daemon.close();
  }
});
