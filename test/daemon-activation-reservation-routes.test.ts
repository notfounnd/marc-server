import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import { ARCHITECT, get, send } from "./daemon-session-http-fixtures.js";
import {
  CODEX,
  mention,
  parse,
  reservationBody,
  started
} from "./daemon-activation-reservation-fixtures.js";

test("an architect's mention is granted once, a replay is granted again with no debit, and the budget counts one cycle", async (t) => {
  const { daemon, ws, base } = await started(t);
  const message = await appendMessageInWorkspace(ws.info, ws.threadId, {
    agentId: ARCHITECT,
    body: mention(),
    role: "architect"
  });
  const body = reservationBody(message.id);

  const first = parse(
    await send(daemon.baseUrl, "POST", `${base}/reservations`, body)
  );
  const replay = parse(
    await send(daemon.baseUrl, "POST", `${base}/reservations`, body)
  );
  const view = parse(await get(daemon.baseUrl, base));

  assert.deepEqual(
    [first.decision, first.stage, first.cycle],
    ["granted", "planning", 1]
  );
  assert.deepEqual([replay.decision, replay.cycle], ["granted", 1]);
  assert.equal((view.budget as { cyclesUsed: number }).cyclesUsed, 1);
});

test("another holder is refused, and a developer's mention is ineligible", async (t) => {
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

  const other = await send(
    daemon.baseUrl,
    "POST",
    `${base}/reservations`,
    reservationBody(message.id, { holder: "session-other", runId: "run-2" })
  );
  assert.deepEqual(parse(other), {
    decision: "refused",
    reason: "already_reserved",
    stage: "planning"
  });

  const developer = await appendMessageInWorkspace(ws.info, ws.threadId, {
    agentId: "claude-dev",
    body: mention(),
    role: "developer"
  });
  const ineligible = parse(
    await send(
      daemon.baseUrl,
      "POST",
      `${base}/reservations`,
      reservationBody(developer.id, { runId: "run-3" })
    )
  );
  assert.deepEqual(
    [ineligible.decision, ineligible.reason],
    ["refused", "ineligible_origin"]
  );
});

test("a message posted through the UI route is granted with no cycle", async (t) => {
  const { daemon, ws, base } = await started(t);
  const posted = parse(
    await send(
      daemon.baseUrl,
      "POST",
      `/api/workspaces/${ws.info.id}/threads/${ws.threadId}`,
      {
        agentId: "ui-user",
        message: mention(),
        role: "user"
      }
    )
  );
  const granted = parse(
    await send(
      daemon.baseUrl,
      "POST",
      `${base}/reservations`,
      reservationBody(String(posted.id), { runId: "run-ui" })
    )
  );
  const view = parse(await get(daemon.baseUrl, base));

  assert.deepEqual([granted.decision, granted.cycle], ["granted", undefined]);
  assert.equal((view.budget as { cyclesUsed: number }).cyclesUsed, 0);
});

test("a lost thread state holds the reservation and is not recreated", async (t) => {
  const { daemon, ws, base } = await started(t);
  const message = await appendMessageInWorkspace(ws.info, ws.threadId, {
    agentId: ARCHITECT,
    body: mention(),
    role: "architect"
  });
  const file = path.join(
    daemon.dataDir,
    "threads",
    ws.info.id,
    `${ws.threadId}.json`
  );
  await fs.writeFile(file, "not json");

  const held = parse(
    await send(
      daemon.baseUrl,
      "POST",
      `${base}/reservations`,
      reservationBody(message.id, { runId: "run-9" })
    )
  );

  assert.deepEqual([held.decision, held.reason], ["held", "ledger_invalid"]);
  assert.equal(await fs.readFile(file, "utf8"), "not json");
});

test("a stamp is prepared without a change, confirmed once, and then carries only the stage", async (t) => {
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

  const stamp = parse(
    await send(daemon.baseUrl, "POST", `${base}/stamp`, { agentId: CODEX })
  );
  assert.deepEqual(
    [stamp.decision, stamp.stage, stamp.cycle, stamp.reservation],
    ["stamp", "planning", 1, `${message.id}:${CODEX}`]
  );

  const reply = await appendMessageInWorkspace(ws.info, ws.threadId, {
    agentId: CODEX,
    body: "Reply to the mention.",
    role: "architect"
  });
  const later = await appendMessageInWorkspace(ws.info, ws.threadId, {
    agentId: CODEX,
    body: "Second reply.",
    role: "architect"
  });
  const confirmBody = {
    agentId: CODEX,
    messageId: reply.id,
    reservation: `${message.id}:${CODEX}`
  };
  const answered = parse(
    await send(daemon.baseUrl, "POST", `${base}/stamp/confirm`, confirmBody)
  );
  const repeated = parse(
    await send(daemon.baseUrl, "POST", `${base}/stamp/confirm`, confirmBody)
  );
  const second = await send(daemon.baseUrl, "POST", `${base}/stamp/confirm`, {
    ...confirmBody,
    messageId: later.id
  });
  const afterwards = parse(
    await send(daemon.baseUrl, "POST", `${base}/stamp`, { agentId: CODEX })
  );

  assert.deepEqual(
    [answered.decision, repeated.decision],
    ["answered", "already"]
  );
  assert.deepEqual(
    [second.status, parse(second).reason],
    [409, "already_answered"]
  );
  assert.deepEqual(
    [afterwards.stage, afterwards.cycle, afterwards.reservation],
    ["planning", undefined, undefined]
  );
});

test("an agent advance is refused to a non-lead and to an unverified identity, and the view names the lead", async (t) => {
  const { daemon, ws, base } = await started(t);
  await appendMessageInWorkspace(ws.info, ws.threadId, {
    agentId: ARCHITECT,
    body: mention(),
    role: "architect"
  });
  const advance = (agentId: string) =>
    send(daemon.baseUrl, "POST", `${base}/agent-advance`, {
      agentId,
      expectedStage: "planning",
      advanceTo: "execution",
      identity: { pid: 99, ppid: 100, hostId: "host-a" }
    });

  const notLead = await advance(CODEX);
  assert.deepEqual([notLead.status, parse(notLead).reason], [409, "not_lead"]);

  const unverified = await advance(ARCHITECT);
  assert.deepEqual(
    [unverified.status, parse(unverified).reason],
    [409, "identity_unverified"]
  );

  const view = parse(await get(daemon.baseUrl, base));
  assert.equal(view.lead, ARCHITECT);
});
