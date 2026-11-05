import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProcessTableRead } from "../src/core/process-table.js";
import {
  DENY,
  PERMISSION_TIMEOUT_MS
} from "../src/core/supervision-permissions.js";
import {
  createPermissionStore,
  type PermissionStore
} from "../src/daemon/supervision-permission-store.js";
import type { PermissionTarget } from "../src/daemon/supervision-runner.js";
import { get, send } from "./daemon-session-http-fixtures.js";
import {
  isoOf,
  parseReply,
  START_MS,
  supervisedThread,
  type Thread
} from "./daemon-supervision-fixtures.js";
import {
  dropBinding,
  RUN,
  seedBinding,
  TABLE_CHILD,
  TARGET_BY_STATE,
  VALID_BODY,
  rowsOf,
  runnerOf,
  targetOf
} from "./daemon-supervision-permission-fixtures.js";

type CreateRow = {
  name: string;
  state: "live" | "absent";
  table: ProcessTableRead;
  body: Record<string, unknown>;
  status: number;
};

const CREATE_ROWS: CreateRow[] = [
  {
    name: "a run that is not live is 404",
    state: "absent",
    table: TABLE_CHILD,
    body: VALID_BODY,
    status: 404
  },
  {
    name: "a claim from another parent is 403",
    state: "live",
    table: TABLE_CHILD,
    body: { ...VALID_BODY, ppid: 9999 },
    status: 403
  },
  {
    name: "a process table that lists the MCP process under another parent is 403",
    state: "live",
    table: rowsOf([{ pid: 5000, ppid: 1111 }]),
    body: VALID_BODY,
    status: 403
  },
  {
    name: "a process table without the MCP process is 403",
    state: "live",
    table: rowsOf([]),
    body: VALID_BODY,
    status: 403
  },
  {
    name: "a direct child of the turn is accepted",
    state: "live",
    table: TABLE_CHILD,
    body: VALID_BODY,
    status: 201
  },
  {
    name: "an unavailable process table leaves the parent claim to decide",
    state: "live",
    table: { status: "unavailable", reason: "command_failed" },
    body: VALID_BODY,
    status: 201
  },
  {
    name: "a body without the tool use id is 400",
    state: "live",
    table: TABLE_CHILD,
    body: { pid: 5000, ppid: 4242, toolName: "Write", input: {} },
    status: 400
  }
];

for (const row of CREATE_ROWS) {
  test(`supervision permissions route: create, ${row.name}`, async (t) => {
    const thread = await supervisedThread(t, {
      supervision: {
        runner: runnerOf(() => TARGET_BY_STATE[row.state](thread))
      },
      processes: { list: async () => row.table }
    });
    await seedBinding(thread);
    const reply = await send(
      thread.daemon.baseUrl,
      "POST",
      `/api/supervision/runs/${RUN}/permissions`,
      row.body
    );
    assert.equal(reply.status, row.status);
  });
}

type BindingRow = {
  name: string;
  seed: (thread: Thread) => Promise<void>;
  status: number;
};

/** The slot the run holds is read at the creation: any other binding, owner, generation or end refuses it. */
const BINDING_ROWS: BindingRow[] = [
  {
    name: "the supervisor's binding of the run's generation and owner is accepted",
    seed: (thread) => seedBinding(thread),
    status: 201
  },
  {
    name: "a binding of another generation refuses the request",
    seed: (thread) => seedBinding(thread, { generation: 2 }),
    status: 404
  },
  {
    name: "a binding taken by a manual open refuses the request",
    seed: (thread) => seedBinding(thread, { origin: "open" }),
    status: 404
  },
  {
    name: "a binding of another owner refuses the request",
    seed: (thread) =>
      seedBinding(thread, {
        owner: { ownerToken: "other-owner", reservedAt: isoOf(START_MS) }
      }),
    status: 404
  },
  {
    name: "an ended binding refuses the request",
    seed: (thread) => seedBinding(thread, { endedAt: isoOf(START_MS) }),
    status: 404
  },
  {
    name: "a missing binding refuses the request",
    seed: (thread) => dropBinding(thread),
    status: 404
  }
];

for (const row of BINDING_ROWS) {
  test(`supervision permissions route: binding, ${row.name}`, async (t) => {
    const thread = await supervisedThread(t, {
      supervision: {
        runner: runnerOf(() => targetOf(thread))
      },
      processes: { list: async () => TABLE_CHILD }
    });
    await row.seed(thread);
    const reply = await send(
      thread.daemon.baseUrl,
      "POST",
      `/api/supervision/runs/${RUN}/permissions`,
      VALID_BODY
    );
    assert.equal(reply.status, row.status);
  });
}

