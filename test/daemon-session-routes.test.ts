import assert from "node:assert/strict";
import test from "node:test";
import { appendMessage } from "../src/core/workspace.js";
import {
  ARCHITECT,
  get,
  registered,
  send,
  startDaemon,
  workspaceWithThread
} from "./daemon-session-http-fixtures.js";

test("GET sessions lists one slot per assignable profile with warnings and no owner token", async () => {
  const daemon = await startDaemon();
  const ws = await workspaceWithThread();
  try {
    await registered(daemon, ws.info);
    const mention = await appendMessage(ws.root, ws.threadId, {
      agentId: ARCHITECT,
      role: "architect",
      body: "Revise marc://@claude-dev e avise marc://@ui-user"
    });
    const reply = await get(
      daemon.baseUrl,
      `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/sessions`
    );
    assert.equal(reply.status, 200);
    const view = JSON.parse(reply.text) as {
      slots: Array<{ profile: string; state: string }>;
      warnings: Array<{ kind: string; profile?: string; messageIds: string[] }>;
    };
    assert.deepEqual(
      view.slots.map((slot) => slot.profile),
      ["claude-dev", ARCHITECT]
    );
    assert.deepEqual(
      view.warnings.map((warning) => [
        warning.kind,
        warning.profile,
        warning.messageIds
      ]),
      [
        ["pending_mention", "claude-dev", [mention.id]],
        ["awaiting_human", "ui-user", [mention.id]]
      ]
    );
    assert.ok(!reply.text.includes("ownerToken"));
  } finally {
    await daemon.close();
  }
});

test("acquire, owner calls and the view follow the 200 and 409 contract", async () => {
  const daemon = await startDaemon();
  const ws = await workspaceWithThread();
  try {
    await registered(daemon, ws.info);
    const base = { workspaceId: ws.info.id, threadId: ws.threadId };
    const acquire = await send(
      daemon.baseUrl,
      "POST",
      "/api/sessions/acquire",
      {
        ...base,
        profile: ARCHITECT,
        expectedGeneration: 0
      }
    );
    assert.equal(acquire.status, 200);
    const acquired = JSON.parse(acquire.text) as {
      ownerToken: string;
      generation: number;
    };
    assert.equal(acquired.generation, 1);

    const again = await send(daemon.baseUrl, "POST", "/api/sessions/acquire", {
      ...base,
      profile: ARCHITECT,
      expectedGeneration: 1
    });
    assert.equal(again.status, 409);
    assert.deepEqual(JSON.parse(again.text), {
      decision: "refused",
      reason: "reserved"
    });

    const user = await send(daemon.baseUrl, "POST", "/api/sessions/acquire", {
      ...base,
      profile: "ui-user",
      expectedGeneration: 0
    });
    assert.equal(user.status, 409);

    const call = {
      ...base,
      profile: ARCHITECT,
      ownerToken: acquired.ownerToken
    };
    const rows: Array<{
      name: string;
      path: string;
      body: unknown;
      status: number;
      reason?: string;
    }> = [
      {
        name: "heartbeat with a wrong token",
        path: "/api/sessions/heartbeat",
        body: { ...call, generation: 1, ownerToken: "x" },
        status: 409,
        reason: "not_owner"
      },
      {
        name: "heartbeat with a wrong generation",
        path: "/api/sessions/heartbeat",
        body: { ...call, generation: 9 },
        status: 409,
        reason: "generation_mismatch"
      },
      {
        name: "heartbeat with the right owner",
        path: "/api/sessions/heartbeat",
        body: { ...call, generation: 1 },
        status: 200
      },
      {
        name: "release with a wrong generation",
        path: "/api/sessions/release",
        body: { ...call, generation: 9 },
        status: 409,
        reason: "generation_mismatch"
      },
      {
        name: "release with the right owner",
        path: "/api/sessions/release",
        body: { ...call, generation: 1 },
        status: 200
      }
    ];
    for (const row of rows) {
      const reply = await send(daemon.baseUrl, "POST", row.path, row.body);
      assert.equal(reply.status, row.status, row.name);
      assert.equal(
        (JSON.parse(reply.text) as { reason?: string }).reason,
        row.reason,
        row.name
      );
      assert.ok(!reply.text.includes(acquired.ownerToken), row.name);
    }

    const view = await get(
      daemon.baseUrl,
      `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/sessions`
    );
    assert.ok(!view.text.includes(acquired.ownerToken));
    const body = JSON.parse(view.text) as {
      slots: Array<{
        profile: string;
        state: string;
        binding: { origin: string } | null;
      }>;
    };
    const architect = body.slots.find((slot) => slot.profile === ARCHITECT);
    assert.equal(architect?.state, "ended");
    assert.equal(architect?.binding?.origin, "open");
  } finally {
    await daemon.close();
  }
});
