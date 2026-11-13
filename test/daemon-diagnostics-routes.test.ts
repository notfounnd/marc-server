import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import type { ProcessTableRead } from "../src/core/process-table.js";
import type { ThreadDiagnostics } from "../src/daemon/diagnostics-view.js";
import {
  ARCHITECT,
  TOKEN,
  get,
  send,
  type LiveProcess
} from "./daemon-session-http-fixtures.js";
import {
  CLIENT_PID,
  CODEX,
  SESSION,
  mention,
  patchStateFile,
  reservationBody,
  started,
  tableOf,
  TREE
} from "./daemon-activation-reservation-fixtures.js";

/** A live client of another session on the same machine. Its rows must never reach the view. */
const OTHER: LiveProcess = {
  pid: 5000,
  sessionId: "session-other",
  startedAt: 3000
};

/** The parts of the thread state file these tests read and patch. */
type StateFile = {
  slots: Record<string, { profile: string; owner: Record<string, unknown> }>;
  reservations?: Array<Record<string, unknown>>;
  supervision?: {
    records: Array<Record<string, unknown>>;
    floors: Record<string, string>;
  };
};

function codexBinding(file: StateFile) {
  return Object.values(file.slots).find((item) => item.profile === CODEX);
}

async function diagnosticsOf(
  baseUrl: string,
  workspaceId: string,
  threadId: string
): Promise<ThreadDiagnostics> {
  const reply = await get(
    baseUrl,
    `/api/workspaces/${workspaceId}/threads/${threadId}/diagnostics`
  );
  assert.equal(reply.status, 200);
  return JSON.parse(reply.text) as ThreadDiagnostics;
}

test("the diagnostics name the bound slot, its client process and its reservation", async (t) => {
  const { daemon, ws, base } = await started(
    t,
    tableOf({ status: "available", rows: TREE }),
    [OTHER]
  );
  const message = await appendMessageInWorkspace(ws.info, ws.threadId, {
    agentId: ARCHITECT,
    body: mention(),
    role: "architect"
  });
  await send(
    daemon.baseUrl,
    "POST",
    `${base}/reservations`,
    reservationBody(message.id)
  );
  const view = await diagnosticsOf(daemon.baseUrl, ws.info.id, ws.threadId);
  assert.deepEqual(view.registry, { status: "ready" });
  assert.deepEqual(view.sources, {
    agents: { status: "available" },
    processes: { status: "available" }
  });
  const slot = view.slots.find((item) => item.profile === CODEX);
  assert.ok(slot);
  assert.equal(slot.binding.nativeSessionId, SESSION);
  assert.equal(slot.binding.clientPid, CLIENT_PID);
  assert.equal(slot.binding.clientStartedAt, 1000);
  assert.equal(typeof slot.state.state, "string");
  assert.deepEqual(
    slot.processes.map((item) => [item.pid, item.startedAt, item.sessionId]),
    [[CLIENT_PID, 1000, SESSION]]
  );
  assert.equal(view.reservations.length, 1);
  assert.equal(view.reservations[0].messageId, message.id);
  assert.equal(view.reservations[0].status, "granted");
});

