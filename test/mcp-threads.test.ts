import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { startMcpTestClient, toolJson } from "./mcp-process.js";

type ThreadMessage = {
  id: string;
  body: string;
  artifacts: string[];
};

test("thread tools round-trip messages and artifacts within the workspace", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  const call = async <Result>(
    name: string,
    arguments_: Record<string, unknown>
  ): Promise<Result> => {
    const response = await session.client.callTool({
      name,
      arguments: arguments_
    });
    assert.equal(
      response.isError,
      undefined,
      `${name} returned an MCP tool error`
    );
    return toolJson<{ result: Result }>(response).result;
  };

  const bootstrap = await session.client.callTool({
    name: "workspace_bootstrap",
    arguments: {}
  });
  assert.equal(bootstrap.isError, undefined);
  assert.equal(
    toolJson<{ bootstrap: { confirmed: boolean } }>(bootstrap).bootstrap
      .confirmed,
    true
  );

  const profile = await call<{ id: string }>("agent_register", {
    id: "mcp-thread-round-trip-agent",
    role: "developer",
    model: "test-model",
    description: "Temporary profile for public MCP thread tests.",
    displayName: "MCP Thread Test",
    bootstrapConfirmed: true
  });
  assert.equal(profile.id, "mcp-thread-round-trip-agent");

  const thread = await call<{ id: string; path: string }>("thread_create", {
    title: "MCP thread artifact round trip",
    bootstrapConfirmed: true
  });
  const artifact = await call<{ path: string }>("message_attach_artifact", {
    threadId: thread.id,
    fileName: "round-trip-proof.md",
    content:
      "Artifact content remains inside this temporary thread workspace.\n",
    bootstrapConfirmed: true
  });
  const artifactPath = path.resolve(thread.path, artifact.path);
  assert.equal(
    path.relative(thread.path, artifactPath).startsWith(".."),
    false
  );
  assert.equal(
    await fs.readFile(artifactPath, "utf8"),
    "Artifact content remains inside this temporary thread workspace.\n"
  );

  await call("message_post", {
    threadId: thread.id,
    agentId: profile.id,
    body: "The first message establishes a cursor for the thread read.",
    bootstrapConfirmed: true
  });
  const readA = await call<{
    messages: ThreadMessage[];
    messageCount: number;
  }>("thread_read", {
    threadId: thread.id,
    includeMarkdown: false,
    includeMessages: true,
    includeSummary: false,
    bootstrapConfirmed: true
  });
  assert.equal(readA.messageCount, 1);
  assert.equal(
    readA.messages[0].body,
    "The first message establishes a cursor for the thread read."
  );

  await call("message_post", {
    threadId: thread.id,
    agentId: profile.id,
    body: "The second message includes the attached evidence artifact.",
    artifacts: [artifact.path],
    bootstrapConfirmed: true
  });

  const infoAfterB = await call<{
    messageCount: number;
    lastMessageId?: string;
  }>("thread_info", {
    threadId: thread.id,
    bootstrapConfirmed: true
  });
  assert.equal(infoAfterB.messageCount, 2);

  const since = await call<{ ok: boolean; messages: ThreadMessage[] }>(
    "thread_read_since",
    {
      threadId: thread.id,
      afterMessageId: readA.messages[0].id,
      bootstrapConfirmed: true
    }
  );
  assert.equal(since.ok, true);
  assert.equal(since.messages.length, 1);
  assert.equal(
    since.messages[0].body,
    "The second message includes the attached evidence artifact."
  );
  assert.deepEqual(since.messages[0].artifacts, [artifact.path]);

  const read = await call<{
    markdown: string;
    messages: ThreadMessage[];
    messageCount: number;
  }>("thread_read", {
    threadId: thread.id,
    includeMarkdown: true,
    includeMessages: true,
    includeSummary: false,
    bootstrapConfirmed: true
  });
  assert.equal(read.messageCount, 2);
  assert.equal(
    read.messages[1].body,
    "The second message includes the attached evidence artifact."
  );
  assert.deepEqual(read.messages[1].artifacts, [artifact.path]);
  assert.ok(read.markdown.includes(artifact.path));
  assert.equal(read.messages[0].id, readA.messages[0].id);
  assert.equal(since.messages[0].id, read.messages[1].id);
  assert.equal(infoAfterB.lastMessageId, read.messages[1].id);

  const tail = await call<{ messages: ThreadMessage[]; limit: number }>(
    "thread_tail",
    {
      threadId: thread.id,
      limit: 1,
      bootstrapConfirmed: true
    }
  );
  assert.equal(tail.limit, 1);
  assert.deepEqual(
    tail.messages.map((message) => message.id),
    [read.messages[1].id]
  );

  const info = await call<{
    messageCount: number;
    lastMessageId?: string;
    status: string;
  }>("thread_info", {
    threadId: thread.id,
    bootstrapConfirmed: true
  });
  assert.equal(info.messageCount, 2);
  assert.equal(info.lastMessageId, read.messages[1].id);
  assert.equal(info.status, "open");

  const invalidArtifact = await session.client.callTool({
    name: "message_attach_artifact",
    arguments: {
      threadId: thread.id,
      fileName: "../../../../outside.md",
      content: "This path must be rejected.",
      bootstrapConfirmed: true
    }
  });
  assert.equal(invalidArtifact.isError, true);
  await assert.rejects(fs.access(path.join(session.workspace, "outside.md")));
});

