import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  deriveSlotState,
  type AgentsSource,
  type ClientProcess,
  type McpLeaseSource,
  type PresenceSources,
  type RegistryFile,
  type SlotKey
} from "../src/core/session-slots.js";
import { writeFileAtomically } from "../src/core/write-coordination.js";
import {
  createSessionRegistry,
  REGISTRY_FILE_NAME,
  type SessionProbe,
  type SessionRegistry
} from "../src/daemon/session-registry.js";

export const HOST = "host-a";
export const NOW = Date.parse("2026-11-03T12:00:00.000Z");
export const STARTED = 1_793_747_271_627;
export const SESSION_A = "11111111-1111-4111-8111-111111111111";
export const SESSION_B = "22222222-2222-4222-8222-222222222222";
export const UNAVAILABLE: AgentsSource = {
  status: "unavailable",
  reason: "command_failed"
};

export const ARCHITECT: SlotKey = {
  workspaceId: "ws-1",
  threadId: "thread-1",
  profile: "claude-software-architect"
};

export const ARCHITECT_KEY = "ws-1:thread-1:claude-software-architect";

export function live(processes: ClientProcess[]): AgentsSource {
  return { status: "available", processes };
}

export function entry(
  pid: number,
  sessionId: string,
  startedAt = STARTED,
  status = "idle"
): ClientProcess {
  return { pid, startedAt, sessionId, status };
}

export type RegistryHarness = {
  dataDir: string;
  registry: SessionRegistry;
  probe: SessionProbe;
  clock: { value: number };
  setAgents(agents: AgentsSource): void;
  setLeases(leases: McpLeaseSource[]): void;
  advance(ms: number): void;
  failWrites(): void;
  readFile(): Promise<string>;
  readRegistry(): Promise<RegistryFile>;
  writeRaw(content: string): Promise<void>;
  cleanup(): Promise<void>;
};

/** Deterministic ids and clock; real files, so atomic writes are exercised. */
export async function createRegistryHarness(): Promise<RegistryHarness> {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "marc-session-"));
  const clock = { value: NOW };
  const sources: { agents: AgentsSource; leases: McpLeaseSource[] } = {
    agents: live([]),
    leases: []
  };
  const writer = { run: writeFileAtomically };
  let counter = 0;
  const registry = createSessionRegistry(dataDir, {
    now: () => new Date(clock.value).toISOString(),
    newSessionId: () => `session-${++counter}`,
    newOwnerToken: () => `token-${++counter}`,
    writeAtomic: (filePath, content) => writer.run(filePath, content)
  });
  const filePath = path.join(dataDir, REGISTRY_FILE_NAME);
  const probe: SessionProbe = async (binding) =>
    deriveSlotState(
      binding,
      { ...presence(sources.agents), mcpLeases: sources.leases },
      clock.value
    );

  return {
    dataDir,
    registry,
    probe,
    clock,
    setAgents: (agents) => {
      sources.agents = agents;
    },
    setLeases: (leases) => {
      sources.leases = leases;
    },
    advance: (ms) => {
      clock.value += ms;
    },
    failWrites: () => {
      writer.run = async () => {
        throw new Error("disk full");
      };
    },
    readFile: () => fs.readFile(filePath, "utf8"),
    readRegistry: async () =>
      JSON.parse(await fs.readFile(filePath, "utf8")) as RegistryFile,
    writeRaw: (content) => fs.writeFile(filePath, content, "utf8"),
    cleanup: () => fs.rm(dataDir, { recursive: true, force: true })
  };
}

export function presence(agents: AgentsSource): PresenceSources {
  return { hostId: HOST, agents, mcpLeases: [], listening: false };
}

export function iso(ms: number): string {
  return new Date(ms).toISOString();
}
