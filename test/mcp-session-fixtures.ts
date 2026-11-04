import { Client } from "@modelcontextprotocol/client";
import { McpTestProcess, toolJson } from "./mcp-process.js";

export type SessionClient = {
  call<Result>(name: string, args: Record<string, unknown>): Promise<Result>;
  close(): Promise<void>;
};

/** Starts a real MCP server process that believes it runs inside the given Claude Code session. */
export async function startSessionClient(input: {
  workspace: string;
  daemonUrl: string;
  token: string;
  sessionId: string;
}): Promise<SessionClient> {
  const server = new McpTestProcess("source", input.workspace, {
    CLAUDE_CODE_SESSION_ID: input.sessionId,
    MARC_DAEMON_URL: input.daemonUrl,
    MARC_TOKEN: input.token
  });
  const client = new Client(
    { name: "mcp-session-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } }
  );
  await client.connect(server);
  return {
    async call<Result>(name: string, args: Record<string, unknown>) {
      const response = await client.callTool({ name, arguments: args });
      return toolJson<{ result: Result }>(response).result;
    },
    async close() {
      await client.close();
      await server.closeProcess();
    }
  };
}

/** Reads a value a fixed number of times, so the test body has no conditional. */
export async function sampleFor<T>(
  count: number,
  intervalMs: number,
  read: () => Promise<T>
): Promise<T[]> {
  const samples: T[] = [];
  for (let index = 0; index < count; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    samples.push(await read());
  }
  return samples;
}