test("the view never carries the owner token, run ids, another session or a table row", async (t) => {
  const { daemon, ws, base } = await started(
    t,
    tableOf({ status: "available", rows: TREE }),
    [OTHER]
  );
  const message = await appendMessageInWorkspace(ws.info, ws.threadId, {
    agentId: ARCHITECT,
    body: mention(),
    role: "architect"
  });
  await send(
    daemon.baseUrl,
    "POST",
    `${base}/reservations`,
    reservationBody(message.id, { runId: "run-secret-1" })
  );
  await patchStateFile<StateFile>(
    daemon.dataDir,
    ws.info.id,
    ws.threadId,
    (file) => {
      const binding = codexBinding(file);
      assert.ok(binding);
      binding.owner.ownerToken = "owner-secret-token";
      file.supervision = {
        floors: {},
        records: [
          {
            messageId: "msg_card_fixture",
            messageAt: "2026-11-03T12:00:00.000Z",
            recipient: CODEX,
            stage: "planning",
            status: "running",
            createdAt: "2026-11-03T12:00:00.000Z",
            expiresAt: "2026-11-03T12:30:00.000Z",
            attempt: 1,
            runId: "card-run-secret",
            turn: {
              generation: 1,
              mode: "new",
              fingerprint: "fingerprint-secret",
              continuation: false,
              pid: 6000,
              startedAt: "2026-11-03T12:00:01.000Z",
              deadlineAt: "2026-11-03T12:10:00.000Z"
            }
          }
        ]
      };
    }
  );
  const reply = await get(
    daemon.baseUrl,
    `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/diagnostics`
  );
  assert.equal(reply.status, 200);
  const secrets = [
    TOKEN,
    "owner-secret-token",
    "run-secret-1",
    "card-run-secret",
    "fingerprint-secret",
    "session-other",
    "runId",
    "ownerToken",
    "ppid"
  ];
  for (const secret of secrets) {
    assert.equal(reply.text.includes(secret), false, `leaked ${secret}`);
  }
  const view = JSON.parse(reply.text) as ThreadDiagnostics;
  assert.equal(view.supervision[0].turn?.pid, 6000);
});

/** A workspace or a thread the daemon does not know answers 404, as every thread route does. */
test("an unknown workspace or thread answers 404", async (t) => {
  const { daemon, ws } = await started(t);
  const rows = [
    {
      name: "an unknown workspace",
      route: `/api/workspaces/no-such-workspace/threads/${ws.threadId}/diagnostics`
    },
    {
      name: "an unknown thread",
      route: `/api/workspaces/${ws.info.id}/threads/no-such-thread/diagnostics`
    }
  ];
  for (const row of rows) {
    const reply = await get(daemon.baseUrl, row.route);
    assert.equal(reply.status, 404, row.name);
  }
});

/**
 * A SUMMARY.md closes the thread, and the daemon then forgets its state (thread-cleanup). The route still
 * answers 200 with a readable registry; whether the forgetting has run yet is not asserted, so the test does
 * not depend on the watcher's timing.
 */
test("a closed thread stays readable", async (t) => {
  const { daemon, ws } = await started(t);
  await fs.writeFile(
    path.join(ws.root, ".marc", "threads", ws.threadId, "SUMMARY.md"),
    "# Summary\n"
  );
  const view = await diagnosticsOf(daemon.baseUrl, ws.info.id, ws.threadId);
  assert.deepEqual(view.registry, { status: "ready" });
  assert.deepEqual(view.sources.agents, { status: "available" });
});

test("an invalid thread state answers 200 with its registry reason", async (t) => {
  const { daemon, ws, base } = await started(t);
  const message = await appendMessageInWorkspace(ws.info, ws.threadId, {
    agentId: ARCHITECT,
    body: mention(),
    role: "architect"
  });
  await send(
    daemon.baseUrl,
    "POST",
    `${base}/reservations`,
    reservationBody(message.id)
  );
  await patchStateFile<StateFile>(
    daemon.dataDir,
    ws.info.id,
    ws.threadId,
    (file) => {
      const first = file.reservations?.[0];
      assert.ok(first);
      first.identityCheck = "not_a_check";
    }
  );
  const view = await diagnosticsOf(daemon.baseUrl, ws.info.id, ws.threadId);
  assert.equal(view.registry.status, "invalid");
  assert.equal(typeof (view.registry as { reason?: unknown }).reason, "string");
  assert.deepEqual(view.slots, []);
  assert.deepEqual(view.reservations, []);
});

const UNREADABLE: ProcessTableRead = {
  status: "unavailable",
  reason: "command_failed"
};

test("an unreadable process table is named in the sources", async (t) => {
  const { daemon, ws } = await started(t, tableOf(UNREADABLE));
  const view = await diagnosticsOf(daemon.baseUrl, ws.info.id, ws.threadId);
  assert.deepEqual(view.sources.processes, {
    status: "unavailable",
    reason: "command_failed"
  });
  assert.deepEqual(view.sources.agents, { status: "available" });
});
