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
  maxChain: number;
  closed: boolean;
};

const QUOTE_LINE_PATTERN = /^\s*>/;

/** A reference is a call only outside code and quotes: quoting a profile does not call it. */
export function mentionsProfile(body: string, agentId: string): boolean {
  const visible = removeQuoteLines(removeFencedMarkdownCode(body));
  return messageReferences(visible).some((reference) =>
    isAgentReference(reference, agentId)
  );
}

/** Architect messages since the last user message. Developer and unknown roles neither count nor reset. */
export function architectChainLength(messages: readonly ChatMessage[]): number {
  const start = lastUserIndex(messages) + 1;
  return messages.slice(start).filter((message) => message.role === "architect")
    .length;
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
      count: architectChainLength(input.messages),
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

function isAgentReference(reference: string, agentId: string): boolean {
  const parsed = parseMarcReference(reference);
  return parsed?.type === "agent" && parsed.agentId === agentId;
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