test("thread readers resolve eight-character suffixes to canonical IDs", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());

  const bootstrap = await session.client.callTool({
    name: "workspace_bootstrap",
    arguments: {}
  });
  assert.equal(bootstrap.isError, undefined);

  const catalog = await session.client.listTools();
  for (const name of [
    "thread_read",
    "thread_read_since",
    "thread_info",
    "thread_tail"
  ]) {
    const tool = catalog.tools.find((candidate) => candidate.name === name);
    assert.ok(tool, `${name} is present in the MCP catalog`);
    const properties = tool.inputSchema.properties as Record<
      string,
      { description?: string }
    >;
    assert.match(
      properties.threadId?.description ?? "",
      /8-character hexadecimal suffix/
    );
  }

  const threadId = "suffix-test-a1b2c3d4";
  const threadPath = path.join(session.workspace, ".marc", "threads", threadId);
  await fs.mkdir(threadPath, { recursive: true });
  await fs.writeFile(path.join(threadPath, "CHAT.md"), "");

  const call = async <Result>(
    name: string,
    arguments_: Record<string, unknown>
  ): Promise<Result> => {
    const response = await session.client.callTool({
      name,
      arguments: { ...arguments_, bootstrapConfirmed: true }
    });
    assert.equal(response.isError, undefined, `${name} returned an MCP error`);
    return toolJson<{ result: Result }>(response).result;
  };

  const read = await call<{ threadId: string }>("thread_read", {
    threadId: "a1b2c3d4"
  });
  assert.equal(read.threadId, threadId);

  const since = await call<{
    threadId: string;
    ok: boolean;
    error?: string;
    shouldReadFullThread?: boolean;
  }>("thread_read_since", {
    threadId: "A1B2C3D4",
    afterMessageId: "missing-cursor"
  });
  assert.equal(since.threadId, threadId);
  assert.equal(since.ok, false);
  assert.equal(since.error, "cursor_not_found");
  assert.equal(since.shouldReadFullThread, true);

  const tail = await call<{
    threadId: string;
    messages: ThreadMessage[];
    limit: number;
  }>("thread_tail", { threadId: "a1b2c3d4", limit: 3 });
  assert.equal(tail.threadId, threadId);
  assert.equal(tail.limit, 3);
  assert.deepEqual(tail.messages, []);

  const info = await call<{ id: string; threadId: string; status: string }>(
    "thread_info",
    { threadId: "a1b2c3d4" }
  );
  assert.equal(info.id, threadId);
  assert.equal(info.threadId, threadId);
  assert.equal(info.status, "open");
});

test("thread resolution includes closed threads and stays workspace-local", async (t) => {
  const first = await startMcpTestClient();
  const second = await startMcpTestClient();
  t.after(async () => {
    await first.close();
    await second.close();
  });

  await first.client.callTool({ name: "workspace_bootstrap", arguments: {} });
  await second.client.callTool({ name: "workspace_bootstrap", arguments: {} });

  const threadId = "closed-thread-cafebeef";
  const threadPath = path.join(first.workspace, ".marc", "threads", threadId);
  await fs.mkdir(threadPath, { recursive: true });
  await fs.writeFile(path.join(threadPath, "CHAT.md"), "");
  await fs.writeFile(path.join(threadPath, "SUMMARY.md"), "# Closed thread\n");

  const otherThreadPath = path.join(
    second.workspace,
    ".marc",
    "threads",
    "different-thread-cafebeef"
  );
  await fs.mkdir(otherThreadPath, { recursive: true });
  await fs.writeFile(path.join(otherThreadPath, "CHAT.md"), "");

  const response = await first.client.callTool({
    name: "thread_info",
    arguments: { threadId: "CAFEBEEF", bootstrapConfirmed: true }
  });
  assert.equal(response.isError, undefined);
  const result = toolJson<{
    result: { id: string; threadId: string; status: string };
  }>(response).result;
  assert.equal(result.id, threadId);
  assert.equal(result.threadId, threadId);
  assert.equal(result.status, "closed");

  const writeBySuffix = await first.client.callTool({
    name: "message_post",
    arguments: {
      threadId: "cafebeef",
      agentId: "suffix-write-agent",
      body: "Writes continue to require the canonical full ID.",
      bootstrapConfirmed: true
    }
  });
  assert.equal(writeBySuffix.isError, true);
  assert.equal(
    toolJson<{ error: { code: string } }>(writeBySuffix).error.code,
    "internal_error"
  );
});
