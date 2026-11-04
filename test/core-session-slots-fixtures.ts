import type {
  ClientProcess,
  McpLeaseSource,
  PresenceSources,
  SessionBinding
} from "../src/core/session-slots.js";

export const NOW = Date.parse("2026-11-03T12:00:00.000Z");
export const HOST = "host-a";
export const SESSION = "11111111-1111-4111-8111-111111111111";
export const OTHER = "22222222-2222-4222-8222-222222222222";
export const STARTED = 1_793_747_271_627;

export function iso(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

export function binding(
  overrides: Partial<SessionBinding> = {}
): SessionBinding {
  return {
    workspaceId: "ws-1",
    threadId: "thread-1",
    profile: "claude-dev",
    client: "claude-code",
    nativeSessionId: SESSION,
    hostId: HOST,
    origin: "open",
    generation: 3,
    owner: {
      clientPid: 100,
      clientStartedAt: STARTED,
      ownerToken: "token",
      lastHeartbeatAt: iso(0)
    },
    boundAt: iso(-60_000),
    conflicts: [],
    ...overrides
  };
}

export function entry(overrides: Partial<ClientProcess> = {}): ClientProcess {
  return {
    pid: 100,
    startedAt: STARTED,
    sessionId: SESSION,
    status: "idle",
    ...overrides
  };
}

export function live(processes: ClientProcess[]): PresenceSources {
  return {
    hostId: HOST,
    agents: { status: "available", processes },
    mcpLeases: [],
    listening: false
  };
}

export const UNAVAILABLE: PresenceSources = {
  hostId: HOST,
  agents: { status: "unavailable", reason: "command_failed" },
  mcpLeases: [],
  listening: false
};

export function lease(nativeSessionId: string, hostId: string): McpLeaseSource {
  return { nativeSessionId, pid: 555, hostId };
}

export function withLeases(
  sources: PresenceSources,
  leases: McpLeaseSource[]
): PresenceSources {
  return { ...sources, mcpLeases: leases };
}
