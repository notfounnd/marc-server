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
import { gatedSchema, withBootstrap } from "./responses.js";
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
    "Read a thread transcript. Returns lastMessageId; agents should store it and prefer thread_read_since on later reads. Markdown is omitted by default to avoid duplicating messages.",
    gatedSchema({
      threadId: z.string().min(1),
      includeMarkdown: z.boolean().optional(),
      includeMessages: z.boolean().optional(),
      includeSummary: z.boolean().optional()
    }),
    async (input) =>
      withBootstrap(input, async () =>
        readThread(workspaceRoot, input.threadId, {
          includeMarkdown: input.includeMarkdown,
          includeMessages: input.includeMessages,
          includeSummary: input.includeSummary
        })
      )
  );
  registerMcpTool(
    server,
    coordinator,
    "thread_read_since",
    "Read only messages added after afterMessageId. If the cursor is missing, returns cursor_not_found and shouldReadFullThread=true so the agent can announce fallback and call thread_read explicitly.",
    gatedSchema({
      threadId: z.string().min(1),
      afterMessageId: z.string().min(1)
    }),
    async (input) =>
      withBootstrap(input, async () =>
        readThreadSince(workspaceRoot, input.threadId, input.afterMessageId)
      )
  );
  registerMcpTool(
    server,
    coordinator,
    "thread_info",
    "Read cheap thread metadata including messageCount, lastMessageId, updatedAt, status, and summary availability.",
    gatedSchema({ threadId: z.string().min(1) }),
    async (input) =>
      withBootstrap(input, async () =>
        readThreadInfo(workspaceRoot, input.threadId)
      )
  );
  registerMcpTool(
    server,
    coordinator,
    "thread_tail",
    "Read the last N messages from a thread. Use this for quick context when unnecessary full transcript output would waste tokens.",
    gatedSchema({
      threadId: z.string().min(1),
      limit: z.number().int().min(1).max(50).optional()
    }),
    async (input) =>
      withBootstrap(input, async () =>
        readThreadTail(workspaceRoot, input.threadId, { limit: input.limit })
      )
  );
}
