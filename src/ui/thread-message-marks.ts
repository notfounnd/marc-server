import { stageNameKeyOf } from "./thread-activation-draft.js";
import type {
  ActivationStageId,
  ActivationStageMove,
  Message,
  ThreadActivationView,
  Translate
} from "./types.js";

/** The stage each advancing message moved the thread to, keyed by message id. No loaded view gives no marks. */
export function advanceMarksOf(
  view: ThreadActivationView | undefined
): ReadonlyMap<string, ActivationStageId> {
  if (!view) return new Map();
  return new Map((view.stageHistory ?? []).flatMap(markOf));
}

function markOf(move: ActivationStageMove): Array<[string, ActivationStageId]> {
  if (move.messageId === undefined) return [];
  return [[move.messageId, move.to]];
}

/** The stamp text: the stage name, then the cycle when the message carries one. Undefined for an unstamped message. */
export function stampLabelOf(
  message: Message,
  t: Translate
): string | undefined {
  if (message.stage === undefined) return undefined;
  const stage = t(stageNameKeyOf(message.stage));
  if (message.cycle === undefined) return stage;
  return t("{{stage}} · cycle {{cycle}}", { stage, cycle: message.cycle });
}

/** The mark of the message that advanced the thread to a stage. Undefined when this message did not advance it. */
export function advancedLabelOf(
  stage: ActivationStageId | undefined,
  t: Translate
): string | undefined {
  if (stage === undefined) return undefined;
  return t("Advanced to {{stage}}", { stage: t(stageNameKeyOf(stage)) });
}

export type CardBadge = { advanced: boolean; label: string };

/**
 * The one badge a message card shows. The message that advanced the thread shows only its mark, so the
 * stage and cycle stamp it also carries does not repeat the same stage. Other stamped messages show the
 * stamp; an unstamped message with no mark shows nothing.
 */
export function cardBadgeOf(
  message: Message,
  advancedTo: ActivationStageId | undefined,
  t: Translate
): CardBadge | undefined {
  const advanced = advancedLabelOf(advancedTo, t);
  if (advanced) return { advanced: true, label: advanced };
  const stamp = stampLabelOf(message, t);
  if (stamp) return { advanced: false, label: stamp };
  return undefined;
}
