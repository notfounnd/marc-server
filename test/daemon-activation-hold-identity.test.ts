import assert from "node:assert/strict";
import test from "node:test";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import {
  ARCHITECT,
  get,
  send,
  type Started
} from "./daemon-session-http-fixtures.js";
import {
  mention,
  parse,
  reservationBody,
  started,
  tableOf,
  TREE,
  WAITER_PID
} from "./daemon-activation-reservation-fixtures.js";

type HoldRow = { identityCheck?: string; reason: string };

/** A step the case runs before its mention: nothing, or a workspace pause. */
type Setup = (daemon: Started, workspaceId: string) => Promise<unknown>;

const NOTHING: Setup = async () => undefined;

const PAUSED: Setup = (daemon, workspaceId) =>
  send(
    daemon.baseUrl,
    "POST",
    `/api/workspaces/${workspaceId}/activation/pause`
  );

/**
 * The activation view carries the identity check of each identity hold, copied from the retained record. A
 * hold that is not an identity hold carries none, and a granted reservation leaves no hold.
 */
const CASES: ReadonlyArray<{
  name: string;
  pid: number | undefined;
  setup: Setup;
  identityChecks: Array<string | undefined>;
  reasons: string[];
}> = [
  {
    name: "a waiter without a pid is held with no_pid",
    pid: undefined,
    setup: NOTHING,
    identityChecks: ["no_pid"],
    reasons: ["identity_unverified"]
  },
  {
    name: "a waiter outside the tree is held with not_descendant",
    pid: 9999,
    setup: NOTHING,
    identityChecks: ["not_descendant"],
    reasons: ["identity_unverified"]
  },
  {
    name: "an identity failure under a pause keeps the pause hold, with no check",
    pid: undefined,
    setup: PAUSED,
    identityChecks: [undefined],
    reasons: ["workspace_paused"]
  },
  {
    name: "a granted waiter leaves no hold",
    pid: WAITER_PID,
    setup: NOTHING,
    identityChecks: [],
    reasons: []
  }
];

for (const row of CASES) {
  test(`activation holds: ${row.name}`, async (t) => {
    const { daemon, ws, base } = await started(
      t,
      tableOf({ status: "available", rows: TREE })
    );
    await row.setup(daemon, ws.info.id);
    const message = await appendMessageInWorkspace(ws.info, ws.threadId, {
      agentId: ARCHITECT,
      body: mention(),
      role: "architect"
    });
    await send(
      daemon.baseUrl,
      "POST",
      `${base}/reservations`,
      reservationBody(message.id, { pid: row.pid })
    );
    const view = parse(await get(daemon.baseUrl, base));
    const holds = view.holds as HoldRow[];
    assert.deepEqual(
      holds.map((hold) => hold.identityCheck),
      row.identityChecks
    );
    assert.deepEqual(
      holds.map((hold) => hold.reason),
      row.reasons
    );
  });
}
