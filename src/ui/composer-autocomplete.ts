import { messageArtifactReference } from "../core/marc-references.js";
import { marcReferenceLabel } from "./marc-links.js";

export type ComposerAutocompleteKind = "agent" | "thread" | "message";

export type ComposerAutocompleteRequest = {
  kind: ComposerAutocompleteKind;
  token: string;
  query: string;
  start: number;
  end: number;
  threadId?: string;
};

export type ComposerAutocompleteOption = {
  type: "agent" | "thread" | "message" | "artifact";
  value: string;
  label: string;
  detail: string;
  closed?: boolean;
  parentMessageId?: string;
};

export type ComposerAutocompleteAgent = {
  id: string;
};

export type ComposerAutocompleteThread = {
  id: string;
  title: string;
  status?: "open" | "closed";
  closedAt?: string;
  summaryPath?: string;
};

export type ComposerAutocompleteMessage = {
  id: string;
  agentId: string;
  role?: string;
  body: string;
  artifacts: string[];
};

export type ComposerAutocompleteContext = {
  agents: ComposerAutocompleteAgent[];
  threads: ComposerAutocompleteThread[];
  currentMessages: ComposerAutocompleteMessage[];
  remoteMessages?: ComposerAutocompleteMessage[];
};

const TOKEN_PATTERN = /(?:^|[\s([{])([@#$][A-Za-z0-9._-]*|marc:\/\/[^\s\])}]*)$/;
const REMOTE_MESSAGE_PATTERN = /^marc:\/\/\$([A-Za-z0-9._-]+)\/#([A-Za-z0-9._-]*)$/;

export function detectAutocompleteRequest(value: string, cursor: number): ComposerAutocompleteRequest | undefined {
  const prefix = value.slice(0, cursor);
  const match = TOKEN_PATTERN.exec(prefix);
  if (!match) {
    return undefined;
  }

  const token = match[1];
  const start = cursor - token.length;
  if (token.startsWith("@")) {
    return { kind: "agent", token, query: token.slice(1), start, end: cursor };
  }
  if (token.startsWith("$")) {
    return { kind: "thread", token, query: token.slice(1), start, end: cursor };
  }
  if (token.startsWith("#")) {
    return { kind: "message", token, query: token.slice(1), start, end: cursor };
  }
  if (token.startsWith("marc://@")) {
    return { kind: "agent", token, query: token.slice("marc://@".length), start, end: cursor };
  }
  if (token.startsWith("marc://$")) {
    const remoteMessageMatch = REMOTE_MESSAGE_PATTERN.exec(token);
    if (remoteMessageMatch) {
      return {
        kind: "message",
        token,
        query: remoteMessageMatch[2],
        start,
        end: cursor,
        threadId: remoteMessageMatch[1],
      };
    }
    return { kind: "thread", token, query: token.slice("marc://$".length), start, end: cursor };
  }
  if (token.startsWith("marc://#")) {
    return { kind: "message", token, query: token.slice("marc://#".length), start, end: cursor };
  }

  return undefined;
}

export function getAutocompleteRemoteThreadId(request: ComposerAutocompleteRequest): string | undefined {
  return request.threadId;
}

export function buildAutocompleteOptions(
  request: ComposerAutocompleteRequest,
  context: ComposerAutocompleteContext,
): ComposerAutocompleteOption[] {
  if (request.kind === "agent") {
    return context.agents
      .map((agent) => ({
        type: "agent" as const,
        value: `marc://@${agent.id}`,
        label: `@${agent.id}`,
        detail: "Agent",
        search: agent.id,
      }))
      .filter((option) => matchesQuery(option.search, request.query))
      .map(({ search: _search, ...option }) => option);
  }

  if (request.kind === "thread") {
    return context.threads
      .map((thread) => {
        const closed = thread.status === "closed" || Boolean(thread.closedAt || thread.summaryPath);
        return {
          type: "thread" as const,
          value: `marc://$${thread.id}`,
          label: `$${thread.id}`,
          detail: closed ? "Closed thread" : "Open thread",
          closed,
          search: `${thread.id} ${thread.title} ${closed ? "closed" : "open"}`,
        };
      })
      .filter((option) => matchesQuery(option.search, request.query))
      .map(({ search: _search, ...option }) => option);
  }

  const messages = request.threadId ? context.remoteMessages ?? [] : context.currentMessages;
  return messages
    .flatMap((message) => {
      const messageReference = request.threadId
        ? `marc://$${request.threadId}/#${message.id}`
        : `marc://#${message.id}`;
      const messageOption = {
        type: "message" as const,
        value: messageReference,
        label: marcReferenceLabel(messageReference),
        detail: `${message.agentId}${message.role ? ` - ${message.role}` : ""}`,
        search: `${message.id} ${message.agentId} ${message.role ?? ""} ${message.body}`,
      };
      const artifactOptions = message.artifacts.map((artifact) => {
        const artifactReference = messageArtifactReference(message.id, artifact, request.threadId);
        const artifactFile = artifact.replace(/^artifacts\//, "");
        return {
          type: "artifact" as const,
          value: artifactReference,
          label: marcReferenceLabel(artifactReference),
          detail: `Artifact from #${message.id}`,
          parentMessageId: message.id,
          search: `${artifactFile} ${message.id} ${message.agentId} ${message.body}`,
        };
      });
      return [messageOption, ...artifactOptions];
    })
    .filter((option) => matchesQuery(option.search, request.query))
    .map(({ search: _search, ...option }) => option);
}

export function applyAutocompleteOption(
  value: string,
  request: ComposerAutocompleteRequest,
  reference: string,
): { value: string; cursor: number } {
  const nextValue = `${value.slice(0, request.start)}${reference}${value.slice(request.end)}`;
  return {
    value: nextValue,
    cursor: request.start + reference.length,
  };
}

function matchesQuery(value: string, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  return !normalizedQuery || value.toLowerCase().includes(normalizedQuery);
}
