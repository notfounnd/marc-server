import type {
  McpServer,
  StandardSchemaWithJSON
} from "@modelcontextprotocol/server";
import { text, toolError } from "./responses.js";

const WINDOW_MS = 1_000;
const MAX_CALLS_PER_WINDOW = 60;

export class ToolCallLimiter {
  private windowStart: number;
  private calls = 0;

  constructor(private readonly now: () => number = Date.now) {
    this.windowStart = now();
  }

  acquire(): number | undefined {
    const currentTime = this.now();
    if (
      currentTime < this.windowStart ||
      currentTime - this.windowStart >= WINDOW_MS
    ) {
      this.windowStart = currentTime;
      this.calls = 0;
    }
    if (this.calls >= MAX_CALLS_PER_WINDOW) {
      return Math.max(1, this.windowStart + WINDOW_MS - currentTime);
    }
    this.calls += 1;
    return undefined;
  }
}

export class McpToolCoordinator {
  private accepting = true;
  private readonly active = new Set<Promise<unknown>>();

  constructor(readonly limiter = new ToolCallLimiter()) {}

  execute(handler: () => Promise<unknown>): Promise<ReturnType<typeof text>> {
    if (!this.accepting) {
      return Promise.resolve(
        toolError("server_shutting_down", "The MCP server is shutting down.")
      );
    }
    const retryAfterMs = this.limiter.acquire();
    if (retryAfterMs !== undefined) {
      return Promise.resolve(
        toolError("rate_limited", "Tool call rate limit exceeded.", {
          retryAfterMs
        })
      );
    }
    const operation = this.executeSafely(handler);
    this.active.add(operation);
    return operation.finally(() => this.active.delete(operation));
  }

  stopAccepting(): void {
    this.accepting = false;
  }

  async waitForIdle(): Promise<void> {
    while (this.active.size > 0) {
      await Promise.allSettled([...this.active]);
    }
  }

  private async executeSafely(
    handler: () => Promise<unknown>
  ): Promise<ReturnType<typeof text>> {
    try {
      const result = await handler();
      return isToolResult(result)
        ? result
        : toolError("internal_error", "The tool returned an invalid result.");
    } catch {
      return toolError("internal_error", "Tool execution failed.");
    }
  }
}

export function registerMcpTool<Input, Output>(
  server: McpServer,
  coordinator: McpToolCoordinator,
  name: string,
  description: string,
  inputSchema: StandardSchemaWithJSON<Input, Output>,
  handler: (input: Output) => Promise<unknown>
): void {
  server.registerTool<
    StandardSchemaWithJSON,
    StandardSchemaWithJSON<Input, Output>
  >(name, { description, inputSchema }, async (input, context) =>
    coordinator.execute(async () => {
      if (context.mcpReq.signal.aborted) {
        return toolError("request_cancelled", "The request was cancelled.");
      }
      return handler(input);
    })
  );
}

function isToolResult(value: unknown): value is ReturnType<typeof text> {
  return (
    typeof value === "object" &&
    value !== null &&
    "content" in value &&
    Array.isArray(value.content)
  );
}
