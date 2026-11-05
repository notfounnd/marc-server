import assert from "node:assert/strict";
import type { McpServer } from "@modelcontextprotocol/server";
import test from "node:test";
import { registerThreadTools } from "../src/mcp/thread-tools.js";
import { McpToolCoordinator } from "../src/mcp/tool-registration.js";
import type { SessionIdentity } from "../src/mcp/session-identity.js";
import type { McpOptions } from "../src/mcp/types.js";

type CapturedTool = {
  inputSchema: {
    shape: Record<string, unknown>;
    safeParse(input: unknown): {
      success: boolean;
      data: Record<string, unknown>;
    };
  };
};

function capturedTools(): Record<string, CapturedTool> {
  const tools: Record<string, CapturedTool> = {};
  const server = {
    registerTool(name: string, config: CapturedTool) {
      tools[name] = config;
    }
  } as unknown as McpServer;
  registerThreadTools(
    server,
    new McpToolCoordinator(),
    "/unused",
    {} as McpOptions,
    {} as SessionIdentity
  );
  return tools;
}

test("message_post does not declare stage or cycle in its input schema", () => {
  const schema = capturedTools().message_post?.inputSchema;
  assert.ok(schema);
  assert.equal("stage" in schema.shape, false);
  assert.equal("cycle" in schema.shape, false);
});

test("an agent that sends stage or cycle gets them ignored: the parsed input has neither", () => {
  const schema = capturedTools().message_post!.inputSchema;

  const parsed = schema.safeParse({
    threadId: "thread-1",
    agentId: "claude-dev",
    body: "Done.",
    stage: "planning",
    cycle: 2
  });

  assert.equal(parsed.success, true);
  assert.deepEqual(Object.keys(parsed.data).sort(), [
    "agentId",
    "body",
    "threadId"
  ]);
});
