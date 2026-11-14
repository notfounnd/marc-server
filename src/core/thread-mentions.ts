import {
  messageReferences,
  removeFencedMarkdownCode
} from "./audit/messages.js";
import { parseMarcReference } from "./marc-references.js";
import type { ChatMessage } from "./types.js";

export type WaitAuthor = { agentId: string; role?: string };

export type WaitChain = { count: number; max: number };

type MentionFields = {
  messageIds: string[];
  authors: WaitAuthor[];
  chain: WaitChain;
};

/** Only `waiting` lets a wait loop continue. Every other status ends it. */
export type WaitDecision =
  | { status: "waiting" }
  | { status: "thread_closed" }
  | { status: "cursor_not_found" }
  | ({ status: "mention" } & MentionFields)
  | ({ status: "chain_limit" } & MentionFields);

export type ReconcileInput = {
  messages: readonly ChatMessage[];
  afterMessageId: string;
  mention: string;
  architects: readonly string[];
  maxChain: number;
  closed: boolean;
};

const QUOTE_LINE_PATTERN = /^\s*>/;

/** Agent ids that a body calls. Code and quotes do not call: quoting a profile does not call it. */
export function mentionedAgentIds(body: string): string[] {
  const visible = removeQuoteLines(removeFencedMarkdownCode(body));
  return messageReferences(visible).flatMap((reference) => {
    const parsed = parseMarcReference(reference);
    if (parsed?.type !== "agent") return [];
    return [parsed.agentId];
  });
}

export function mentionsProfile(body: string, agentId: string): boolean {
  return mentionedAgentIds(body).includes(agentId);
}

/** The messages after the last user message. A user message starts a new count. */
export function messagesSinceLastUser(
  messages: readonly ChatMessage[]
): ChatMessage[] {
  return messages.slice(lastUserIndex(messages) + 1);
}

/**
 * Architect cycles since the last user message. A cycle opens when an architect
 * mentions another architect, and closes when that architect posts next. The
 * closing message opens nothing: it is the answer. Developer messages neither
 * count nor reset.
 */
export function architectCycleCount(
  messages: readonly ChatMessage[],
  profileArchitects: readonly string[]
): number {
  const architects = architectIdsOf(messages, profileArchitects);
  const pending = new Set<string>();
  let cycles = 0;
  for (const message of messagesSinceLastUser(messages)) {
    if (!isArchitectTurn(message, architects)) continue;
    if (pending.delete(message.agentId)) {
      cycles += 1;
      continue;
    }
    for (const target of mentionedAgentIds(message.body)) {
      if (target !== message.agentId && architects.has(target)) {
        pending.add(target);
      }
    }
  }
  return cycles;
}

export function reconcileMentions(input: ReconcileInput): WaitDecision {
  if (input.closed) return { status: "thread_closed" };

  const cursor = input.messages.findIndex(
    (message) => message.id === input.afterMessageId
  );
  if (cursor < 0) return { status: "cursor_not_found" };

  const eligible = input.messages
    .slice(cursor + 1)
    .filter(
      (message) =>
        message.role !== "developer" &&
        mentionsProfile(message.body, input.mention)
    );
  if (eligible.length === 0) return { status: "waiting" };

  const fields: MentionFields = {
    messageIds: eligible.map((message) => message.id),
    authors: uniqueAuthors(eligible),
    chain: {
      count: architectCycleCount(input.messages, input.architects),
      max: input.maxChain
    }
  };
  if (fields.chain.count >= fields.chain.max) {
    return { status: "chain_limit", ...fields };
  }
  return { status: "mention", ...fields };
}

function removeQuoteLines(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => !QUOTE_LINE_PATTERN.test(line))
    .join("\n");
}

/** The profile architects plus every author that has posted with the architect role. */
function architectIdsOf(
  messages: readonly ChatMessage[],
  profileArchitects: readonly string[]
): Set<string> {
  const ids = new Set(profileArchitects);
  const posted = messages.filter((message) => message.role === "architect");
  for (const message of posted) {
    ids.add(message.agentId);
  }
  return ids;
}

function isArchitectTurn(
  message: ChatMessage,
  architects: ReadonlySet<string>
): boolean {
  return message.role !== "developer" && architects.has(message.agentId);
}

function lastUserIndex(messages: readonly ChatMessage[]): number {
  return messages.reduce(
    (last, message, index) => (message.role === "user" ? index : last),
    -1
  );
}

function uniqueAuthors(messages: readonly ChatMessage[]): WaitAuthor[] {
  const byKey = new Map<string, WaitAuthor>();
  for (const message of messages) {
    byKey.set(`${message.agentId}\u0000${message.role ?? ""}`, {
      agentId: message.agentId,
      role: message.role
    });
  }
  return [...byKey.values()];
}
