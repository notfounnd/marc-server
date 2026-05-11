import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildMcpServer } from "../src/mcp/server.js";

type RegisteredTool = {
  inputSchema: { shape: Record<string, unknown> };
  handler: (input: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;
};

function registeredTools(server: unknown): Record<string, RegisteredTool> {
  return (server as { _registeredTools: Record<string, RegisteredTool> })._registeredTools;
}

async function tempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "marc-mcp-"));
}

async function callTool<T = unknown>(tool: RegisteredTool, input: Record<string, unknown> = {}): Promise<T> {
  const response = await tool.handler(input);
  return JSON.parse(response.content[0].text) as T;
}

test("registers only canonical grouped MCP tool names", () => {
  const server = buildMcpServer({ workspace: process.cwd() });
  const tools = Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools).sort();

  assert.deepEqual(tools, [
    "agent_list",
    "agent_read_profile",
    "agent_register",
    "marc_helper",
    "message_attach_artifact",
    "message_post",
    "thread_create",
    "thread_info",
    "thread_list",
    "thread_read",
    "thread_read_since",
    "thread_tail",
    "workspace_bootstrap",
    "workspace_info",
    "workspace_read_rules",
    "workspace_register",
    "workspace_unregister",
    "workspace_update_recommendations",
  ]);

  assert.equal(tools.some((tool) => /^(create|list|read|post|attach|register|unregister|update)_/.test(tool)), false);
});

test("thread_list accepts optional status filter", () => {
  const server = buildMcpServer({ workspace: process.cwd() });
  const tool = registeredTools(server).thread_list;

  assert.ok(tool.inputSchema.shape.status);
});

test("agent tools expose list and profile schemas", () => {
  const server = buildMcpServer({ workspace: process.cwd() });
  const tools = registeredTools(server);

  assert.ok(tools.agent_list);
  assert.ok(tools.agent_read_profile.inputSchema.shape.agentId);
});

test("thread read tools expose incremental cursor schemas", () => {
  const server = buildMcpServer({ workspace: process.cwd() });
  const tools = registeredTools(server);

  assert.ok(tools.thread_read.inputSchema.shape.includeMarkdown);
  assert.ok(tools.thread_read.inputSchema.shape.includeMessages);
  assert.ok(tools.thread_read.inputSchema.shape.includeSummary);
  assert.ok(tools.thread_read_since.inputSchema.shape.afterMessageId);
  assert.ok(tools.thread_info.inputSchema.shape.threadId);
  assert.ok(tools.thread_tail.inputSchema.shape.limit);
});

test("marc_helper exposes a topic selector", () => {
  const server = buildMcpServer({ workspace: process.cwd() });
  const tool = registeredTools(server).marc_helper;

  assert.ok(tool.inputSchema.shape.topic);
});

test("marc_helper explains the bootstrap split between instructions and rules", async () => {
  const server = buildMcpServer({ workspace: process.cwd() });
  const tool = registeredTools(server).marc_helper;

  const response = await tool.handler({ topic: "workspace" });
  const helper = JSON.parse(response.content[0].text);

  assert.match(helper.purpose, /INSTRUCTIONS\.md/);
  assert.match(helper.purpose, /RULES\.md/);
  assert.ok(helper.notes.some((note: string) => note.includes("workspace_bootstrap")));
  assert.ok(helper.notes.some((note: string) => note.includes("bootstrapConfirmed")));
  assert.ok(helper.notes.some((note: string) => note.includes("Custom Rules")));
});

