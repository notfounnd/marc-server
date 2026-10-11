import {
  listAgentProfiles,
  readAgentProfile,
  registerAgent
} from "../core/workspace.js";
import { gatedSchema, withBootstrap } from "./responses.js";
import { McpToolCoordinator, registerMcpTool } from "./tool-registration.js";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export function registerAgentTools(
  server: McpServer,
  coordinator: McpToolCoordinator,
  workspaceRoot: string
): void {
  registerMcpTool(
    server,
    coordinator,
    "agent_register",
    "Register an agent profile in this workspace before posting messages.",
    gatedSchema({
      id: z.string().min(1),
      role: z.string().min(1),
      model: z.string().min(1),
      description: z.string().min(1),
      displayName: z.string().optional()
    }),
    async (input) =>
      withBootstrap(input, async () => registerAgent(workspaceRoot, input))
  );
  registerMcpTool(
    server,
    coordinator,
    "agent_list",
    "List registered agent profiles in this workspace.",
    gatedSchema({ includeMarkdown: z.boolean().optional() }),
    async (input) =>
      withBootstrap(input, async () =>
        listAgentProfiles(workspaceRoot, {
          includeMarkdown: input.includeMarkdown
        })
      )
  );
  registerMcpTool(
    server,
    coordinator,
    "agent_read_profile",
    "Read one registered agent profile from this workspace.",
    gatedSchema({ agentId: z.string().min(1) }),
    async (input) =>
      withBootstrap(input, async () =>
        readAgentProfile(workspaceRoot, input.agentId)
      )
  );
}
