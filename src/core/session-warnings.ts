/**
 * Pending-action warnings for a thread's session view. Pure: it reuses the
 * mention parser from thread-mentions and adds no parser of its own.
 */
import { architectChainLength, mentionsProfile } from "./thread-mentions.js";
import type { ChatMessage } from "./types.js";

export const CHAIN_WARNING_LIMIT = 3;

export type WarningProfile = {
  id: string;
  role?: string;
};

export type SessionWarning =
  | { kind: "pending_mention"; profile: string; messageIds: string[] }
  | { kind: "chain_limit"; length: number; messageIds: string[] }
  | {
      kind: "awaiting_human";
      profile: string;
      messageIds: string[];
      /** The author of the last architect message that calls the human profile. */
      askedBy: string;
    };

export type WarningInput = {
  messages: readonly ChatMessage[];
  profiles: readonly WarningProfile[];
};

type WarningRule = (input: WarningInput) => SessionWarning[];

const WARNING_RULES: WarningRule[] = [
  pendingMentionWarnings,
  chainLimitWarnings,
  awaitingHumanWarnings
];

export function deriveSessionWarnings(input: WarningInput): SessionWarning[] {
  return WARNING_RULES.flatMap((rule) => rule(input));
}

/** Eligible mentions of a profile after that profile's own last message. */
function pendingMentionWarnings({
  messages,
  profiles
}: WarningInput): SessionWarning[] {
  return profiles
    .filter((profile) => profile.role !== "user")
    .flatMap((profile) => pendingFor(profile, messages));
}

function pendingFor(
  profile: WarningProfile,
  messages: readonly ChatMessage[]
): SessionWarning[] {
  const lastOwn = lastIndexWhere(
    messages,
    (message) => message.agentId === profile.id
  );
  const eligible = messages
    .slice(lastOwn + 1)
    .filter(
      (message) =>
        message.role !== "developer" &&
        mentionsProfile(message.body, profile.id)
    );
  if (eligible.length === 0) return [];
  return [
    {
      kind: "pending_mention",
      profile: profile.id,
      messageIds: eligible.map((message) => message.id)
    }
  ];
}

/** Architect messages since the last user message, as the wait command counts them. */
function chainLimitWarnings({ messages }: WarningInput): SessionWarning[] {
  const length = architectChainLength(messages);
  if (length < CHAIN_WARNING_LIMIT) return [];
  return [
    {
      kind: "chain_limit",
      length,
      messageIds: chainMessages(messages).map((message) => message.id)
    }
  ];
}

/** Architect messages that call a user profile and have no user message after them. */
function awaitingHumanWarnings({
  messages,
  profiles
}: WarningInput): SessionWarning[] {
  const cutoff = lastIndexWhere(messages, (message) => message.role === "user");
  return profiles
    .filter((profile) => profile.role === "user")
    .flatMap((profile): SessionWarning[] => {
      const asking = messages.filter(
        (message, index) =>
          index > cutoff &&
          message.role === "architect" &&
          mentionsProfile(message.body, profile.id)
      );
      const last = asking.at(-1);
      if (!last) return [];
      return [
        {
          kind: "awaiting_human",
          profile: profile.id,
          messageIds: asking.map((message) => message.id),
          askedBy: last.agentId
        }
      ];
    });
}

function chainMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  const start =
    lastIndexWhere(messages, (message) => message.role === "user") + 1;
  return messages
    .slice(start)
    .filter((message) => message.role === "architect");
}

function lastIndexWhere(
  messages: readonly ChatMessage[],
  predicate: (message: ChatMessage) => boolean
): number {
  return messages.reduce(
    (last, message, index) => (predicate(message) ? index : last),
    -1
  );
}
