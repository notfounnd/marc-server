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
    "Prepare the local summary-memory embedding model cache without rebuilding the committed memory index.",
    gatedShape({}),
    async (input) =>
      withBootstrap(input, async () => prepareMemory(workspaceRoot))
  );

  server.tool(
    "memory_status",
    "Read summary-memory index health without loading the embedding model.",
    gatedShape({}),
    async (input) =>
      withBootstrap(input, async () => readMemoryStatus(workspaceRoot))
  );

  server.tool(
    "memory_rebuild",
    "Rebuild the committed summary-memory index from thread SUMMARY.md files.",
    gatedShape({}),
    async (input) =>
      withBootstrap(input, async () => rebuildMemory(workspaceRoot))
  );

  server.tool(
    "memory_recall",
    "Recall relevant historical thread summaries for a development intent before proposing or changing behavior.",
    gatedShape({
      query: z.string().min(1),
      limit: z.number().int().positive().optional(),
      minScore: z.number().min(0).max(1).optional()
    }),
    async (input) =>
      withBootstrap(input, async () =>
        recallMemory(workspaceRoot, {
          query: input.query,
          limit: input.limit,
          minScore: input.minScore
        })
      )
  );
}
