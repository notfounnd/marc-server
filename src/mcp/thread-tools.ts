import {
  appendMessage,
  attachArtifact,
  createThread,
  listThreads,
  readThread,
  readThreadInfo,
  readThreadSince,
  readThreadTail
} from "../core/workspace.js";
import { gatedSchema, toolError, withBootstrap } from "./responses.js";
import { resolveThreadId } from "./thread-resolution.js";
import { McpToolCoordinator, registerMcpTool } from "./tool-registration.js";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export function registerThreadTools(
  server: McpServer,
  coordinator: McpToolCoordinator,
  workspaceRoot: string
): void {
  registerMcpTool(
    server,
    coordinator,
    "thread_create",
    "Create a new mARC thread in this workspace.",
    gatedSchema({ title: z.string().min(1) }),
    async (input) =>
      withBootstrap(input, async () => createThread(workspaceRoot, input.title))
  );
  registerMcpTool(
    server,
    coordinator,
    "message_post",
    "Append a structured Markdown message to a thread. Keep messages simple, direct, and short or medium length; attach long detail as artifacts.",
    gatedSchema({
      threadId: z.string().min(1),
      agentId: z.string().min(1),
      body: z.string().min(1),
      role: z.string().optional(),
      artifacts: z.array(z.string()).optional()
    }),
    async (input) =>
      withBootstrap(input, async () =>
        appendMessage(workspaceRoot, input.threadId, {
          agentId: input.agentId,
          body: input.body,
          role: input.role,
          artifacts: input.artifacts
        })
      )
  );
  registerMcpTool(
    server,
    coordinator,
    "message_attach_artifact",
    "Write an artifact under a thread artifacts folder and return its relative link.",
    gatedSchema({
      threadId: z.string().min(1),
      fileName: z.string().min(1),
      content: z.string()
    }),
    async (input) =>
      withBootstrap(input, async () => ({
        path: await attachArtifact(
          workspaceRoot,
          input.threadId,
          input.fileName,
          input.content
        )
      }))
  );
  registerMcpTool(
    server,
    coordinator,
    "thread_list",
    "List threads in this workspace. Defaults to open threads; pass status 'closed' or 'all' when needed.",
    gatedSchema({ status: z.enum(["open", "closed", "all"]).optional() }),
    async (input) =>
      withBootstrap(input, async () =>
        listThreads(workspaceRoot, { status: input.status })
      )
  );
  registerMcpTool(
    server,
    coordinator,
    "thread_read",
    "Read a thread transcript by full ID or unique 8-character hexadecimal suffix. Returns the canonical threadId and lastMessageId; agents should store the cursor and prefer thread_read_since on later reads. Markdown is omitted by default to avoid duplicating messages.",
    gatedSchema({
      threadId: z
        .string()
        .min(1)
        .describe("Full thread ID or an 8-character hexadecimal suffix."),
      includeMarkdown: z.boolean().optional(),
      includeMessages: z.boolean().optional(),
      includeSummary: z.boolean().optional()
    }),
    async (input) =>
      withResolvedThread(input, workspaceRoot, async (threadId) => ({
        ...(await readThread(workspaceRoot, threadId, {
          includeMarkdown: input.includeMarkdown,
          includeMessages: input.includeMessages,
          includeSummary: input.includeSummary
        })),
        threadId
      }))
  );
  registerMcpTool(
    server,
    coordinator,
    "thread_read_since",
    "Read only messages added after afterMessageId by full thread ID or unique 8-character hexadecimal suffix. Returns the canonical threadId. If the cursor is missing, returns cursor_not_found and shouldReadFullThread=true so the agent can announce fallback and call thread_read explicitly.",
    gatedSchema({
      threadId: z
        .string()
        .min(1)
        .describe("Full thread ID or an 8-character hexadecimal suffix."),
      afterMessageId: z.string().min(1)
    }),
    async (input) =>
      withResolvedThread(input, workspaceRoot, async (threadId) => ({
        ...(await readThreadSince(
          workspaceRoot,
          threadId,
          input.afterMessageId
        )),
        threadId
      }))
  );
  registerMcpTool(
    server,
    coordinator,
    "thread_info",
    "Read cheap thread metadata by full ID or unique 8-character hexadecimal suffix. Returns the canonical threadId and the existing id field.",
    gatedSchema({
      threadId: z
        .string()
        .min(1)
        .describe("Full thread ID or an 8-character hexadecimal suffix.")
    }),
    async (input) =>
      withResolvedThread(input, workspaceRoot, async (threadId) => {
        const info = await readThreadInfo(workspaceRoot, threadId);
        return { ...info, threadId: info.id };
      })
  );
  registerMcpTool(
    server,
    coordinator,
    "thread_tail",
    "Read the last N messages by full thread ID or unique 8-character hexadecimal suffix. Returns the canonical threadId. Use this for quick context when unnecessary full transcript output would waste tokens.",
    gatedSchema({
      threadId: z
        .string()
        .min(1)
        .describe("Full thread ID or an 8-character hexadecimal suffix."),
      limit: z.number().int().min(1).max(50).optional()
    }),
    async (input) =>
      withResolvedThread(input, workspaceRoot, async (threadId) => ({
        ...(await readThreadTail(workspaceRoot, threadId, {
          limit: input.limit
        })),
        threadId
      }))
  );
}

async function withResolvedThread<Result>(
  input: { threadId: string; bootstrapConfirmed?: boolean },
  workspaceRoot: string,
  read: (threadId: string) => Promise<Result>
) {
  if (input.bootstrapConfirmed !== true) {
    return withBootstrap(input, async () => undefined);
  }

  const resolution = await resolveThreadId(workspaceRoot, input.threadId);
  if (!resolution.ok) {
    return toolError(
      resolution.error.code,
      resolution.error.message,
      resolution.error.details
    );
  }

  return withBootstrap(input, async () => read(resolution.threadId));
}
