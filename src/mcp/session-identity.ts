/**
 * Per-process identity of one MCP server. It is created by the caller and
 * passed down, so tests can build several servers without sharing state.
 */

export type IdentityFields = {
  nativeSessionId?: string;
  client?: "claude-code";
  pid: number;
  ppid: number;
  hostId: string;
  identifiedAt?: string;
};

export type SessionIdentityInput = {
  env: NodeJS.ProcessEnv;
  pid: number;
  ppid: number;
  hostId: string;
  now?: () => string;
};

export type SessionIdentity = {
  readonly nativeSessionId: string | undefined;
  readonly client: "claude-code" | undefined;
  readonly pid: number;
  readonly ppid: number;
  readonly hostId: string;
  fields(): IdentityFields;
  markIdentified(): void;
  onIdentified(listener: () => void): () => void;
};

export function createSessionIdentity(
  input: SessionIdentityInput
): SessionIdentity {
  const nativeSessionId = readSessionId(input.env);
  const client = nativeSessionId === undefined ? undefined : "claude-code";
  const now = input.now ?? (() => new Date().toISOString());
  const listeners = new Set<() => void>();
  let identifiedAt: string | undefined;

  return {
    nativeSessionId,
    client,
    pid: input.pid,
    ppid: input.ppid,
    hostId: input.hostId,
    fields: () => ({
      nativeSessionId,
      client,
      pid: input.pid,
      ppid: input.ppid,
      hostId: input.hostId,
      identifiedAt
    }),
    markIdentified: () => {
      if (identifiedAt !== undefined) return;
      identifiedAt = now();
      for (const listener of listeners) listener();
    },
    onIdentified: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

function readSessionId(env: NodeJS.ProcessEnv): string | undefined {
  const value = env.CLAUDE_CODE_SESSION_ID?.trim();
  if (!value) return undefined;
  return value;
}
