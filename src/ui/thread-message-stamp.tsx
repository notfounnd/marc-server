import type { ActivationStageId, Message, Translate } from "./types.js";
import { cardBadgeOf } from "./thread-message-marks.js";

/**
 * The one badge of a message card: the stage and cycle stamp of a stamped message, or the mark of the
 * message that advanced the thread. A message that advanced shows only the mark.
 */
export function ThreadMessageStamp({
  message,
  advancedTo,
  t
}: {
  message: Message;
  advancedTo: ActivationStageId | undefined;
  t: Translate;
}) {
  const badge = cardBadgeOf(message, advancedTo, t);
  if (!badge) return null;
  const className = badge.advanced
    ? "message-stamp message-stamp-advanced"
    : "message-stamp";
  return <span className={className}>{badge.label}</span>;
}
