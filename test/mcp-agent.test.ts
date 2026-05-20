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
  return fs.mkdtemp(path.join(os.tmpdir(), "marc-mcp-"));
}

async function callTool<T = unknown>(
  tool: RegisteredTool,
  input: Record<string, unknown> = {}
): Promise<T> {
  const response = await tool.handler(input);
  return JSON.parse(response.content[0].text) as T;
}

test("agent_register reports registration status and agent_list is concise by default", async () => {
  const workspace = await tempWorkspace();
  const server = buildMcpServer({ workspace });
  const tools = registeredTools(server);

  const bootstrap = await callTool<{
    agents: { count: number; registered: unknown[] };
  }>(tools.workspace_bootstrap);
  assert.deepEqual(bootstrap.agents, { count: 0, registered: [] });

  const created = await callTool<{
    result: {
      id: string;
      status: string;
      created: boolean;
      alreadyExists: boolean;
      updated: boolean;
    };
  }>(tools.agent_register, {
    id: "Codex Dev",
    displayName: "Ignored Custom Header",
    role: "Developer Agent",
    model: "GPT 5.5",
    description: "Development agent working through Codex.",
    bootstrapConfirmed: true
  });
  assert.deepEqual(created.result, {
    id: "codex-dev",
    status: "created",
    created: true,
    alreadyExists: false,
    updated: false
  });

  const unchanged = await callTool<{
    result: {
      id: string;
      status: string;
      created: boolean;
      alreadyExists: boolean;
      updated: boolean;
    };
  }>(tools.agent_register, {
    id: "codex-dev",
    role: "developer-agent",
    model: "gpt-5.5",
    description: "Development agent working through Codex.",
    bootstrapConfirmed: true
  });
  assert.deepEqual(unchanged.result, {
    id: "codex-dev",
    status: "unchanged",
    created: false,
    alreadyExists: true,
    updated: false
  });

  const listed = await callTool<{
    result: Array<{
      id: string;
      role: string;
      model: string;
      description: string;
      markdown?: string;
    }>;
  }>(tools.agent_list, { bootstrapConfirmed: true });
  assert.deepEqual(listed.result, [
    {
      id: "codex-dev",
      role: "developer-agent",
      model: "gpt-5.5",
      description: "Development agent working through Codex."
    }
  ]);
  assert.equal(listed.result[0].markdown, undefined);

  const listedWithMarkdown = await callTool<{
    result: Array<{
      id: string;
      role: string;
      model: string;
      description: string;
      markdown?: string;
    }>;
  }>(tools.agent_list, { includeMarkdown: true, bootstrapConfirmed: true });
  assert.match(listedWithMarkdown.result[0].markdown ?? "", /^# codex-dev$/m);
  assert.doesNotMatch(
    listedWithMarkdown.result[0].markdown ?? "",
    /Ignored Custom Header/
  );

  const bootstrapped = await callTool<{
    agents: {
      count: number;
      registered: Array<{
        id: string;
        role: string;
        model: string;
        description: string;
      }>;
    };
  }>(tools.workspace_bootstrap);
  assert.deepEqual(bootstrapped.agents, {
    count: 1,
    registered: [
      {
        id: "codex-dev",
        role: "developer-agent",
        model: "gpt-5.5",
        description: "Development agent working through Codex."
      }
    ]
  });
});

test("gated tools expose bootstrapConfirmed and wrap successful responses with a reminder", async () => {
  const workspace = await tempWorkspace();
  const server = buildMcpServer({ workspace });
  const tools = registeredTools(server);
  const gatedToolNames = Object.keys(tools).filter(
    (toolName) =>
      ![
        "marc_helper",
        "workspace_bootstrap",
        "workspace_update_recommendations"
      ].includes(toolName)
  );

  for (const toolName of gatedToolNames) {
    assert.ok(
      tools[toolName].inputSchema.shape.bootstrapConfirmed,
      `${toolName} should expose bootstrapConfirmed`
    );
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
