import assert from "node:assert/strict";
import test from "node:test";
import { createSessionIdentity } from "../src/mcp/session-identity.js";

const NOW_ISO = "2026-11-03T12:00:00.000Z";
const base = { pid: 200, ppid: 100, hostId: "host-a", now: () => NOW_ISO };

const ENV_ROWS: Array<{
  name: string;
  env: NodeJS.ProcessEnv;
  sessionId: string | undefined;
  client: "claude-code" | undefined;
}> = [
  {
    name: "reads the session from the environment and names the client",
    env: { CLAUDE_CODE_SESSION_ID: " 1111 " },
    sessionId: "1111",
    client: "claude-code"
  },
  {
    name: "treats a blank session as absent",
    env: { CLAUDE_CODE_SESSION_ID: "   " },
    sessionId: undefined,
    client: undefined
  },
  {
    name: "treats a missing session as absent",
    env: {},
    sessionId: undefined,
    client: undefined
  }
];

for (const row of ENV_ROWS) {
  test(`session identity: ${row.name}`, () => {
    const identity = createSessionIdentity({ env: row.env, ...base });
    assert.equal(identity.nativeSessionId, row.sessionId);
    assert.equal(identity.client, row.client);
    assert.equal(identity.fields().nativeSessionId, row.sessionId);
    assert.equal(identity.fields().identifiedAt, undefined);
  });
}

test("markIdentified stamps the identity once and notifies current listeners", () => {
  const identity = createSessionIdentity({
    env: { CLAUDE_CODE_SESSION_ID: "1111" },
    ...base
  });
  const calls: string[] = [];
  const stopFirst = identity.onIdentified(() => calls.push("first"));
  const stopSecond = identity.onIdentified(() => calls.push("second"));
  stopSecond();
  identity.markIdentified();
  identity.markIdentified();
  assert.equal(identity.fields().identifiedAt, NOW_ISO);
  assert.deepEqual(calls, ["first"]);
  stopFirst();
});

test("the lease fields carry the process identity and never a token", () => {
  const identity = createSessionIdentity({
    env: { CLAUDE_CODE_SESSION_ID: "1111", MARC_TOKEN: "secret" },
    ...base
  });
  assert.deepEqual(identity.fields(), {
    nativeSessionId: "1111",
    client: "claude-code",
    pid: 200,
    ppid: 100,
    hostId: "host-a",
    identifiedAt: undefined
  });
});
