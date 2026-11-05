import assert from "node:assert/strict";
import { test } from "node:test";
import {
  claudeHeadlessArgs,
  type HeadlessLaunchInput
} from "../src/core/client-adapters.js";
import {
  DENY,
  PERMISSION_SUMMARY_CHARS,
  PERMISSION_TIMEOUT_MS,
  permissionLaunchArgs
} from "../src/core/supervision-permissions.js";
import {
  createPermissionStore,
  type PermissionStore
} from "../src/daemon/supervision-permission-store.js";
import { wireSupervision } from "../src/daemon/supervision-wiring.js";
import { isoOf, START_MS } from "./daemon-supervision-fixtures.js";

type StoreEnv = { clock: { ms: number }; store: PermissionStore };

/** A store on a fake clock, with request ids counted from one. */
function storeEnv(): StoreEnv {
  const clock = { ms: START_MS };
  let count = 0;
  const store = createPermissionStore({
    now: () => clock.ms,
    newId: () => {
      count += 1;
      return `req-${count}`;
    }
  });
  return { clock, store };
}

function openIn(store: PermissionStore, runId: string, input: unknown = {}) {
  return store.open({
    runId,
    workspaceId: "ws-1",
    threadId: "thread-1",
    toolName: "Write",
    input
  });
}

type StoreRow = { name: string; run: (env: StoreEnv) => void };

const STORE_ROWS: StoreRow[] = [
  {
    name: "an open request is listed for its run only",
    run: ({ store }) => {
      const record = openIn(store, "run-a");
      assert.deepStrictEqual(store.openFor("run-b"), []);
      assert.deepStrictEqual(
        store.openFor("run-a").map((view) => view.requestId),
        [record.requestId]
      );
    }
  },
  {
    name: "a panel decision settles the request once, and the next decision is a conflict",
    run: ({ store }) => {
      const record = openIn(store, "run-a");
      const first = store.decide({
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: record.requestId,
        decision: "allow"
      });
      const second = store.decide({
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: record.requestId,
        decision: "deny"
      });
      assert.deepStrictEqual(first, { outcome: "decided", status: "allow" });
      assert.deepStrictEqual(second, { outcome: "conflict", status: "allow" });
      assert.equal(store.query("run-a", record.requestId)?.status, "allow");
    }
  },
  {
    name: "a deny from the panel carries the user's message",
    run: ({ store }) => {
      const record = openIn(store, "run-a");
      store.decide({
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: record.requestId,
        decision: "deny"
      });
      assert.equal(
        store.query("run-a", record.requestId)?.message,
        DENY.userDenied
      );
    }
  },
  {
    name: "a decision for another thread is not found, and the request stays open",
    run: ({ store }) => {
      const record = openIn(store, "run-a");
      const outcome = store.decide({
        workspaceId: "ws-1",
        threadId: "thread-2",
        requestId: record.requestId,
        decision: "allow"
      });
      assert.deepStrictEqual(outcome, { outcome: "not_found" });
      assert.equal(store.query("run-a", record.requestId)?.status, "open");
    }
  },
  {
    name: "an unknown request is not found",
    run: ({ store }) => {
      const outcome = store.decide({
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: "nope",
        decision: "allow"
      });
      assert.deepStrictEqual(outcome, { outcome: "not_found" });
    }
  },
  {
    name: "the deadline denies the open requests of the run that expired, and not of another run",
    run: ({ clock, store }) => {
      const first = openIn(store, "run-a");
      clock.ms += PERMISSION_TIMEOUT_MS / 2;
      const other = openIn(store, "run-b");
      clock.ms += PERMISSION_TIMEOUT_MS / 2;
      assert.equal(store.query("run-a", first.requestId)?.status, "deny");
      assert.equal(
        store.query("run-a", first.requestId)?.message,
        DENY.timeout
      );
      assert.equal(store.query("run-b", other.requestId)?.status, "open");
    }
  },
  {
    name: "the deadline also denies the other open requests of the expired run",
    run: ({ clock, store }) => {
      const first = openIn(store, "run-a");
      const second = openIn(store, "run-a");
      clock.ms += PERMISSION_TIMEOUT_MS;
      assert.equal(
        store.query("run-a", first.requestId)?.message,
        DENY.timeout
      );
      assert.equal(
        store.query("run-a", second.requestId)?.message,
        DENY.timeout
      );
    }
  },
  {
    name: "the end of a turn denies its open requests with the given message, and later decisions conflict",
    run: ({ store }) => {
      const record = openIn(store, "run-a");
      store.denyOpen("run-a", DENY.notSupervised);
      assert.equal(
        store.query("run-a", record.requestId)?.message,
        DENY.notSupervised
      );
      const outcome = store.decide({
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: record.requestId,
        decision: "allow"
      });
      assert.deepStrictEqual(outcome, { outcome: "conflict", status: "deny" });
    }
  },
  {
    name: "a request is visible through its own run id only",
    run: ({ store }) => {
      const record = openIn(store, "run-a");
      assert.equal(store.query("run-b", record.requestId), undefined);
    }
  },
  {
    name: "the panel summary keeps the first 200 characters of the input",
    run: ({ store }) => {
      openIn(store, "run-a", { text: "x".repeat(1000) });
      const [view] = store.openFor("run-a");
      assert.equal(view.summary.length, PERMISSION_SUMMARY_CHARS);
      assert.deepStrictEqual(Object.keys(view).sort(), [
        "createdAt",
        "expiresAt",
        "requestId",
        "summary",
        "toolName"
      ]);
    }
  },
  {
    name: "a restart keeps no request: a new store does not know an old request id",
    run: ({ store }) => {
      const record = openIn(store, "run-a");
      const restarted = storeEnv().store;
      assert.equal(restarted.query("run-a", record.requestId), undefined);
    }
  }
];

