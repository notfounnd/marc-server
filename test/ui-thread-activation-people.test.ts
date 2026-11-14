import assert from "node:assert/strict";
import test from "node:test";
import {
  holdOriginOf,
  leadBodyOf,
  participantRowsOf
} from "../src/ui/thread-activation-people.js";
import { changeThreadLead } from "../src/ui/use-thread-activation.js";
import type { ActivationHoldView, ApiWrite, Message } from "../src/ui/types.js";

type Call = { path: string; body: unknown };

function recorder(): { calls: Call[]; api: ApiWrite } {
  const calls: Call[] = [];
  const api: ApiWrite = async <T>(path: string, body: unknown): Promise<T> => {
    calls.push({ path, body });
    return {} as T;
  };
  return { calls, api };
}

const ARCHITECTS = ["claude-software-architect", "codex-software-architect"];

const ROW_CASES: Array<{
  name: string;
  lead: string | null | undefined;
  leads: boolean[];
}> = [
  {
    name: "the first architect leads",
    lead: "claude-software-architect",
    leads: [true, false]
  },
  {
    name: "a human-chosen lead takes the mark",
    lead: "codex-software-architect",
    leads: [false, true]
  },
  {
    name: "no lead yet marks nobody",
    lead: null,
    leads: [false, false]
  }
];

for (const row of ROW_CASES) {
  test(`participants: ${row.name}`, () => {
    const rows = participantRowsOf(ARCHITECTS, row.lead, []);
    assert.deepEqual(
      rows.map((item) => item.leads),
      row.leads
    );
  });
}

const APPROVED_CASES: Array<{
  name: string;
  approved: string[];
  marks: boolean[];
}> = [
  {
    name: "an approved architect carries the approval mark",
    approved: ["codex-software-architect"],
    marks: [false, true]
  },
  {
    name: "no approval marks nobody",
    approved: [],
    marks: [false, false]
  },
  {
    name: "every approved architect carries the mark",
    approved: ARCHITECTS,
    marks: [true, true]
  }
];

for (const row of APPROVED_CASES) {
  test(`participants approval: ${row.name}`, () => {
    const rows = participantRowsOf(ARCHITECTS, null, row.approved);
    assert.deepEqual(
      rows.map((item) => item.approved),
      row.marks
    );
    assert.deepEqual(
      rows.map((item) => item.leads),
      [false, false]
    );
  });
}

const BODY_CASES: Array<{
  name: string;
  agentId: string;
  current: string | null | undefined;
  expectedLead: string | null;
}> = [
  {
    name: "a change names the lead the panel saw",
    agentId: "codex-software-architect",
    current: "claude-software-architect",
    expectedLead: "claude-software-architect"
  },
  {
    name: "a first lead expects no lead",
    agentId: "claude-software-architect",
    current: undefined,
    expectedLead: null
  }
];

for (const row of BODY_CASES) {
  test(`lead body: ${row.name}`, () => {
    assert.deepEqual(leadBodyOf(row.agentId, row.current), {
      agentId: row.agentId,
      expectedLead: row.expectedLead
    });
  });
}

test("a lead change puts the body on the lead route", async () => {
  const { calls, api } = recorder();
  await changeThreadLead(
    api,
    "ws-a",
    "thread-a",
    leadBodyOf("codex-software-architect", "claude-software-architect")
  );
  assert.deepEqual(calls, [
    {
      path: "/api/workspaces/ws-a/threads/thread-a/activation/lead",
      body: {
        agentId: "codex-software-architect",
        expectedLead: "claude-software-architect"
      }
    }
  ]);
});

const MESSAGE: Message = {
  id: "msg_held",
  threadId: "thread-a",
  timestamp: "2026-11-10T14:32:00.000Z",
  agentId: "codex-software-architect",
  role: "architect",
  body: "Mention.",
  artifacts: []
};

const HOLD: ActivationHoldView = {
  messageId: "msg_held",
  recipient: "claude-software-architect",
  stage: "planning",
  reason: "budget_exhausted"
};

const ORIGIN_CASES: Array<{
  name: string;
  messages: Message[];
  origin: { agentId: string; timestamp: string } | undefined;
}> = [
  {
    name: "a loaded mentioning message gives its author and time",
    messages: [MESSAGE],
    origin: {
      agentId: "codex-software-architect",
      timestamp: "2026-11-10T14:32:00.000Z"
    }
  },
  {
    name: "a message that is not loaded gives no origin",
    messages: [],
    origin: undefined
  }
];

for (const row of ORIGIN_CASES) {
  test(`hold origin: ${row.name}`, () => {
    assert.deepEqual(holdOriginOf(HOLD, row.messages), row.origin);
  });
}
