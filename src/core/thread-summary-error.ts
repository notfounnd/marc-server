export type ThreadSummaryErrorCode =
  | "invalid_input"
  | "invalid_thread"
  | "thread_not_found"
  | "summary_exists"
  | "summary_not_found"
  | "revision_conflict"
  | "metadata_invalid"
  | "path_invalid"
  | "write_failed";

const ERROR_MESSAGES: Record<ThreadSummaryErrorCode, string> = {
  invalid_input: "Summary input is invalid.",
  invalid_thread: "The thread identity is invalid.",
  thread_not_found: "The thread was not found.",
  summary_exists: "A different summary already exists for this thread.",
  summary_not_found: "The thread summary was not found.",
  revision_conflict: "The summary changed since the supplied revision.",
  metadata_invalid: "The existing summary metadata is invalid.",
  path_invalid: "The thread path is not a regular workspace path.",
  write_failed: "The summary could not be written."
};

export class ThreadSummaryError extends Error {
  constructor(
    readonly code: ThreadSummaryErrorCode,
    readonly details?: Record<string, string>
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = "ThreadSummaryError";
  }
}
