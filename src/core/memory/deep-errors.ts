export type MemoryDeepErrorCode =
  | "thread_not_found"
  | "ambiguous_thread_id"
  | "invalid_thread_id"
  | "thread_not_closed"
  | "thread_not_indexed"
  | "invalid_source_types"
  | "invalid_limit";

/** A caller error of memory_deep. The MCP tool maps it to a tool error that carries this code. */
export class MemoryDeepError extends Error {
  constructor(
    readonly code: MemoryDeepErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "MemoryDeepError";
  }
}
