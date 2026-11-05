import { readThreadPolicy } from "../core/activation-policy-store.js";
import {
  confirmReservation,
  prepareStamp,
  UI_MESSAGE_LIMIT,
  type ConfirmDecision,
  type ConfirmInput,
  type PreparedStamp
} from "../core/activation-reservation-records.js";
import {
  appendMessageInWorkspace,
  messagesOfThreadInWorkspace
} from "../core/threads.js";
import { isWrittenBy } from "../core/activation-advance.js";
import type { FixedStage } from "../core/activation-stages.js";
import type {
  ChatMessage,
  MessageInput,
  WorkspaceInfo
} from "../core/types.js";
import { reasonOf } from "./activation-ledger.js";
import { stageOfActivation } from "./activation-reservation-store.js";
import {
  isEnabled,
  scopeOf,
  viewOf,
  type ActivationServices
} from "./activation-views.js";
import type { ThreadScope, ThreadStore, ThreadUpdate } from "./thread-store.js";

/**
 * The stamp answer. `expectedStage` is the stage the thread stands on now, which the MCP sends
 * with an advance. It can differ from the stamp's stage when the open grant belongs to an earlier
 * stage.
 */
export type StampResponse =
  | ({ decision: "stamp"; expectedStage: FixedStage } & PreparedStamp)
  | { decision: "unavailable"; reason: string };

export type ConfirmResponse =
  | { decision: "answered" | "already" }
  | { decision: "refused"; reason: string };

/**
 * The prepare step of the stamp. It reads only, so it answers even while a reservation holds the
 * queue. Nothing changes: a failed post simply finds the same grant the next time.
 */
export async function prepareStampIn(
  threads: ThreadStore,
  scope: ThreadScope,
  agentId: string
): Promise<StampResponse> {
  const view = await threads.read(scope);
  if (view.status === "invalid") {
    return { decision: "unavailable", reason: view.reason };
  }
  const current = stageOfActivation(view.file.activation);
  return {
    decision: "stamp",
    expectedStage: current,
    ...prepareStamp(view.file.reservations ?? [], current, agentId)
  };
}

/**
 * The confirm step: marks the grant answered by this message, after the message is persisted. The
 * message must be in CHAT.md, in this thread, written by this agent; anything else is refused.
 */
export async function confirmIn(
  threads: ThreadStore,
  workspace: WorkspaceInfo,
  threadId: string,
  input: ConfirmInput
): Promise<ConfirmResponse> {
  const messages = await messagesOfThreadInWorkspace(workspace, threadId);
  const written = isWrittenBy(messages, {
    messageId: input.messageId,
    threadId,
    agentId: input.agentId
  });
  if (!written) return { decision: "refused", reason: "message_not_written" };
  const result = await threads.update<ConfirmDecision>(
    scopeOf(workspace, threadId),
    (file) => {
      const decision = confirmReservation(file.reservations ?? [], input);
      if (decision.decision !== "answered") return { value: decision };
      return {
        value: decision,
        file: { ...file, reservations: decision.records }
      };
    }
  );
  if (result.status === "closed") {
    return { decision: "refused", reason: "thread_closed" };
  }
  if (result.status === "invalid") {
    return { decision: "refused", reason: reasonOf(result.reason) };
  }
  return confirmResponseOf(result.value);
}

/**
 * A message posted through the UI route. When the thread's policy is enabled, the append and the
 * origin record run in one step of the thread's queue: a reservation judged in that queue never sees
 * the message without its record. When the state is closed, lost or invalid, the message is still
 * appended, without a record, so its mentions stay ineligible. The state never blocks a human post.
 * When the policy is disabled, the state file is not touched at all.
 */
export async function postUiMessageIn(
  services: ActivationServices,
  workspace: WorkspaceInfo,
  threadId: string,
  input: MessageInput
): Promise<ChatMessage> {
  const policy = viewOf(await readThreadPolicy(workspace, threadId));
  if (!isEnabled(policy)) {
    return appendMessageInWorkspace(workspace, threadId, input);
  }
  const written: { message?: ChatMessage } = {};
  let result: ThreadUpdate<ChatMessage>;
  try {
    result = await services.threads.update<ChatMessage>(
      scopeOf(workspace, threadId),
      async (file) => {
        const message = await appendMessageInWorkspace(
          workspace,
          threadId,
          input
        );
        written.message = message;
        return {
          value: message,
          file: { ...file, uiMessages: recordedUi(file.uiMessages, message) }
        };
      }
    );
  } catch (error) {
    return messageAfterFailure(written.message, error);
  }
  if (result.status === "done") return result.value;
  return appendMessageInWorkspace(workspace, threadId, input);
}

/**
 * A state write that fails after the append gives back the message already in CHAT.md. The post is
 * not repeated, and the mention stays ineligible: no record was written. An append that failed never
 * reached CHAT.md, so its error propagates as before.
 */
function messageAfterFailure(
  written: ChatMessage | undefined,
  error: unknown
): ChatMessage {
  if (written === undefined) throw error;
  return written;
}

function recordedUi(
  list: Array<{ messageId: string; at: string }> | undefined,
  message: ChatMessage
): Array<{ messageId: string; at: string }> {
  return [
    ...(list ?? []),
    { messageId: message.id, at: message.timestamp }
  ].slice(-UI_MESSAGE_LIMIT);
}

function confirmResponseOf(value: ConfirmDecision): ConfirmResponse {
  if (value.decision === "refused") {
    return { decision: "refused", reason: value.reason };
  }
  if (value.decision === "already") return { decision: "already" };
  return { decision: "answered" };
}
