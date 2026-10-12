import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { startMcpTestClient, toolJson } from "./mcp-process.js";

const expectedTools = [
  "agent_list",
  "agent_read_profile",
  "agent_register",
  "marc_helper",
  "memory_prepare",
  "memory_rebuild",
  "memory_recall",
  "memory_status",
  "message_attach_artifact",
  "message_post",
  "thread_create",
  "thread_info",
  "thread_list",
  "thread_read",
  "thread_read_since",
  "thread_tail",
  "thread_write_summary",
  "workspace_audit",
  "workspace_bootstrap",
  "workspace_info",
  "workspace_read_rules",
  "workspace_register",
  "workspace_status",
  "workspace_unregister",
  "workspace_update_recommendations"
];

test("public tools/list exposes the stable canonical catalog and gated schemas", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  const listing = await session.client.listTools();

  assert.equal(listing.tools.length, 25);
  assert.deepEqual(
    listing.tools.map((tool) => tool.name).sort(),
    expectedTools
  );
  const threadList = listing.tools.find((tool) => tool.name === "thread_list");
  assert.ok(threadList);
  assert.equal(threadList.inputSchema.type, "object");
  assert.ok(
    "bootstrapConfirmed" in
      ((threadList.inputSchema.properties as Record<string, unknown>) ?? {})
  );
  const threadStatus = (
    threadList.inputSchema.properties as Record<string, { enum?: string[] }>
  ).status;
  assert.deepEqual(threadStatus.enum, ["open", "closed", "all"]);
  const summaryWriter = listing.tools.find(
    (tool) => tool.name === "thread_write_summary"
  );
  assert.ok(summaryWriter);
  const summaryProperties = summaryWriter.inputSchema.properties as Record<
    string,
    { enum?: string[]; type?: string }
  >;
  assert.ok("bootstrapConfirmed" in summaryProperties);
  assert.equal(summaryProperties.threadId.type, "string");
  assert.equal(summaryProperties.body.type, "string");
  assert.deepEqual(summaryProperties.mode.enum, ["create", "update"]);
  assert.equal(summaryProperties.expectedSummaryRevision.type, "string");
});

test("bootstrap gate is a tool error and does not alter the public catalog", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  const before = (await session.client.listTools()).tools.map(
    (tool) => tool.name
  );
  const gated = await session.client.callTool({
    name: "thread_list",
    arguments: {}
  });

  assert.equal(gated.isError, true);
  assert.equal(
    toolJson<{ error: { code: string } }>(gated).error.code,
    "bootstrap_required"
  );
  const summaryGated = await session.client.callTool({
    name: "thread_write_summary",
    arguments: {
      threadId: "summary-gate-test-abcdef12",
      body: "This call must stop at the workspace bootstrap gate."
    }
  });
  assert.equal(summaryGated.isError, true);
  assert.equal(
    toolJson<{ error: { code: string } }>(summaryGated).error.code,
    "bootstrap_required"
  );
  const bootstrap = await session.client.callTool({
    name: "workspace_bootstrap",
    arguments: {}
  });
  assert.equal(bootstrap.isError, undefined);
  const after = (await session.client.listTools()).tools.map(
    (tool) => tool.name
  );
  assert.deepEqual(after, before);
  const listed = await session.client.callTool({
    name: "thread_list",
    arguments: { status: "open", bootstrapConfirmed: true }
  });
  assert.equal(listed.isError, undefined);
  assert.deepEqual(toolJson<{ result: unknown[] }>(listed).result, []);
});

test("workspace status and audit use the bootstrap envelope over the wire", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  const blocked = await session.client.callTool({
    name: "workspace_audit",
    arguments: { scope: "messages" }
  });
  assert.equal(blocked.isError, true);

  const bootstrap = await session.client.callTool({
    name: "workspace_bootstrap",
    arguments: {}
  });
  const bootstrapBody = toolJson<{
    bootstrap: {
      confirmed: boolean;
      nextInput: { bootstrapConfirmed: boolean };
    };
    instructions: string;
    rules: string;
  }>(bootstrap);
  assert.equal(bootstrapBody.bootstrap.confirmed, true);
  assert.equal(bootstrapBody.bootstrap.nextInput.bootstrapConfirmed, true);
  assert.match(bootstrapBody.instructions, /workspace_bootstrap/);
  assert.match(bootstrapBody.rules, /Custom Rules/);

  const status = await session.client.callTool({
    name: "workspace_status",
    arguments: { bootstrapConfirmed: true }
  });
  assert.equal(status.isError, undefined);
  const statusBody = toolJson<{
    result: { modules: { threadIndex: unknown } };
  }>(status);
  assert.ok(statusBody.result.modules.threadIndex);

  const audit = await session.client.callTool({
    name: "workspace_audit",
    arguments: { scope: "messages", bootstrapConfirmed: true }
  });
  assert.equal(audit.isError, undefined);
  assert.ok("result" in toolJson<Record<string, unknown>>(audit));
});

