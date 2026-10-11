import assert from "node:assert/strict";
import test from "node:test";
import { startMcpTestClient, toolJson } from "./mcp-process.js";

test("agent tools expose public schemas and enforce bootstrap over stdio", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  const listing = await session.client.listTools();
  const registerTool = listing.tools.find(
    (tool) => tool.name === "agent_register"
  );
  const listTool = listing.tools.find((tool) => tool.name === "agent_list");
  assert.ok(registerTool);
  assert.ok(listTool);
  const registerProperties = registerTool.inputSchema.properties as Record<
    string,
    unknown
  >;
  assert.ok("id" in registerProperties);
  assert.ok("role" in registerProperties);
  assert.ok("model" in registerProperties);
  assert.ok("bootstrapConfirmed" in registerProperties);
  assert.ok(
    "bootstrapConfirmed" in
      ((listTool.inputSchema.properties as Record<string, unknown>) ?? {})
  );

  const blocked = await session.client.callTool({
    name: "agent_register",
    arguments: {
      id: "mcp-agent-test",
      role: "developer",
      model: "test-model",
      description: "Temporary public MCP client test profile."
    }
  });
  assert.equal(blocked.isError, true);
  assert.equal(
    toolJson<{ error: { code: string } }>(blocked).error.code,
    "bootstrap_required"
  );
});

test("agent registration, listing, and profile reading work through public Client", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  await session.client.callTool({ name: "workspace_bootstrap", arguments: {} });
  const registered = await session.client.callTool({
    name: "agent_register",
    arguments: {
      id: "mcp-agent-test",
      role: "developer",
      model: "test-model",
      description: "Temporary public MCP client test profile.",
      bootstrapConfirmed: true
    }
  });
  assert.equal(registered.isError, undefined);
  const registeredBody = toolJson<{ result: { id: string } }>(registered);
  assert.equal(registeredBody.result.id, "mcp-agent-test");

  const listed = await session.client.callTool({
    name: "agent_list",
    arguments: { bootstrapConfirmed: true }
  });
  const profiles = toolJson<{
    result: Array<{ id: string; role: string; model: string }>;
  }>(listed).result;
  const profile = profiles.find((item) => item.id === "mcp-agent-test");
  assert.ok(profile);
  assert.equal(profile.role, "developer");
  assert.equal(profile.model, "test-model");

  const read = await session.client.callTool({
    name: "agent_read_profile",
    arguments: { agentId: "mcp-agent-test", bootstrapConfirmed: true }
  });
  assert.equal(read.isError, undefined);
  assert.match(toolJson<{ result: string }>(read).result, /mcp-agent-test/);
});
