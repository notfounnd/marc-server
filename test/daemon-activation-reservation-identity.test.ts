import assert from "node:assert/strict";
import test from "node:test";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import type { ProcessTableRead } from "../src/core/process-table.js";
import { ARCHITECT, get, send } from "./daemon-session-http-fixtures.js";
import {
  mention,
  parse,
  reservationBody,
  started,
  tableOf,
  TREE,
  WAITER_PID
} from "./daemon-activation-reservation-fixtures.js";

const UNREADABLE: ProcessTableRead = {
  status: "unavailable",
  reason: "command_failed"
};

/**
 * The waiter's identity is read inside the thread's queue. Each row is one way the identity can fail or
 * hold; the only control row is a waiter under the bound client, which must be granted.
 */
const CASES: ReadonlyArray<{
  name: string;
  table: ProcessTableRead;
  pid: number | undefined;
  expected: [string, string | undefined];
}> = [
  {
    name: "a waiter without a pid is held as identity_unverified",
    table: { status: "available", rows: TREE },
    pid: undefined,
    expected: ["held", "identity_unverified"]
  },
  {
    name: "a waiter outside the bound client's tree is held as identity_unverified",
    table: { status: "available", rows: TREE },
    pid: 9999,
    expected: ["held", "identity_unverified"]
  },
  {
    name: "an unreadable process table holds the waiter as identity_unverified",
    table: UNREADABLE,
    pid: WAITER_PID,
    expected: ["held", "identity_unverified"]
  },
  {
    name: "a waiter under the bound client is granted",
    table: { status: "available", rows: TREE },
    pid: WAITER_PID,
    expected: ["granted", undefined]
  }
];

for (const row of CASES) {
  test(`reservation identity: ${row.name}`, async (t) => {
    const { daemon, ws, base } = await started(t, tableOf(row.table));
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
        reservationBody(message.id, { pid: row.pid })
      )
    );
    assert.deepEqual([reply.decision, reply.reason], row.expected);
  });
}

test("a held identity leaves the reservation budget untouched", async (t) => {
  const { daemon, ws, base } = await started(t, tableOf(UNREADABLE));
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
  const view = parse(await get(daemon.baseUrl, base));
  assert.equal((view.budget as { cyclesUsed: number }).cyclesUsed, 0);
});
