import assert from "node:assert/strict";
import test from "node:test";
import { appendMessage, registerAgent } from "../src/core/workspace.js";
import {
  ARCHITECT,
  get,
  registered,
  startDaemon,
  workspaceWithThread
} from "./daemon-session-http-fixtures.js";

const CODEX = "codex-software-architect";

type SlotView = {
  profile: string;
  state: string;
  profileHasMessages: boolean;
  openCommand?: unknown;
  copyCommand?: { text: string };
  copyBlockedReason?: string;
};

type Row = {
  name: string;
  profile: string;
  open: boolean;
  copy: boolean;
  blocked: string | undefined;
};

const rows: Row[] = [
  {
    name: "a Codex profile that posted has no open or copy command and names the client block",
    profile: CODEX,
    open: false,
    copy: false,
    blocked: "unsupported_client"
  },
  {
    name: "a Claude profile keeps its open and copy commands",
    profile: ARCHITECT,
    open: true,
    copy: true,
    blocked: undefined
  }
];

/** The slot of a profile in a thread where the Codex profile is unbound but has posted. */
async function slotOf(profile: string): Promise<SlotView> {
  const daemon = await startDaemon();
  const ws = await workspaceWithThread();
  try {
    await registerAgent(ws.root, {
      id: CODEX,
      role: "architect",
      model: "gpt-6.1-sol",
      description: "Codex profile for the unsupported client tests."
    });
    await appendMessage(ws.root, ws.threadId, {
      agentId: CODEX,
      role: "architect",
      body: "A post from the Codex profile."
    });
    await registered(daemon, ws.info);
    const reply = await get(
      daemon.baseUrl,
      `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/sessions`
    );
    assert.equal(reply.status, 200);
    const slots = (JSON.parse(reply.text) as { slots: SlotView[] }).slots;
    const slot = slots.find((candidate) => candidate.profile === profile);
    assert.ok(slot);
    return slot;
  } finally {
    await daemon.close();
  }
}

for (const row of rows) {
  test(`thread sessions view: ${row.name}`, async () => {
    const slot = await slotOf(row.profile);
    assert.equal(slot.state, "unbound");
    assert.equal(slot.openCommand !== undefined, row.open);
    assert.equal(slot.copyCommand !== undefined, row.copy);
    assert.equal(slot.copyBlockedReason, row.blocked);
  });
}