test("workspace_bootstrap returns instructions and rules without requiring confirmation", async () => {
  const workspace = await tempWorkspace();
  const server = buildMcpServer({ workspace });
  const tools = registeredTools(server);

  const bootstrap = await callTool<{
    bootstrap: { confirmed: true; nextInput: { bootstrapConfirmed: true } };
    instructions: string;
    rules: string;
  }>(tools.workspace_bootstrap);

  assert.equal(bootstrap.bootstrap.confirmed, true);
  assert.deepEqual(bootstrap.bootstrap.nextInput, { bootstrapConfirmed: true });
  assert.match(bootstrap.instructions, /# mARC Instructions/);
  assert.match(bootstrap.rules, /# mARC Rules/);
});

test("gated tools require bootstrapConfirmed before running domain actions", async () => {
  const workspace = await tempWorkspace();
  const server = buildMcpServer({ workspace });
  const tools = registeredTools(server);

  const result = await callTool<{ error: { code: string; nextTool: string } }>(tools.thread_list);

  assert.equal(result.error.code, "bootstrap_required");
  assert.equal(result.error.nextTool, "workspace_bootstrap");
  await assert.rejects(() => fs.access(path.join(workspace, ".marc")));
});

test("gated write tools block before domain actions and wrap successful writes", async () => {
  const workspace = await tempWorkspace();
  const server = buildMcpServer({ workspace });
  const tools = registeredTools(server);

  const blocked = await callTool<{ error: { code: string; nextTool: string } }>(tools.message_post, {
    threadId: "missing-thread",
    agentId: "codex-dev",
    body: "Should not be written.",
  });

  assert.equal(blocked.error.code, "bootstrap_required");
  assert.equal(blocked.error.nextTool, "workspace_bootstrap");
  await assert.rejects(() => fs.access(path.join(workspace, ".marc")));

  await callTool(tools.workspace_bootstrap);
  const created = await callTool<{ result: { id: string } }>(tools.thread_create, {
    title: "Bootstrap write",
    bootstrapConfirmed: true,
  });
  const posted = await callTool<{ bootstrap: { confirmed: true; reminder: string }; result: { body: string } }>(
    tools.message_post,
    {
      threadId: created.result.id,
      agentId: "codex-dev",
      body: "Written after bootstrap.",
      bootstrapConfirmed: true,
    },
  );

  assert.equal(posted.bootstrap.confirmed, true);
  assert.match(posted.bootstrap.reminder, /workspace_bootstrap/);
  assert.equal(posted.result.body, "Written after bootstrap.");
});

test("free bootstrap tools work without bootstrapConfirmed", async () => {
  const workspace = await tempWorkspace();
  const server = buildMcpServer({ workspace });
  const tools = registeredTools(server);

  for (const toolName of ["marc_helper", "workspace_bootstrap", "workspace_update_recommendations"]) {
    assert.equal(tools[toolName].inputSchema.shape.bootstrapConfirmed, undefined);
  }

  const helper = await callTool<{ tool: string }>(tools.marc_helper);
  const recommendations = await callTool<{ updated: string[]; alreadyCurrent: string[] }>(
    tools.workspace_update_recommendations,
  );
  const bootstrap = await callTool<{ bootstrap: { confirmed: true } }>(tools.workspace_bootstrap);

  assert.equal(helper.tool, "marc_helper");
  assert.ok(Array.isArray(recommendations.updated));
  assert.equal(bootstrap.bootstrap.confirmed, true);
});

test("gated tools expose bootstrapConfirmed and wrap successful responses with a reminder", async () => {
  const workspace = await tempWorkspace();
  const server = buildMcpServer({ workspace });
  const tools = registeredTools(server);
  const gatedToolNames = Object.keys(tools).filter(
    (toolName) => !["marc_helper", "workspace_bootstrap", "workspace_update_recommendations"].includes(toolName),
  );

  for (const toolName of gatedToolNames) {
    assert.ok(tools[toolName].inputSchema.shape.bootstrapConfirmed, `${toolName} should expose bootstrapConfirmed`);
  }

  await callTool(tools.workspace_bootstrap);
  const result = await callTool<{
    bootstrap: { confirmed: true; reminder: string };
    result: Array<unknown>;
  }>(tools.thread_list, { bootstrapConfirmed: true });

  assert.equal(result.bootstrap.confirmed, true);
  assert.match(result.bootstrap.reminder, /workspace_bootstrap/);
  assert.ok(Array.isArray(result.result));
});
