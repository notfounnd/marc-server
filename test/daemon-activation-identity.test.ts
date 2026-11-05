import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceInfo } from "../src/core/types.js";
import type { SessionBinding, SlotState } from "../src/core/session-slots.js";
import { slotKey } from "../src/core/session-slots.js";
import type { ResolvedIdentity } from "../src/daemon/presence.js";
import type { RegistryView } from "../src/daemon/session-registry.js";
import {
  verifyIdentityIn,
  type IdentityDeps
} from "../src/daemon/activation-agent-advance.js";
import { clock } from "./daemon-thread-state-fixtures.js";

const ARCHITECT = "claude-software-architect";
const SLOT = slotKey({
  workspaceId: "ws-1",
  threadId: "thread-1",
  profile: ARCHITECT
});
const WORKSPACE = { id: "ws-1" } as WorkspaceInfo;
const ONLINE: SlotState = {
  state: "online",
  details: {
    busy: true,
    listening: false,
    reason: "owner_listed",
    pastConflict: false
  }
};
const UNKNOWN: SlotState = {
  state: "unknown",
  details: {
    busy: false,
    listening: false,
    reason: "no_proof",
    pastConflict: false
  }
};
const RESOLVED: ResolvedIdentity = {
  nativeSessionId: "native-1",
  clientPid: 100,
  clientStartedAt: 5,
  hostId: "host-a"
};
const IDENTITY = {
  nativeSessionId: "native-1",
  pid: 100,
  ppid: 100,
  hostId: "host-a"
};

function bindingOf(clientStartedAt: number): SessionBinding {
  return {
    workspaceId: "ws-1",
    threadId: "thread-1",
    profile: ARCHITECT,
    client: "claude-code",
    nativeSessionId: "native-1",
    hostId: "host-a",
    origin: "open",
    generation: 1,
    owner: { clientPid: 100, clientStartedAt },
    boundAt: clock(),
    conflicts: []
  };
}

function registryWith(clientStartedAt: number): RegistryView {
  return {
    status: "ready",
    file: {
      version: 1,
      generation: 1,
      slots: { [SLOT]: bindingOf(clientStartedAt) }
    }
  };
}

type IdentityRow = {
  name: string;
  resolved: ResolvedIdentity;
  registry: RegistryView;
  state: SlotState;
  identity: typeof IDENTITY | undefined;
  expect: boolean;
};

/** Each row declares the presence answer, the registry and the slot state. Nothing is chosen at run time. */
const IDENTITY_ROWS: readonly IdentityRow[] = [
  {
    name: "a live owner at the same pid and start time, online, is verified",
    resolved: RESOLVED,
    registry: registryWith(5),
    state: ONLINE,
    identity: IDENTITY,
    expect: true
  },
  {
    name: "an identity without a verified start time is not verified",
    resolved: { ...RESOLVED, clientStartedAt: undefined },
    registry: registryWith(5),
    state: ONLINE,
    identity: IDENTITY,
    expect: false
  },
  {
    name: "another instance at the same pid is not verified",
    resolved: RESOLVED,
    registry: registryWith(6),
    state: ONLINE,
    identity: IDENTITY,
    expect: false
  },
  {
    name: "a slot that is not online is not verified",
    resolved: RESOLVED,
    registry: registryWith(5),
    state: UNKNOWN,
    identity: IDENTITY,
    expect: false
  },
  {
    name: "an invalid registry is not verified",
    resolved: RESOLVED,
    registry: { status: "invalid", reason: "registry_lost" },
    state: ONLINE,
    identity: IDENTITY,
    expect: false
  },
  {
    name: "a missing identity is not verified",
    resolved: RESOLVED,
    registry: registryWith(5),
    state: ONLINE,
    identity: undefined,
    expect: false
  }
];

for (const row of IDENTITY_ROWS) {
  test(`identity: ${row.name}`, async () => {
    const deps: IdentityDeps = {
      resolve: async () => row.resolved,
      read: async () => row.registry,
      probe: async () => row.state
    };
    assert.equal(
      await verifyIdentityIn(
        deps,
        WORKSPACE,
        "thread-1",
        ARCHITECT,
        row.identity
      ),
      row.expect
    );
  });
}
