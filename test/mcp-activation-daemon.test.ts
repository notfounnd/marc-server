import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { postMessageWithActivation } from "../src/mcp/message-post-stamp.js";
import {
  CLI_SESSION,
  CODEX,
  governedThread,
  mentionOf,
  parse,
  poll,
  recordOf,
  stateOf
} from "./activation-daemon-fixtures.js";
import { TOKEN } from "./daemon-session-http-fixtures.js";

test("a message posted by the granted waiter carries its stage and cycle from the real daemon, and the grant is answered", async (t) => {
  const g = await governedThread(t);
  const mention = await mentionOf(g);
  const granted = parse(await poll(g, mention, "run-1", CLI_SESSION));
  assert.deepEqual([granted.decision, granted.cycle], ["granted", 1]);

  const options = { daemonUrl: g.daemon.baseUrl, token: TOKEN };
  const posted = await postMessageWithActivation(options, g.root, g.threadId, {
    agentId: CODEX,
    body: "Plan approved, moving on.",
    role: "architect"
  });

  assert.deepEqual(
    [posted.stage, posted.cycle, posted.warnings],
    ["planning", 1, []]
  );
  assert.equal(recordOf(await stateOf(g), mention)?.answeredBy, posted.id);
  const chat = await fs.readFile(
    path.join(g.root, ".marc", "threads", g.threadId, "CHAT.md"),
    "utf8"
  );
  assert.match(
    chat,
    new RegExp(`id: ${posted.id}[\\s\\S]*?stage: planning[\\s\\S]*?cycle: 1`)
  );
});

test("a second post by the same waiter after its answer carries only the stage", async (t) => {
  const g = await governedThread(t);
  const mention = await mentionOf(g);
  parse(await poll(g, mention, "run-1", CLI_SESSION));
  const options = { daemonUrl: g.daemon.baseUrl, token: TOKEN };
  await postMessageWithActivation(options, g.root, g.threadId, {
    agentId: CODEX,
    body: "First answer.",
    role: "architect"
  });

  const second = await postMessageWithActivation(options, g.root, g.threadId, {
    agentId: CODEX,
    body: "Second note.",
    role: "architect"
  });

  assert.deepEqual(
    [second.stage, second.cycle, second.warnings],
    ["planning", undefined, []]
  );
});
