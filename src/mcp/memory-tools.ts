import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  prepareMemory,
  readMemoryStatus,
  rebuildMemory,
  recallMemory
} from "../core/workspace-memory.js";
import { gatedShape, withBootstrap } from "./responses.js";

export function registerMemoryTools(
  server: McpServer,
  workspaceRoot: string
): void {
  server.tool(
    "memory_prepare",
    "Prepare the local summary-memory query interpretation, retrieval, and reranking model caches without rebuilding the committed memory index.",
    gatedShape({}),
    async (input) =>
      withBootstrap(input, async () => prepareMemory(workspaceRoot))
  );

  server.tool(
    "memory_status",
    "Read summary-memory index health without loading local interpretation, retrieval, or reranking models.",
    gatedShape({}),
    async (input) =>
      withBootstrap(input, async () => readMemoryStatus(workspaceRoot))
  );

  server.tool(
    "memory_rebuild",
    "Reconcile the committed summary-memory index by default. Pass mode full to explicitly rebuild every closed thread summary.",
    gatedShape({ mode: z.enum(["incremental", "full"]).optional() }),
    async (input) =>
      withBootstrap(input, async () =>
        rebuildMemory(workspaceRoot, input.mode ?? "incremental")
      )
  );

  server.tool(
    "memory_recall",
    "Interpret a development intent when requested and recall relevant historical thread summaries before proposing or changing behavior.",
    gatedShape({
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
