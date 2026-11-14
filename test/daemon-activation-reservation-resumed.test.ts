import assert from "node:assert/strict";
import test from "node:test";
import type { ProcessRow } from "../src/core/process-table.js";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import { AGENTS_CACHE_MS } from "../src/daemon/presence.js";
import { ARCHITECT, send } from "./daemon-session-http-fixtures.js";
import {
  mention,
  parse,
  reservationBody,
  SESSION,
  started,
  tableOf,
  WAITER_PID
} from "./daemon-activation-reservation-fixtures.js";

/** The process that resumed the bound session: a new pid with the same session and a later start. */
const RESUMED_PID = 4500;
const RESUMED_STARTED = 3000;

/** A process of another session, which the waiter runs under. The bound session has no process. */
const OTHER_PID = 4600;
const OTHER_SESSION = "session-other";
const OTHER_STARTED = 3000;

const RESUMED_TREE: ProcessRow[] = [
  { pid: WAITER_PID, ppid: RESUMED_PID },
  { pid: RESUMED_PID, ppid: 1 }
];

const OTHER_TREE: ProcessRow[] = [
  { pid: WAITER_PID, ppid: OTHER_PID },
  { pid: OTHER_PID, ppid: 1 }
];

test("a waiter under the process that resumed the bound session is granted", async (t) => {
  const { daemon, ws, base, live, clock } = await started(
    t,
    tableOf({ status: "available", rows: RESUMED_TREE })
  );
  // The bound client exits, and a new process takes the same session. The listing is cached for a
  // short window, so the clock moves past it before the reservation reads the new listing.
  live.splice(0, live.length, {
    pid: RESUMED_PID,
    sessionId: SESSION,
    startedAt: RESUMED_STARTED
  });
  clock.now += AGENTS_CACHE_MS + 1;
  const message = await appendMessageInWorkspace(ws.info, ws.threadId, {
    agentId: ARCHITECT,
    body: mention(),
    role: "architect"
  });
  const reply = parse(
    await send(
      daemon.baseUrl,
      "POST",
      `${base}/reservations`,
      reservationBody(message.id)
    )
  );
  assert.deepEqual([reply.decision, reply.reason], ["granted", undefined]);
});

test("a waiter under a process of another session stays held", async (t) => {
  const { daemon, ws, base, live, clock } = await started(
    t,
    tableOf({ status: "available", rows: OTHER_TREE })
  );
  live.splice(0, live.length, {
    pid: OTHER_PID,
    sessionId: OTHER_SESSION,
    startedAt: OTHER_STARTED
  });
  clock.now += AGENTS_CACHE_MS + 1;
  const message = await appendMessageInWorkspace(ws.info, ws.threadId, {
    agentId: ARCHITECT,
    body: mention(),
    role: "architect"
  });
  const reply = parse(
    await send(
      daemon.baseUrl,
      "POST",
      `${base}/reservations`,
      reservationBody(message.id)
    )
  );
  assert.deepEqual(
    [reply.decision, reply.reason],
    ["held", "identity_unverified"]
  );
});
