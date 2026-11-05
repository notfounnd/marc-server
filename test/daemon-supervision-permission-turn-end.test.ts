import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import { STOP_GRACE_MS } from "../src/core/activation-turn-timeout.js";
import type { SupervisionRecord } from "../src/core/activation-supervision-types.js";
import type { ProcessTableRead } from "../src/core/process-table.js";
import {
  DENY,
  denyWith,
  type PermissionDecision
} from "../src/core/supervision-permissions.js";
import {
  OS_PROCESS_TABLE,
  type ProcessTablePort
} from "../src/daemon/process-table-os.js";
import {
  permissionDecisionOf,
  type PermissionDeps,
  type PromptInput
} from "../src/mcp/permission-tool.js";
import { get, TOKEN } from "./daemon-session-http-fixtures.js";
import { parseReply } from "./daemon-supervision-fixtures.js";
import {
  advance,
  cardAction,
  cardFor,
  fakeClient,
  mention,
  stopFileOf,
  turnThread,
  waitForCards,
  type TurnThread
} from "./daemon-supervision-turn-fixtures.js";

/** The MCP process of the turn: a direct child of the turn's process, listed by the operating system table. */
const MCP_PID = 987654;
const PROMPT: PromptInput = {
  tool_name: "Write",
  input: { file_path: "a.txt", content: "A" },
  tool_use_id: "toolu_turn_end"
};

/** The operating system's table, with the MCP process added as a child of the turn. */
function tableOfTurn(turnPid: () => number): ProcessTablePort {
  return {
    list: async (): Promise<ProcessTableRead> => {
      const read = await OS_PROCESS_TABLE.list();
      if (read.status !== "available") return read;
      return {
        status: "available",
        rows: [...read.rows, { pid: MCP_PID, ppid: turnPid() }]
      };
    }
  };
}

function deadlineOf(record: SupervisionRecord): number {
  return Date.parse(record.turn?.deadlineAt ?? "");
}

function terminalWith(messageId: string, status: string) {
  return (cards: SupervisionRecord[]) =>
    cards.some(
      (card) => card.messageId === messageId && card.status === status
    );
}

/** Approves a mention and waits until its turn runs, so the card carries the turn's pid and run id. */
async function runningTurn(
  thread: TurnThread,
  messageId: string
): Promise<SupervisionRecord> {
  await cardAction(thread, "approve", messageId);
  const records = await waitForCards(thread, (cards) =>
    cards.some(
      (card) =>
        card.messageId === messageId &&
        card.status === "running" &&
        card.turn?.pid !== undefined
    )
  );
  return cardFor(records, messageId);
}

/** Waits until the panel shows an open request on the card, so the MCP's request is known to the daemon. */
async function waitForOpenRequest(
  thread: TurnThread,
  messageId: string
): Promise<void> {
  const deadline = Date.now() + 20_000;
  let open = await openRequestsOf(thread, messageId);
  while (open === 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    open = await openRequestsOf(thread, messageId);
  }
  assert.ok(open > 0, "the permission request did not open in time");
}

async function openRequestsOf(
  thread: TurnThread,
  messageId: string
): Promise<number> {
  const view = parseReply(await get(thread.daemon.baseUrl, thread.base)) as {
    supervision: { messageId: string; permissions: unknown[] }[];
  };
  return (
    view.supervision.find((card) => card.messageId === messageId)?.permissions
      .length ?? 0
  );
}

/** The tool's own deps: its run from the environment, the daemon, and real waits between its polls. */
function toolDeps(
  thread: TurnThread,
  runId: string,
  turnPid: number
): PermissionDeps {
  return {
    env: { MARC_SUPERVISOR_RUN_ID: runId },
    connection: { daemonUrl: thread.daemon.baseUrl, token: TOKEN },
    pid: MCP_PID,
    ppid: turnPid,
    fetch: globalThis.fetch,
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    timeoutMs: 600_000,
    pollMs: 25
  };
}

/** How each turn ends while its request is open. Each ending is the whole of what the test does. */
const ENDINGS: Record<
  "stop" | "deadline",
  (
    thread: TurnThread,
    card: SupervisionRecord,
    messageId: string
  ) => Promise<void>
> = {
  stop: async (thread, _card, messageId) => {
    await fs.writeFile(stopFileOf(thread), "", "utf8");
    await waitForCards(thread, terminalWith(messageId, "done"));
  },
  deadline: async (thread, card, messageId) => {
    advance(thread.clock, deadlineOf(card) - thread.clock.ms);
    advance(thread.clock, STOP_GRACE_MS);
    await waitForCards(thread, terminalWith(messageId, "failed"));
  }
};

type EndRow = {
  name: string;
  scenario: "obey" | "ignore";
  end: "stop" | "deadline";
  message: PermissionDecision;
};

const END_ROWS: EndRow[] = [
  {
    name: "a turn that ends normally denies its open request as not a supervised turn",
    scenario: "obey",
    end: "stop",
    message: denyWith(DENY.notSupervised)
  },
  {
    name: "a turn killed at its deadline denies its open request as timeout, and the kill changes nothing",
    scenario: "ignore",
    end: "deadline",
    message: denyWith(DENY.timeout)
  }
];

for (const row of END_ROWS) {
  test(`permission request of a supervised turn: ${row.name}`, async (t) => {
    let turnPid = -1;
    const thread = await turnThread(
      t,
      "production",
      tableOfTurn(() => turnPid)
    );
    fakeClient(thread, row.scenario, "0.001");
    const messageId = await mention(thread);
    const card = await runningTurn(thread, messageId);
    turnPid = card.turn?.pid ?? -1;
    const runId = card.runId ?? "";
    assert.ok(runId !== "" && turnPid > 0, "the turn must be running");
    const decision = permissionDecisionOf(
      PROMPT,
      toolDeps(thread, runId, turnPid)
    );
    await waitForOpenRequest(thread, messageId);
    await ENDINGS[row.end](thread, card, messageId);
    assert.deepStrictEqual(await decision, row.message);
  });
}
