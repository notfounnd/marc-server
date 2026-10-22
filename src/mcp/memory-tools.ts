import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  prepareMemory,
  readMemoryStatus,
  rebuildMemory,
  recallMemory
} from "../core/workspace-memory.js";
import { gatedSchema, withBootstrap } from "./responses.js";
import { McpToolCoordinator, registerMcpTool } from "./tool-registration.js";

export function registerMemoryTools(
  server: McpServer,
  workspaceRoot: string,
  coordinator: McpToolCoordinator
): void {
  registerMcpTool(
    server,
    coordinator,
    "memory_prepare",
    "Prepare the local summary-memory query interpretation, retrieval, and reranking model caches without rebuilding the committed memory index.",
    gatedSchema({}),
    async (input) =>
      withBootstrap(input, async () => prepareMemory(workspaceRoot))
  );
  registerMcpTool(
    server,
    coordinator,
    "memory_status",
    "Read summary-memory index health without loading local interpretation, retrieval, or reranking models.",
    gatedSchema({}),
    async (input) =>
      withBootstrap(input, async () => readMemoryStatus(workspaceRoot))
  );
  registerMcpTool(
    server,
    coordinator,
    "memory_rebuild",
    "Reconcile the committed summary-memory index by default. Pass mode full to explicitly rebuild every closed thread summary.",
    gatedSchema({ mode: z.enum(["incremental", "full"]).optional() }),
    async (input) =>
      withBootstrap(input, async () =>
        rebuildMemory(workspaceRoot, input.mode ?? "incremental")
      )
  );
  registerMcpTool(
    server,
    coordinator,
    "memory_recall",
    "Interpret a development intent when requested and recall relevant historical thread summaries before proposing or changing behavior. Each result has a heuristic confidence band (high, medium or low) that only orders results relative to each other; it is not a probability. abstained is true only when the search ran and admitted no thread.",
    gatedSchema({
      query: z.string().min(1),
      queryMode: z.enum(["auto", "literal"]).optional(),
      limit: z.number().int().positive().optional(),
      depth: z.number().int().min(0).max(3).optional(),
      minScore: z.never().optional().describe("Removed. Use depth from 0 to 3.")
    }),
    async (input) =>
      withBootstrap(input, async () =>
        recallMemory(workspaceRoot, {
          query: input.query,
          queryMode: input.queryMode,
          limit: input.limit,
          depth: input.depth
        })
      )
  );
}