/** A gate the test opens by hand: a check that waits on it stays pending until the test releases it. */
function latch(): { wait: Promise<void>; open: () => void } {
  let release: () => void = () => undefined;
  const wait = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  return { wait, open: () => release() };
}

/** What the test holds while a create request waits: the target the runner reports, and the store. */
type Race = {
  reported: { target: PermissionTarget | undefined };
  permissions: PermissionStore;
};

type RaceRow = {
  name: string;
  /** What happens to the run while its checks wait: its turn ends, or nothing changes. */
  whileWaiting: (race: Race) => void;
  status: number;
  error: string | undefined;
  opened: number;
};

const RACE_ROWS: RaceRow[] = [
  {
    name: "a turn that ends while the checks wait refuses the request and opens nothing",
    whileWaiting: (race) => {
      race.reported.target = undefined;
      race.permissions.denyOpen(RUN, DENY.timeout);
    },
    status: 404,
    error: "run_not_found",
    opened: 0
  },
  {
    name: "a turn still live while the checks wait accepts the request",
    whileWaiting: () => undefined,
    status: 201,
    error: undefined,
    opened: 1
  }
];

for (const row of RACE_ROWS) {
  test(`supervision permissions route: race, ${row.name}`, async (t) => {
    const reached = latch();
    const released = latch();
    const race: Race = {
      reported: { target: undefined },
      permissions: createPermissionStore({ now: () => START_MS })
    };
    const thread = await supervisedThread(t, {
      supervision: {
        runner: runnerOf(() => race.reported.target),
        permissions: race.permissions
      },
      processes: {
        list: async () => {
          reached.open();
          await released.wait;
          return TABLE_CHILD;
        }
      }
    });
    race.reported.target = targetOf(thread);
    await seedBinding(thread);
    const pending = send(
      thread.daemon.baseUrl,
      "POST",
      `/api/supervision/runs/${RUN}/permissions`,
      VALID_BODY
    );
    await reached.wait;
    row.whileWaiting(race);
    released.open();
    const reply = await pending;
    assert.equal(reply.status, row.status);
    assert.equal(parseReply(reply).error, row.error);
    assert.equal(race.permissions.openFor(RUN).length, row.opened);
  });
}

test("supervision permissions route: a panel decision answers the MCP poll once, and the end of a run denies the rest", async (t) => {
  const clock = { ms: START_MS };
  const permissions = createPermissionStore({ now: () => clock.ms });
  const thread = await supervisedThread(t, {
    supervision: {
      runner: runnerOf(() => targetOf(thread)),
      permissions
    },
    processes: { list: async () => TABLE_CHILD }
  });
  await seedBinding(thread);
  const create = () =>
    send(
      thread.daemon.baseUrl,
      "POST",
      `/api/supervision/runs/${RUN}/permissions`,
      VALID_BODY
    );
  const poll = (requestId: string) =>
    get(
      thread.daemon.baseUrl,
      `/api/supervision/runs/${RUN}/permissions/${requestId}`
    );
  const decide = (requestId: string, decision: string) =>
    send(
      thread.daemon.baseUrl,
      "POST",
      `${thread.base}/supervision/permissions/${requestId}`,
      { decision }
    );

  const first = parseReply(await create()).requestId as string;
  assert.deepStrictEqual(parseReply(await poll(first)), { status: "open" });
  const panel = await decide(first, "allow");
  assert.equal(panel.status, 200);
  assert.deepStrictEqual(parseReply(panel), { status: "allow" });
  assert.deepStrictEqual(parseReply(await poll(first)), { status: "allow" });
  const repeat = await decide(first, "deny");
  assert.equal(repeat.status, 409);
  assert.equal(parseReply(repeat).error, "already_decided");

  const second = parseReply(await create()).requestId as string;
  permissions.denyOpen(RUN, DENY.notSupervised);
  assert.deepStrictEqual(parseReply(await poll(second)), {
    status: "deny",
    message: DENY.notSupervised
  });
  assert.equal((await decide(second, "allow")).status, 409);

  const other = await get(
    thread.daemon.baseUrl,
    `/api/supervision/runs/run-other/permissions/${second}`
  );
  assert.equal(other.status, 404);

  const third = parseReply(await create()).requestId as string;
  clock.ms += PERMISSION_TIMEOUT_MS;
  assert.deepStrictEqual(parseReply(await poll(third)), {
    status: "deny",
    message: DENY.timeout
  });
});
