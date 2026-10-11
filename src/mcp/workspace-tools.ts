import { auditWorkspace } from "../core/audit.js";
import {
  getWorkspaceInfo,
  initWorkspace,
  readRules,
  readWorkspaceStatus,
  updateWorkspaceRecommendations
} from "../core/workspace.js";
import { bootstrapWorkspace } from "./bootstrap.js";
import { notifyDaemon, unregisterFromDaemon } from "./daemon.js";
import { MARC_HELPER_TOPICS, marcHelper } from "./helper.js";
import { gatedSchema, text, withBootstrap } from "./responses.js";
import { McpToolCoordinator, registerMcpTool } from "./tool-registration.js";
import type { McpOptions } from "./types.js";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export function registerWorkspaceTools(
  server: McpServer,
  coordinator: McpToolCoordinator,
  options: McpOptions
): void {
  const workspaceRoot = options.workspace ?? process.cwd();

  registerMcpTool(
    server,
    coordinator,
    "marc_helper",
    "Explain how to use mARC MCP tools efficiently, with topic-specific guidance and examples.",
    z.object({ topic: z.enum(MARC_HELPER_TOPICS).optional() }),
    async ({ topic }) => text(marcHelper(topic))
  );
  registerMcpTool(
    server,
    coordinator,
    "workspace_bootstrap",
    "Bootstrap this mARC workspace for the current session. Call this before any gated mARC tool.",
    z.object({}),
    async () => text(await bootstrapWorkspace(workspaceRoot))
  );
  registerMcpTool(
    server,
    coordinator,
    "workspace_register",
    "Initialize .marc in the current project and optionally register it with the daemon.",
    gatedSchema({}),
    async (input) =>
      withBootstrap(input, async () => {
        const workspace = await initWorkspace(workspaceRoot);
        await updateWorkspaceRecommendations(workspaceRoot);
        await notifyDaemon(workspace, options);
        return workspace;
      })
  );
  registerMcpTool(
    server,
    coordinator,
    "workspace_update_recommendations",
    "Update this workspace's recommended mARC instructions and rules without overwriting project content.",
    z.object({}),
    async () => text(await updateWorkspaceRecommendations(workspaceRoot))
  );
  registerMcpTool(
    server,
    coordinator,
    "workspace_unregister",
    "Remove this workspace from the daemon registry and UI without deleting the local .marc folder or chat history.",
    gatedSchema({}),
    async (input) =>
      withBootstrap(input, async () => {
        const workspace = await getWorkspaceInfo(workspaceRoot);
        await unregisterFromDaemon(workspace, options);
        return { unregistered: workspace, deletedLocalFiles: false };
      })
  );
  registerMcpTool(
    server,
    coordinator,
    "workspace_status",
    "Read this workspace health/status, including thread index rebuild state.",
    gatedSchema({}),
    async (input) =>
      withBootstrap(input, async () => readWorkspaceStatus(workspaceRoot))
  );
  registerMcpTool(
    server,
    coordinator,
    "workspace_audit",
    "Audit mARC workspace content and return structured feedback for rules, messages, agents, references, artifacts, and preflight checks.",
    gatedSchema({
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
  registerMcpTool(
    server,
    coordinator,
    "workspace_read_rules",
    "Read this workspace RULES.md.",
    gatedSchema({}),
    async (input) => withBootstrap(input, async () => readRules(workspaceRoot))
  );
  registerMcpTool(
    server,
    coordinator,
    "workspace_info",
    "Return the workspace bound to this MCP process.",
    gatedSchema({}),
    async (input) =>
      withBootstrap(input, async () => getWorkspaceInfo(workspaceRoot))
  );
}
