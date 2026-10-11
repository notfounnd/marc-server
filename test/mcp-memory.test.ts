import assert from "node:assert/strict";
import test from "node:test";
import { startMcpTestClient, toolJson } from "./mcp-process.js";

test("memory tools publish schemas and require bootstrap", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  const listing = await session.client.listTools();
  const names = listing.tools
    .map((tool) => tool.name)
    .filter((name) => name.startsWith("memory_"));
  assert.deepEqual(names, [
    "memory_prepare",
    "memory_status",
    "memory_rebuild",
    "memory_recall"
  ]);
  const recallTool = listing.tools.find(
    (tool) => tool.name === "memory_recall"
  );
  assert.ok(recallTool);
  const properties = recallTool.inputSchema.properties as Record<
    string,
    unknown
  >;
  assert.ok("query" in properties);
  assert.ok("bootstrapConfirmed" in properties);

  const blocked = await session.client.callTool({
    name: "memory_recall",
    arguments: { query: "test query" }
  });
  assert.equal(blocked.isError, true);
  assert.equal(
    toolJson<{ error: { code: string } }>(blocked).error.code,
    "bootstrap_required"
  );
});

test("memory status and recall report missing models without loading assets", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  await session.client.callTool({ name: "workspace_bootstrap", arguments: {} });
  const status = await session.client.callTool({
    name: "memory_status",
    arguments: { bootstrapConfirmed: true }
  });
  const statusResult = toolJson<{
    result: { status: string; modelPrepared: boolean; summaryCount: number };
  }>(status).result;
  assert.equal(statusResult.status, "model_missing");
  assert.equal(statusResult.modelPrepared, false);
  assert.equal(statusResult.summaryCount, 0);

  const recall = await session.client.callTool({
    name: "memory_recall",
    arguments: { query: "test query", bootstrapConfirmed: true }
  });
  const recallResult = toolJson<{
    result: {
      indexStatus: { status: string };
      results: unknown[];
      nextActions: string[];
    };
  }>(recall).result;
  assert.equal(recallResult.indexStatus.status, "model_missing");
  assert.deepEqual(recallResult.results, []);
  assert.ok(
    recallResult.nextActions.includes(
      "Run memory_prepare before using memory_recall."
    )
  );
});

test("memory rebuild reports preparation requirement without downloading models", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  await session.client.callTool({ name: "workspace_bootstrap", arguments: {} });
  const rebuild = await session.client.callTool({
    name: "memory_rebuild",
    arguments: { mode: "incremental", bootstrapConfirmed: true }
  });
  const result = toolJson<{
    result: { status: string; modelPrepared: boolean };
  }>(rebuild).result;
  assert.equal(result.status, "model_missing");
  assert.equal(result.modelPrepared, false);
});
