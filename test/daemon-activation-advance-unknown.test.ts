import assert from "node:assert/strict";
import test from "node:test";
import { postMessageWithActivation } from "../src/mcp/message-post-stamp.js";
import type { McpOptions } from "../src/mcp/types.js";
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

const IDENTITY = { pid: 99, ppid: 100, hostId: "host-a" };

/** The advance route never answers, so the MCP's own time limit aborts it: an unknown advance. */
function neverAnswers(_url: URL, init: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  });
}

/** The real daemon for every route, except the advance, which never answers. */
const ROUTE_FETCHERS: Record<
  string,
  (url: URL, init: RequestInit) => Promise<Response>
> = {
  "agent-advance": neverAnswers
};

function routeOf(url: URL): string {
  return url.pathname.split("/activation/")[1];
}

const forwardToDaemon = (url: URL, init: RequestInit) => fetch(url, init);

test("an unknown advance keeps the granted reservation answered by the message, and the stage stays", async (t) => {
  const g = await governedThread(t);
  const mention = await mentionOf(g);
  parse(await poll(g, mention, "run-1", CLI_SESSION));
  const options = {
    daemonUrl: g.daemon.baseUrl,
    token: TOKEN,
    activationTimeoutMs: 1_000,
    activationFetch: ((url: URL, init: RequestInit) =>
      (ROUTE_FETCHERS[routeOf(url)] ?? forwardToDaemon)(
        url,
        init
      )) as typeof fetch
  } as McpOptions;

  const posted = await postMessageWithActivation(
    options,
    g.root,
    g.threadId,
    {
      agentId: CODEX,
      body: "Advancing, if the daemon answers.",
      role: "architect"
    },
    { to: "execution", identity: IDENTITY }
  );

  assert.deepEqual(posted.advance, { decision: "unknown" });
  assert.deepEqual(posted.warnings, ["stage_advance_unknown"]);
  assert.deepEqual([posted.stage, posted.cycle], ["planning", 1]);
  assert.equal(recordOf(await stateOf(g), mention)?.answeredBy, posted.id);
  assert.equal((await stateOf(g)).activation?.currentStage, "planning");
});
