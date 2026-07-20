import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildMcpServer } from "../src/mcp/server.js";

type RegisteredTool = {
  inputSchema: { shape: Record<string, unknown> };
  handler: (
    input: Record<string, unknown>
  ) => Promise<{ content: Array<{ text: string }> }>;
};

function registeredTools(server: unknown): Record<string, RegisteredTool> {
  return (server as { _registeredTools: Record<string, RegisteredTool> })
    ._registeredTools;
}

async function tempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "marc-mcp-memory-"));
}

async function callTool<T = unknown>(
  tool: RegisteredTool,
  input: Record<string, unknown> = {}
): Promise<T> {
  const response = await tool.handler(input);
  return JSON.parse(response.content[0].text) as T;
}

test("memory tools expose schemas and require bootstrap", async () => {
  const workspace = await tempWorkspace();
  const server = buildMcpServer({ workspace });
  const tools = registeredTools(server);

  assert.ok(tools.memory_prepare);
  assert.ok(tools.memory_status);
  assert.ok(tools.memory_rebuild);
  assert.ok(tools.memory_recall);
  assert.ok(tools.memory_recall.inputSchema.shape.query);
  assert.ok(tools.memory_recall.inputSchema.shape.limit);
  assert.ok(tools.memory_recall.inputSchema.shape.minScore);
  assert.ok(tools.memory_rebuild.inputSchema.shape.mode);

  const blocked = await callTool<{ error: { code: string; nextTool: string } }>(
    tools.memory_status
  );
  assert.equal(blocked.error.code, "bootstrap_required");
  assert.equal(blocked.error.nextTool, "workspace_bootstrap");
});

test("memory_recall returns model preparation guidance without loading embeddings", async () => {
  const workspace = await tempWorkspace();
  const server = buildMcpServer({ workspace });
  const tools = registeredTools(server);

  const recall = await callTool<{
    result: {
      indexStatus: { status: string };
      results: unknown[];
      nextActions: string[];
    };
  }>(tools.memory_recall, {
    bootstrapConfirmed: true,
    query: "implementar rotacao de token da interface"
  });

  assert.equal(recall.result.indexStatus.status, "model_missing");
  assert.deepEqual(recall.result.results, []);
  assert.ok(
    recall.result.nextActions.some((action) =>
      action.includes("memory_prepare")
    )
  );
});

test("memory_rebuild reports model preparation requirement before indexing", async () => {
  const workspace = await tempWorkspace();
  const server = buildMcpServer({ workspace });
  const tools = registeredTools(server);

  const rebuild = await callTool<{
    result: {
      status: string;
      modelPrepared: boolean;
      message: string;
    };
  }>(tools.memory_rebuild, {
    bootstrapConfirmed: true
  });

  assert.equal(rebuild.result.status, "model_missing");
  assert.equal(rebuild.result.modelPrepared, false);
  assert.match(rebuild.result.message, /model/i);
});
