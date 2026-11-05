import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { postMessageWithActivation } from "../src/mcp/message-post-stamp.js";
import {
  CODEX,
  governedThread,
  mentionOf,
  parse,
  stateOf
} from "./activation-daemon-fixtures.js";
import { HOST, NOW, iso } from "./daemon-session-fixtures.js";
import {
  ARCHITECT,
  get,
  send,
  TOKEN,
  type LiveProcess
} from "./daemon-session-http-fixtures.js";

/** The architect's client process, live for the presence: the daemon can resolve and verify it. */
const SESSION = "native-lead-session";
const LIVE: LiveProcess[] = [
  { pid: 100, sessionId: SESSION, startedAt: 5, status: "idle" }
];
/** The identity the MCP sends: its ppid is the client process above. */
const IDENTITY = { nativeSessionId: SESSION, pid: 99, ppid: 100, hostId: HOST };

/** Verifies the architect's slot the way the MCP's own post does: an observation of the live session. */
async function verifyArchitect(
  g: Awaited<ReturnType<typeof governedThread>>
): Promise<void> {
  const reply = await send(g.daemon.baseUrl, "POST", "/api/sessions/observe", {
    workspaceId: g.info.id,
    threadId: g.threadId,
    agentId: ARCHITECT,
    observedAt: iso(NOW),
    identity: IDENTITY
  });
  assert.equal(reply.status, 200, reply.text);
}

test("the verified lead advances while posting: the message carries the destination and the advance is confirmed", async (t) => {
  const g = await governedThread(t, LIVE);
  await verifyArchitect(g);
  await mentionOf(g);
  const options = { daemonUrl: g.daemon.baseUrl, token: TOKEN };

  const posted = await postMessageWithActivation(
    options,
    g.root,
    g.threadId,
    {
      agentId: ARCHITECT,
      body: "Plan approved, moving on.",
      role: "architect"
    },
    { to: "execution", identity: IDENTITY }
  );

  assert.deepEqual(posted.advance, {
    decision: "advanced",
    stage: "execution",
    reference: posted.id
  });
  assert.deepEqual(
    [posted.stage, posted.cycle, posted.warnings],
    ["execution", undefined, []]
  );
  const state = await stateOf(g);
  assert.equal(state.activation?.currentStage, "execution");
  assert.equal(state.stageHistory?.at(-1)?.messageId, posted.id);
  const chat = await fs.readFile(
    path.join(g.root, ".marc", "threads", g.threadId, "CHAT.md"),
    "utf8"
  );
  assert.match(
    chat,
    new RegExp(`id: ${posted.id}\\n[\\s\\S]*?stage: execution`)
  );
  assert.doesNotMatch(chat, new RegExp(`id: ${posted.id}[\\s\\S]*?cycle:`));
});

test("an architect that is not the lead is refused the advance, and its post is written", async (t) => {
  const g = await governedThread(t, LIVE);
  await verifyArchitect(g);
  await mentionOf(g);
  const options = { daemonUrl: g.daemon.baseUrl, token: TOKEN };

  const posted = await postMessageWithActivation(
    options,
    g.root,
    g.threadId,
    { agentId: CODEX, body: "Advancing from here.", role: "architect" },
    { to: "execution", identity: IDENTITY }
  );

  assert.deepEqual(posted.advance, { decision: "refused", reason: "not_lead" });
  assert.deepEqual(posted.warnings, ["stage_advance_refused"]);
  assert.equal((await stateOf(g)).activation?.currentStage, "planning");
  const chat = await fs.readFile(
    path.join(g.root, ".marc", "threads", g.threadId, "CHAT.md"),
    "utf8"
  );
  assert.match(chat, new RegExp(`id: ${posted.id}`));
});

test("the human moves the lead: the former lead is refused the advance and the stage and budget stay", async (t) => {
  const g = await governedThread(t, LIVE);
  await verifyArchitect(g);
  await mentionOf(g);
  const options = { daemonUrl: g.daemon.baseUrl, token: TOKEN };

  const changed = await send(g.daemon.baseUrl, "PUT", `${g.base}/lead`, {
    agentId: CODEX,
    expectedLead: ARCHITECT
  });
  assert.equal(changed.status, 200, changed.text);
  const stale = await send(g.daemon.baseUrl, "PUT", `${g.base}/lead`, {
    agentId: ARCHITECT,
    expectedLead: ARCHITECT
  });
  assert.deepEqual([stale.status, parse(stale).reason], [409, "lead_changed"]);

  const view = parse(await get(g.daemon.baseUrl, g.base));
  assert.deepEqual(
    [view.lead, (view.leadChanges as unknown[]).length],
    [CODEX, 1]
  );
  assert.equal((await stateOf(g)).activation?.currentStage, "planning");

  const posted = await postMessageWithActivation(
    options,
    g.root,
    g.threadId,
    { agentId: ARCHITECT, body: "Still here.", role: "architect" },
    { to: "execution", identity: IDENTITY }
  );
  assert.deepEqual(posted.advance, { decision: "refused", reason: "not_lead" });
  assert.equal((await stateOf(g)).activation?.currentStage, "planning");
});
