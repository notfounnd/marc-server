import { z } from "zod";

export function text(content: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text:
          typeof content === "string"
            ? content
            : JSON.stringify(content, null, 2)
      }
    ]
  };
}

export const BOOTSTRAP_REMINDER =
  "If bootstrap context was lost, rerun workspace_bootstrap before relying on bootstrapConfirmed.";

export function gatedShape<T extends z.ZodRawShape>(
  shape: T
): T & { bootstrapConfirmed: z.ZodOptional<z.ZodBoolean> } {
  return {
    ...shape,
    bootstrapConfirmed: z
      .boolean()
      .optional()
      .describe(
        "Set to true only after workspace_bootstrap returned successfully in this session/workspace."
      )
  };
}

export async function withBootstrap<T>(
  input: { bootstrapConfirmed?: boolean },
  handler: () => Promise<T>
): Promise<ReturnType<typeof text>> {
  if (input.bootstrapConfirmed !== true) return bootstrapRequired();

  return text({
    bootstrap: {
      confirmed: true,
      reminder: BOOTSTRAP_REMINDER
    },
    result: await handler()
  });
}

function bootstrapRequired() {
  return text({
    error: {
      code: "bootstrap_required",
      message:
        "Call workspace_bootstrap first, then retry this tool with bootstrapConfirmed: true.",
      nextTool: "workspace_bootstrap",
      retryWith: { bootstrapConfirmed: true }
    }
  });
}
