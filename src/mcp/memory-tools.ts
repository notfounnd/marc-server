import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  MEMORY_SEARCH_DEPTH_RANGE_MESSAGE,
  MemoryDeepError,
  type MemoryDeepInput
} from "../core/memory/index.js";
import {
  deepMemory,
  prepareMemory,
  readMemoryStatus,
  rebuildMemory,
  recallMemory
} from "../core/workspace-memory.js";
import { gatedSchema, toolError, withBootstrap } from "./responses.js";
import { McpToolCoordinator, registerMcpTool } from "./tool-registration.js";

const DEEP_SOURCE_TYPE_SCHEMA = z.enum([
  "summary",
  "artifact",
  "rules",
  "document",
  "chat"
]);

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
      depth: z
        .number()
        .int()
        .min(0, MEMORY_SEARCH_DEPTH_RANGE_MESSAGE)
        .max(2, MEMORY_SEARCH_DEPTH_RANGE_MESSAGE)
        .optional(),
      minScore: z.never().optional().describe("Removed. Use depth from 0 to 2.")
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
  registerMcpTool(
    server,
    coordinator,
    "memory_deep",
    "Return passages with full provenance after memory_recall, when a recalled thread is closed and its details are missing, before reading the whole CHAT.md. With threadId, search one closed, indexed thread (sources summary, artifact and chat); at most 232 passages of that thread reach the reranker, and the reranking time grows with the passages reranked. In the E4 measurement, the 95th percentile of scoped calls was about 35 seconds on the reference machine. Without threadId, return the passages of the groups that depth 2 admits. score is the reranker's relevance, not a probability. abstained is true only when the search ran and admitted no group. Chat passages are intermediate context to confirm in the thread summary or final message.",
    gatedSchema({
      query: z.string().min(1),
      threadId: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Full thread id or 8-character hexadecimal suffix. The thread must be closed and indexed."
        ),
      sourceTypes: z.array(DEEP_SOURCE_TYPE_SCHEMA).min(1).optional(),
      queryMode: z.enum(["auto", "literal"]).optional(),
      limit: z.number().int().min(1).max(20).optional()
    }),
    async (input) => memoryDeepResponse(workspaceRoot, input)
  );
}

async function memoryDeepResponse(
  workspaceRoot: string,
  input: MemoryDeepInput & { bootstrapConfirmed?: boolean }
): Promise<CallToolResult> {
  try {
    return await withBootstrap(input, async () =>
      deepMemory(workspaceRoot, input)
    );
  } catch (error) {
    return deepErrorResponse(error);
  }
}

function deepErrorResponse(error: unknown): CallToolResult {
  if (!(error instanceof MemoryDeepError)) throw error;
  return toolError(error.code, error.message, error.details);
}
