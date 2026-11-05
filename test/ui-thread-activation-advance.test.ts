import assert from "node:assert/strict";
import test from "node:test";
import { refusalTextOf } from "../src/ui/thread-activation-failures.js";
import {
  advanceStage,
  extendStage,
  threadStageActionPath
} from "../src/ui/use-thread-activation.js";
import type { ApiWrite } from "../src/ui/types.js";

type Call = { path: string; body: unknown };

/** A fake write call that records each path and body and answers an empty object. */
function recorder(): { calls: Call[]; api: ApiWrite } {
  const calls: Call[] = [];
  const api: ApiWrite = async <T>(path: string, body: unknown): Promise<T> => {
    calls.push({ path, body });
    return {} as T;
  };
  return { calls, api };
}

const identity = (key: string): string => key;

const REFUSAL_ROWS: Array<{ reason: string; text: string }> = [
  {
    reason: "not_ahead",
    text: "Choose a stage ahead of the current one."
  },
  {
    reason: "last_stage",
    text: "Review is the last stage. There is no next stage to advance to."
  },
  {
    reason: "stage_changed",
    text: "The stage changed while you were looking. Nothing moved; the panel shows the current stage."
  },
  {
    reason: "lead_changed",
    text: "The lead changed while you were looking. Nothing moved; the panel shows the current lead."
  },
  {
    reason: "not_architect",
    text: "Only an architect profile can lead this thread."
  },
  {
    reason: "same_lead",
    text: "This architect already leads the thread."
  },
  {
    reason: "ledger_restored",
    text: "Nothing was saved. The state is shown above."
  }
];

for (const row of REFUSAL_ROWS) {
  test(`refusal line: ${row.reason}`, () => {
    assert.equal(refusalTextOf(row.reason, identity), row.text);
  });
}

test("the stage path names the action on the thread", () => {
  assert.equal(
    threadStageActionPath("ws-a", "thread-a", "advance"),
    "/api/workspaces/ws-a/threads/thread-a/activation/advance"
  );
  assert.equal(
    threadStageActionPath("ws-a", "thread-a", "extend"),
    "/api/workspaces/ws-a/threads/thread-a/activation/extend"
  );
});

const ADVANCE_CALLS: Array<{
  name: string;
  expectedStage: string;
  to: "execution" | "review";
}> = [
  {
    name: "a planning thread advances to execution",
    expectedStage: "planning",
    to: "execution"
  },
  {
    name: "a planning thread skips straight to review",
    expectedStage: "planning",
    to: "review"
  }
];

for (const row of ADVANCE_CALLS) {
  test(`advance body: ${row.name}`, async () => {
    const { calls, api } = recorder();
    await advanceStage(api, "ws-a", "thread-a", row.expectedStage, row.to);
    assert.deepEqual(calls, [
      {
        path: "/api/workspaces/ws-a/threads/thread-a/activation/advance",
        body: { expectedStage: row.expectedStage, to: row.to }
      }
    ]);
  });
}

test("extend body names only the stage the human saw", async () => {
  const { calls, api } = recorder();
  await extendStage(api, "ws-a", "thread-a", "planning");
  assert.deepEqual(calls, [
    {
      path: "/api/workspaces/ws-a/threads/thread-a/activation/extend",
      body: { expectedStage: "planning" }
    }
  ]);
});