for (const row of STORE_ROWS) {
  test(`permission store: ${row.name}`, () => {
    row.run(storeEnv());
  });
}

test("permission wiring: the deadline and the end of a turn deny the run's open requests", () => {
  const wiring = wireSupervision({
    now: () => isoOf(START_MS),
    host: () => {
      throw new Error("the host is not read by this test");
    }
  });
  const { permissions } = wiring.options;
  const first = permissions.open({
    runId: "run-w",
    workspaceId: "ws-1",
    threadId: "thread-1",
    toolName: "Write",
    input: {}
  });
  wiring.hooks.onDeadline("run-w");
  assert.equal(
    permissions.query("run-w", first.requestId)?.message,
    DENY.timeout
  );
  const second = permissions.open({
    runId: "run-w",
    workspaceId: "ws-1",
    threadId: "thread-1",
    toolName: "Write",
    input: {}
  });
  wiring.hooks.onTurnEnd("run-w");
  assert.equal(
    permissions.query("run-w", second.requestId)?.message,
    DENY.notSupervised
  );
});

type LaunchRow = { mode: "new" | "resume"; session: string };

const LAUNCH_ROWS: LaunchRow[] = [
  { mode: "new", session: "--session-id" },
  { mode: "resume", session: "--resume" }
];

for (const row of LAUNCH_ROWS) {
  test(`supervision launch: the prompt tool flags come last, after the session flag, for ${row.mode}`, () => {
    const input: HeadlessLaunchInput = {
      mode: row.mode,
      sessionId: "11111111-1111-4111-8111-111111111111",
      prompt: "read the thread",
      model: "claude-haiku-5-5",
      workspaceRoot: "C:/workspace",
      toolShell: "default",
      baseEnv: {},
      platform: "win32",
      extraArgs: permissionLaunchArgs()
    };
    const args = claudeHeadlessArgs(input);
    assert.deepStrictEqual(args.slice(-4), [
      row.session,
      input.sessionId,
      "--permission-prompt-tool",
      "mcp__mcp-marc__permission_prompt"
    ]);
  });
}
