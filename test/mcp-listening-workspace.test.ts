import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import type { McpServer } from "@modelcontextprotocol/server";
import type { SessionIdentity } from "../src/mcp/session-identity.js";
import { McpToolCoordinator } from "../src/mcp/tool-registration.js";
import { registerWorkspaceTools } from "../src/mcp/workspace-tools.js";
import { toolJson } from "./mcp-process.js";

type ToolResult = { content: Array<{ type: string; text?: string }> };
type ToolHandler = (
  input: Record<string, unknown>,
  context: { mcpReq: { signal: AbortSignal } }
) => Promise<ToolResult>;

/** A workspace path a client may send without a drive letter. Node resolves it on the current drive. */
const DRIVELESS_WORKSPACE = "/Projetos/marc-listening-fixture";

test("marc_helper listening names the workspace as an absolute path, even without a drive letter", async () => {
  const handlers = new Map<string, ToolHandler>();
  const server = {
    registerTool(name: string, _config: unknown, callback: unknown): void {
      handlers.set(name, callback as ToolHandler);
    }
  } as unknown as McpServer;
  registerWorkspaceTools(
    server,
    new McpToolCoordinator(),
    { workspace: DRIVELESS_WORKSPACE },
    {} as unknown as SessionIdentity
  );
  const result = await handlerOf(handlers, "marc_helper")(
    { topic: "listening" },
    { mcpReq: { signal: new AbortController().signal } }
  );
  const body = toolJson<{ command: { argv: string[] } }>(result);
  const index = body.command.argv.indexOf("--workspace");
  assert.deepEqual(body.command.argv.slice(index, index + 2), [
    "--workspace",
    path.resolve(DRIVELESS_WORKSPACE)
  ]);
});

function handlerOf(
  handlers: Map<string, ToolHandler>,
  name: string
): ToolHandler {
  const handler = handlers.get(name);
  assert.ok(handler, `${name} is registered`);
  return handler;
}
