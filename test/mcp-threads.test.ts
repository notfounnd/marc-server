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
  await call("message_post", {
    threadId: thread.id,
    agentId: profile.id,
    body: "The second message includes the attached evidence artifact.",
    artifacts: [artifact.path],
    bootstrapConfirmed: true
  });

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

  const since = await call<{ ok: boolean; messages: ThreadMessage[] }>(
    "thread_read_since",
    {
      threadId: thread.id,
      afterMessageId: read.messages[0].id,
      bootstrapConfirmed: true
    }
  );
  assert.equal(since.ok, true);
  assert.deepEqual(
    since.messages.map((message) => message.id),
    [read.messages[1].id]
  );

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
