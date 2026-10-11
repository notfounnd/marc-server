import assert from "node:assert/strict";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import test from "node:test";
import {
  McpToolCoordinator,
  registerMcpTool
} from "../src/mcp/tool-registration.js";
import { toolJson } from "./mcp-process.js";

type TestResult = {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
};

type TestContext = { mcpReq: { signal: AbortSignal } };
type TestCallback = (
  input: { value: string },
  context: TestContext
) => Promise<TestResult>;

test("cancelled MCP requests do not start their domain handler", async () => {
  let callback: TestCallback | undefined;
  let domainCalls = 0;
  const server = {
    registerTool(
      _name: string,
      _config: unknown,
      registeredCallback: unknown
    ): void {
      callback = registeredCallback as TestCallback;
    }
  } as unknown as McpServer;

  registerMcpTool(
    server,
    new McpToolCoordinator(),
    "probe",
    "Test request cancellation.",
    z.object({ value: z.string() }),
    async () => {
      domainCalls += 1;
      return { value: "started" };
    }
  );

  assert.ok(callback);
  const result = await callback(
    { value: "input" },
    {
      mcpReq: { signal: AbortSignal.abort() }
    }
  );
  assert.equal(result.isError, true);
  assert.equal(
    toolJson<{ error: { code: string } }>(result).error.code,
    "request_cancelled"
  );
  assert.equal(domainCalls, 0);
});
