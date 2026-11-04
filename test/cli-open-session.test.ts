import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { productionDaemonFiles } from "../src/cli-open-discovery.js";
import {
  createDaemonClient,
  refusalReason,
  spawnLaunch
} from "../src/cli-open-session.js";

type Sent = {
  url: string;
  method: string;
  authorization: string;
  body?: string;
};

/** A fetch that records each request and answers with the given status and text. */
function recordingFetch(
  status: number,
  text: string
): { fetcher: typeof fetch; sent: Sent[] } {
  const sent: Sent[] = [];
  const fetcher = (async (input: URL | string, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    sent.push({
      url: String(input),
      method: init?.method ?? "",
      authorization: headers.authorization,
      body: typeof init?.body === "string" ? init.body : undefined
    });
    return new Response(text, { status });
  }) as typeof fetch;
  return { fetcher, sent };
}

test("the production runtime reader takes the URL and the token path from daemon.json", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marc-open-state-"));
  const tokenPath = path.join(dir, "token");
  await fs.writeFile(
    path.join(dir, "daemon.json"),
    JSON.stringify({
      version: 1,
      pid: 1,
      url: "http://127.0.0.1:4187",
      tokenPath
    })
  );

  assert.deepEqual(await productionDaemonFiles.readRuntime(dir), {
    url: "http://127.0.0.1:4187",
    tokenPath
  });
});

test("the production runtime reader reports no runtime state when daemon.json is absent", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marc-open-empty-"));
  assert.equal(await productionDaemonFiles.readRuntime(dir), undefined);
});

test("the production runtime reader rejects a daemon.json that is not valid JSON", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marc-open-broken-"));
  await fs.writeFile(path.join(dir, "daemon.json"), "{ not json");
  await assert.rejects(productionDaemonFiles.readRuntime(dir));
});

test("the production token reader returns the file text, and undefined for a file that is missing", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marc-open-token-"));
  const file = path.join(dir, "token");
  await fs.writeFile(file, "  file-token \n");
  assert.equal(await productionDaemonFiles.readText(file), "  file-token \n");
  assert.equal(
    await productionDaemonFiles.readText(path.join(dir, "absent")),
    undefined
  );
});

test("the client sends the bearer token and the route of each call, and reads the JSON reply", async () => {
  const { fetcher, sent } = recordingFetch(
    200,
    JSON.stringify({ decision: "renewed" })
  );
  const client = createDaemonClient(
    { baseUrl: "http://127.0.0.1:4187", token: "secret-bearer" },
    fetcher
  );

  const reply = await client.heartbeat({
    workspaceId: "ws-1",
    threadId: "thread-1",
    profile: "claude-dev",
    generation: 2,
    ownerToken: "owner",
    clientPid: 9
  });

  assert.deepEqual(reply, { status: 200, body: { decision: "renewed" } });
  assert.equal(sent[0].url, "http://127.0.0.1:4187/api/sessions/heartbeat");
  assert.equal(sent[0].method, "POST");
  assert.equal(sent[0].authorization, "Bearer secret-bearer");
  assert.equal(JSON.parse(sent[0].body ?? "{}").clientPid, 9);
});

test("the status probe is a GET of /api/status with the bearer token", async () => {
  const { fetcher, sent } = recordingFetch(
    200,
    JSON.stringify({ status: "running" })
  );
  const client = createDaemonClient(
    { baseUrl: "http://127.0.0.1:4187", token: "probe-token" },
    fetcher
  );
  const reply = await client.status();
  assert.deepEqual(reply, { status: 200, body: { status: "running" } });
  assert.equal(sent[0].url, "http://127.0.0.1:4187/api/status");
  assert.equal(sent[0].method, "GET");
  assert.equal(sent[0].authorization, "Bearer probe-token");
});

test("the slot read encodes the workspace and thread IDs in its route", async () => {
  const { fetcher, sent } = recordingFetch(200, JSON.stringify({ slots: [] }));
  const client = createDaemonClient(
    { baseUrl: "http://127.0.0.1:4187", token: "t" },
    fetcher
  );
  await client.sessions("ws-1", "thread one");
  assert.equal(
    sent[0].url,
    "http://127.0.0.1:4187/api/workspaces/ws-1/threads/thread%20one/sessions"
  );
  assert.equal(sent[0].method, "GET");
  assert.equal(sent[0].body, undefined);
});

test("a reply that is not JSON is passed on with an undefined body", async () => {
  const { fetcher } = recordingFetch(401, "Unauthorized");
  const client = createDaemonClient(
    { baseUrl: "http://127.0.0.1:4187", token: "t" },
    fetcher
  );
  assert.deepEqual(
    await client.release({
      workspaceId: "ws-1",
      threadId: "thread-1",
      profile: "claude-dev",
      generation: 1,
      ownerToken: "owner"
    }),
    { status: 401, body: undefined }
  );
});

test("refusalReason reads the reason of a refusal and says unknown for anything else", () => {
  assert.equal(
    refusalReason({ decision: "refused", reason: "conflict" }),
    "conflict"
  );
  assert.equal(refusalReason({ reason: 5 }), "unknown");
  assert.equal(refusalReason(undefined), "unknown");
});

test("the production spawner reports a command that does not exist as ENOENT", async () => {
  const child = spawnLaunch({
    command: "marc-open-command-that-does-not-exist",
    args: [],
    env: { PATH: process.env.PATH ?? "" },
    cwd: process.cwd()
  });
  const code = await new Promise<string | undefined>((resolve) => {
    child.onError((error) => resolve(error.code));
  });
  assert.equal(code, "ENOENT");
});
