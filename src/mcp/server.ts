import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { auditWorkspace } from "../core/audit.js";
import { bootstrapWorkspace } from "./bootstrap.js";
import {
  notifyDaemon,
  startDaemonLeaseHeartbeat,
  unregisterFromDaemon
} from "./daemon.js";
import { MARC_HELPER_TOPICS, marcHelper } from "./helper.js";
import { registerMemoryTools } from "./memory-tools.js";
import { gatedShape, text, withBootstrap } from "./responses.js";
import type { McpOptions } from "./types.js";
import {
  appendMessage,
  attachArtifact,
  createThread,
  getWorkspaceInfo,
  initWorkspace,
  listAgentProfiles,
  listThreads,
  readAgentProfile,
  readRules,
  readThread,
  readThreadInfo,
  readThreadSince,
  readThreadTail,
  readWorkspaceStatus,
  registerAgent,
  updateWorkspaceRecommendations
} from "../core/workspace.js";

export function buildMcpServer(options: McpOptions = {}): McpServer {
  const workspaceRoot = options.workspace ?? process.cwd();
  const server = new McpServer({
    name: "marc",
    version: "0.1.0"
  });

  server.tool(
    "marc_helper",
    "Explain how to use mARC MCP tools efficiently, with topic-specific guidance and examples.",
    {
      topic: z.enum(MARC_HELPER_TOPICS).optional()
    },
    async ({ topic }) => text(marcHelper(topic))
  );

  server.tool(
    "workspace_bootstrap",
    "Bootstrap this mARC workspace for the current session. Call this before any gated mARC tool.",
    {},
    async () => text(await bootstrapWorkspace(workspaceRoot))
  );

  server.tool(
    "workspace_register",
    "Initialize .marc in the current project and optionally register it with the daemon.",
    gatedShape({}),
    async (input) =>
      withBootstrap(input, async () => {
        const workspace = await initWorkspace(workspaceRoot);
        await updateWorkspaceRecommendations(workspaceRoot);
        await notifyDaemon(workspace, options);
        return workspace;
      })
  );

  server.tool(
    "workspace_update_recommendations",
    "Update this workspace's recommended mARC instructions and rules without overwriting project content.",
    {},
    async () => text(await updateWorkspaceRecommendations(workspaceRoot))
  );

  server.tool(
    "workspace_unregister",
    "Remove this workspace from the daemon registry and UI without deleting the local .marc folder or chat history.",
    gatedShape({}),
    async (input) =>
      withBootstrap(input, async () => {
        const workspace = await getWorkspaceInfo(workspaceRoot);
        await unregisterFromDaemon(workspace, options);
        return {
          unregistered: workspace,
          deletedLocalFiles: false
        };
      })
  );

  server.tool(
    "workspace_status",
    "Read this workspace health/status, including thread index rebuild state.",
    gatedShape({}),
    async (input) =>
      withBootstrap(input, async () => readWorkspaceStatus(workspaceRoot))
  );

  registerMemoryTools(server, workspaceRoot);

  server.tool(
    "workspace_audit",
    "Audit mARC workspace content and return structured feedback for rules, messages, agents, references, artifacts, and preflight checks.",
    gatedShape({
      scope: z
        .enum([
          "all",
          "rules",
          "messages",
          "agents",
          "references",
          "artifacts",
          "preflight"
        ])
        .optional(),
      threadId: z.string().min(1).optional(),
      messageId: z.string().min(1).optional(),
      severity: z.enum(["all", "critical", "warning", "suggestion"]).optional(),
      maxFindings: z.number().int().min(1).max(100).optional()
    }),
    async (input) =>
      withBootstrap(input, async () =>
        auditWorkspace(workspaceRoot, {
          scope: input.scope,
          threadId: input.threadId,
          messageId: input.messageId,
          severity: input.severity,
          maxFindings: input.maxFindings
        })
      )
  );

  server.tool(
    "agent_register",
    "Register an agent profile in this workspace before posting messages.",
    gatedShape({
      id: z.string().min(1),
      role: z.string().min(1),
      model: z.string().min(1),
      description: z.string().min(1),
      displayName: z.string().optional()
    }),
    async (input) =>
      withBootstrap(input, async () => registerAgent(workspaceRoot, input))
  );

  server.tool(
    "agent_list",
    "List registered agent profiles in this workspace.",
    gatedShape({
      includeMarkdown: z.boolean().optional()
    }),
    async (input) =>
      withBootstrap(input, async () =>
        listAgentProfiles(workspaceRoot, {
          includeMarkdown: input.includeMarkdown
        })
      )
  );

  server.tool(
    "thread_create",
    "Create a new mARC thread in this workspace.",
    gatedShape({
      title: z.string().min(1)
    }),
    async (input) =>
      withBootstrap(input, async () => createThread(workspaceRoot, input.title))
  );

  server.tool(
    "message_post",
    "Append a structured Markdown message to a thread. Keep messages simple, direct, and short or medium length; attach long detail as artifacts.",
    gatedShape({
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

  server.tool(
    "message_attach_artifact",
    "Write an artifact under a thread artifacts folder and return its relative link.",
    gatedShape({
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

  server.tool(
    "thread_list",
    "List threads in this workspace. Defaults to open threads; pass status 'closed' or 'all' when needed.",
    gatedShape({
      status: z.enum(["open", "closed", "all"]).optional()
    }),
    async (input) =>
      withBootstrap(input, async () =>
        listThreads(workspaceRoot, { status: input.status })
      )
  );

  server.tool(
    "thread_read",
    "Read a thread transcript. Returns lastMessageId; agents should store it and prefer thread_read_since on later reads. Markdown is omitted by default to avoid duplicating messages.",
    gatedShape({
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

  server.tool(
    "thread_read_since",
    "Read only messages added after afterMessageId. If the cursor is missing, returns cursor_not_found and shouldReadFullThread=true so the agent can announce fallback and call thread_read explicitly.",
    gatedShape({
      threadId: z.string().min(1),
      afterMessageId: z.string().min(1)
    }),
    async (input) =>
      withBootstrap(input, async () =>
        readThreadSince(workspaceRoot, input.threadId, input.afterMessageId)
      )
  );

  server.tool(
    "thread_info",
    "Read cheap thread metadata including messageCount, lastMessageId, updatedAt, status, and summary availability.",
    gatedShape({
      threadId: z.string().min(1)
    }),
    async (input) =>
      withBootstrap(input, async () =>
        readThreadInfo(workspaceRoot, input.threadId)
      )
  );

  server.tool(
    "thread_tail",
    "Read the last N messages from a thread. Use this for quick recent context when a full read is unnecessary.",
    gatedShape({
      threadId: z.string().min(1),
      limit: z.number().int().min(1).max(50).optional()
    }),
    async (input) =>
      withBootstrap(input, async () =>
        readThreadTail(workspaceRoot, input.threadId, { limit: input.limit })
      )
  );

  server.tool(
    "workspace_read_rules",
    "Read this workspace RULES.md.",
    gatedShape({}),
    async (input) => withBootstrap(input, async () => readRules(workspaceRoot))
  );

  server.tool(
    "agent_read_profile",
    "Read one registered agent profile from this workspace.",
    gatedShape({
      agentId: z.string().min(1)
    }),
    async (input) =>
      withBootstrap(input, async () =>
        readAgentProfile(workspaceRoot, input.agentId)
      )
  );

  server.tool(
    "workspace_info",
    "Return the workspace bound to this MCP process.",
    gatedShape({}),
    async (input) =>
      withBootstrap(input, async () => getWorkspaceInfo(workspaceRoot))
  );

  return server;
}

export async function runMcpServer(options: McpOptions = {}): Promise<void> {
  await startDaemonLeaseHeartbeat(options);
  const server = buildMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
