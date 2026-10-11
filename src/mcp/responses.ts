import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";

export function text(content: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text:
          typeof content === "string"
            ? content
            : JSON.stringify(content, null, 2)
      }
    ]
  };
}

export const BOOTSTRAP_REMINDER =
  "Reuse the current workspace contract while it remains known; rerun workspace_bootstrap only when bootstrap context is missing, stale, or uncertain.";

export function gatedSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object({
    ...shape,
    bootstrapConfirmed: z
      .boolean()
      .optional()
      .describe(
        "Set to true only after workspace_bootstrap returned successfully in this session/workspace."
      )
  });
}

export async function withBootstrap<T>(
  input: { bootstrapConfirmed?: boolean },
  handler: () => Promise<T>
): Promise<CallToolResult> {
  if (input.bootstrapConfirmed !== true) return bootstrapRequired();

  return text({
    bootstrap: {
      confirmed: true,
      reminder: BOOTSTRAP_REMINDER
    },
    result: await handler()
  });
}

export function toolError(code: string, message: string, details?: unknown) {
  return {
    ...text({ error: { code, message, ...(details ? { details } : {}) } }),
    isError: true
  } satisfies CallToolResult;
}

function bootstrapRequired() {
  return {
    ...text({
      error: {
        code: "bootstrap_required",
        message:
          "Call workspace_bootstrap first, then retry this tool with bootstrapConfirmed: true.",
        nextTool: "workspace_bootstrap",
        retryWith: { bootstrapConfirmed: true }
      }
    }),
    isError: true
  } satisfies CallToolResult;
}