test("marc_helper returns the requested topic through JSON text content", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  const bootstrap = await session.client.callTool({
    name: "workspace_bootstrap",
    arguments: {}
  });
  assert.equal(bootstrap.isError, undefined);
  await fs.appendFile(
    path.join(session.workspace, ".marc", "RULES.md"),
    "\n### Consumer Custom Rule\n\n- Consumer-specific rule text.\n"
  );
  const readGuide = async <Result>(topic: string): Promise<Result> =>
    toolJson<Result>(
      await session.client.callTool({
        name: "marc_helper",
        arguments: { topic }
      })
    );

  const helper = await session.client.callTool({
    name: "marc_helper",
    arguments: { topic: "overview" }
  });
  assert.equal(helper.isError, undefined);
  const body = toolJson<{
    tool: string;
    topic: string;
    availableTopics: string[];
    examples: string[];
  }>(helper);
  assert.equal(body.tool, "marc_helper");
  assert.equal(body.topic, "overview");
  assert.ok(body.availableTopics.includes("incremental_reading"));
  assert.ok(
    body.examples.some((example) => example.includes("workspace_bootstrap"))
  );

  const threadGuide = await readGuide<{
    relatedTools: string[];
    examples: string[];
    notes: string[];
  }>("threads");
  assert.ok(threadGuide.relatedTools.includes("thread_write_summary"));
  assert.ok(
    threadGuide.examples.some((example) =>
      example.includes("expectedSummaryRevision")
    )
  );
  assert.ok(
    threadGuide.examples.some((example) =>
      example.includes("full IDs for writes")
    )
  );
  assert.ok(
    threadGuide.notes.some((note) =>
      note.includes("workspace contract for thread composition and closure")
    )
  );
  assert.doesNotMatch(JSON.stringify(threadGuide), /docs\/agent-workflows\.md/);
  await assert.rejects(
    fs.access(path.join(session.workspace, "docs", "agent-workflows.md"))
  );

  const agentGuide = await readGuide<{
    examples: string[];
    notes: string[];
  }>("agents");
  assert.ok(
    agentGuide.notes.some((note) => note.includes("Reuse an existing profile"))
  );
  assert.doesNotMatch(
    JSON.stringify(agentGuide),
    /codex-dev|qa-reviewer|architect/
  );

  const messagesGuide = await readGuide<{
    examples: string[];
    notes: string[];
  }>("messages");
  assert.ok(
    messagesGuide.notes.some((note) =>
      note.includes(
        "material decisions, findings, risks, blockers, and results"
      )
    )
  );
  assert.doesNotMatch(JSON.stringify(messagesGuide), /acknowledge reading/);

  const incrementalGuide = await readGuide<{
    examples: string[];
    notes: string[];
  }>("incremental_reading");
  assert.ok(
    incrementalGuide.notes.some((note) =>
      note.includes("read and processed the message content")
    )
  );
  assert.ok(
    incrementalGuide.notes.some((note) =>
      note.includes("thread_info metadata does not advance")
    )
  );
  assert.ok(
    incrementalGuide.notes.some((note) =>
      note.includes("thread_tail proves only its returned window")
    )
  );

  const workspaceGuide = await readGuide<{
    notes: string[];
  }>("workspace");
  assert.doesNotMatch(
    JSON.stringify(workspaceGuide),
    /Consumer-specific rule text/
  );
  assert.ok(
    workspaceGuide.notes.some((note) =>
      note.includes("Refreshing recommendations does not replace bootstrap")
    )
  );
  assert.ok(
    workspaceGuide.notes.some((note) =>
      note.includes("preserve structured formats such as JSON")
    )
  );
});

test("thread_create writes only beneath its configured workspace", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  await session.client.callTool({ name: "workspace_bootstrap", arguments: {} });
  const created = await session.client.callTool({
    name: "thread_create",
    arguments: { title: "MCP path integrity", bootstrapConfirmed: true }
  });
  assert.equal(created.isError, undefined);
  const result = toolJson<{
    result: { id: string; title: string; path: string };
  }>(created).result;
  const relativePath = path.relative(session.workspace, result.path);
  assert.ok(relativePath.length > 0);
  assert.equal(relativePath.startsWith(".."), false);
  assert.equal(path.isAbsolute(relativePath), false);
  assert.equal(result.title, "MCP path integrity");
  await fs.access(result.path);
});
