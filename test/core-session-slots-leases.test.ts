import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveSlotState,
  type PresenceSources,
  type SessionBinding,
  type SlotStateName
} from "../src/core/session-slots.js";
import {
  HOST,
  NOW,
  OTHER,
  SESSION,
  STARTED,
  binding,
  entry,
  iso,
  lease,
  live,
  withLeases
} from "./core-session-slots-fixtures.js";

type Row = {
  name: string;
  binding: SessionBinding;
  sources: PresenceSources;
  state: SlotStateName;
  reason: string;
};

const rows: Row[] = [
  {
    name: "a live MCP lease for the session blocks ended when the listing is empty",
    binding: binding(),
    sources: withLeases(live([]), [lease(SESSION, HOST)]),
    state: "unknown",
    reason: "lease_alive_unlisted"
  },
  {
    name: "a live lease also blocks a released binding from ending",
    binding: binding({
      endedAt: iso(-1000),
      owner: { clientPid: 100, clientStartedAt: STARTED }
    }),
    sources: withLeases(live([]), [lease(SESSION, HOST)]),
    state: "unknown",
    reason: "lease_alive_unlisted"
  },
  {
    name: "a lease for another session does not block the absence proof",
    binding: binding(),
    sources: withLeases(live([]), [lease(OTHER, HOST)]),
    state: "ended",
    reason: "owner_absent"
  },
  {
    name: "a lease on another host does not block the absence proof",
    binding: binding(),
    sources: withLeases(live([]), [lease(SESSION, "host-b")]),
    state: "ended",
    reason: "owner_absent"
  },
  {
    name: "a listed owner stays online even with a lease for its session",
    binding: binding(),
    sources: withLeases(live([entry()]), [lease(SESSION, HOST)]),
    state: "online",
    reason: "owner_listed"
  }
];

for (const row of rows) {
  test(`live MCP leases: ${row.name}`, () => {
    const result = deriveSlotState(row.binding, row.sources, NOW);
    assert.equal(result.state, row.state);
    assert.equal(result.details.reason, row.reason);
  });
}
