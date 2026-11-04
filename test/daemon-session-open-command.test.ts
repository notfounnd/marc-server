import assert from "node:assert/strict";
import test from "node:test";
import {
  ARCHITECT,
  MARC_RUNTIME,
  TOKEN,
  get,
  registered,
  send,
  startDaemon,
  workspaceWithThread,
  type Started
} from "./daemon-session-http-fixtures.js";
import {
  SESSION_ID,
  agentsJson,
  startDaemonWithAgents
} from "./daemon-session-open-command-fixtures.js";
import { appendMessage } from "../src/core/workspace.js";
import { initialPrompt } from "../src/core/agent-launch.js";

const STARTED = 1_793_747_271_627;

type Workspace = Awaited<ReturnType<typeof workspaceWithThread>>;

type SlotView = {
  profile: string;
  state: string;
  profileHasMessages: boolean;
  openCommand: { argv: string[]; shell: string };
  copyCommand?: { text: string };
};

async function slotsOf(daemon: Started, ws: Workspace): Promise<SlotView[]> {
  const reply = await get(
    daemon.baseUrl,
    `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/sessions`
  );
  assert.equal(reply.status, 200);
  return (JSON.parse(reply.text) as { slots: SlotView[] }).slots;
}

async function stateOf(
  daemon: Started,
  ws: Workspace,
  profile: string
): Promise<string> {
  const slot = (await slotsOf(daemon, ws)).find(
    (candidate) => candidate.profile === profile
  );
  return slot?.state ?? "missing";
}

/** The eight-hex suffix that the short command names for a thread. */
function suffixOf(threadId: string): string {
  return threadId.slice(-8);
}

test("GET sessions gives every slot a short open command with the thread suffix, names the data directory and daemon URL that differ from the defaults, and carries no token", async () => {
  const daemon = await startDaemon();
  const ws = await workspaceWithThread();
  try {
    await registered(daemon, ws.info);
    const reply = await get(
      daemon.baseUrl,
      `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/sessions`
    );
    const slots = await slotsOf(daemon, ws);
    const architect = slots.find((slot) => slot.profile === ARCHITECT);

    assert.ok(architect);
    assert.equal(architect.openCommand.argv[0], MARC_RUNTIME.execPath);
    assert.equal(architect.openCommand.argv[1], MARC_RUNTIME.script);
    assert.deepEqual(architect.openCommand.argv.slice(-11), [
      "open",
      "--workspace",
      ws.root,
      "--thread",
      suffixOf(ws.threadId),
      "--profile",
      ARCHITECT,
      "--data-dir",
      daemon.dataDir,
      "--daemon-url",
      daemon.baseUrl
    ]);
    assert.equal(
      architect.openCommand.shell.endsWith(
        `'open' '--workspace' '${ws.root.replace(/\\/g, "/")}' '--thread' '${suffixOf(ws.threadId)}' '--profile' '${ARCHITECT}' '--data-dir' '${daemon.dataDir.replace(/\\/g, "/")}' '--daemon-url' '${daemon.baseUrl}'`
      ),
      true
    );
    assert.equal(reply.text.includes(TOKEN), false);
    assert.equal(reply.text.includes("route-owner-token"), false);
  } finally {
    await daemon.close();
  }
});

test("a heartbeat that names only the pid gets the start time from the agents source, so the owner reads online", async () => {
  const daemon = await startDaemonWithAgents(
    agentsJson({ pid: 4321, startedAt: STARTED, sessionId: SESSION_ID })
  );
  const ws = await workspaceWithThread();
  try {
    await registered(daemon, ws.info);
    const base = {
      workspaceId: ws.info.id,
      threadId: ws.threadId,
      profile: ARCHITECT
    };
    const acquire = await send(
      daemon.baseUrl,
      "POST",
      "/api/sessions/acquire",
      {
        ...base,
        expectedGeneration: 0
      }
    );
    assert.equal(acquire.status, 200);
    const grant = JSON.parse(acquire.text) as {
      generation: number;
      ownerToken: string;
    };
    assert.equal(await stateOf(daemon, ws, ARCHITECT), "reserved");

    const beat = await send(daemon.baseUrl, "POST", "/api/sessions/heartbeat", {
      ...base,
      generation: grant.generation,
      ownerToken: grant.ownerToken,
      clientPid: 4321
    });
    assert.equal(beat.status, 200);
    assert.equal(await stateOf(daemon, ws, ARCHITECT), "online");
  } finally {
    await daemon.close();
  }
});

test("a heartbeat whose pid is not listed keeps the reservation as it was", async () => {
  const daemon = await startDaemonWithAgents(
    agentsJson({ pid: 4321, startedAt: STARTED, sessionId: SESSION_ID })
  );
  const ws = await workspaceWithThread();
  try {
    await registered(daemon, ws.info);
    const base = {
      workspaceId: ws.info.id,
      threadId: ws.threadId,
      profile: ARCHITECT
    };
    const acquire = await send(
      daemon.baseUrl,
      "POST",
      "/api/sessions/acquire",
      {
        ...base,
        expectedGeneration: 0
      }
    );
    const grant = JSON.parse(acquire.text) as {
      generation: number;
      ownerToken: string;
    };

    const beat = await send(daemon.baseUrl, "POST", "/api/sessions/heartbeat", {
      ...base,
      generation: grant.generation,
      ownerToken: grant.ownerToken,
      clientPid: 999
    });
    assert.equal(beat.status, 200);
    assert.equal(await stateOf(daemon, ws, ARCHITECT), "reserved");
  } finally {
    await daemon.close();
  }
});

test("a posted but unlinked slot gets --new in its short command and the native new-session command, with no token", async () => {
  const daemon = await startDaemon();
  const ws = await workspaceWithThread();
  try {
    await registered(daemon, ws.info);
    await appendMessage(ws.root, ws.threadId, {
      agentId: ARCHITECT,
      body: "Posted before any binding."
    });
    const reply = await get(
      daemon.baseUrl,
      `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/sessions`
    );
    const architect = (await slotsOf(daemon, ws)).find(
      (slot) => slot.profile === ARCHITECT
    );

    assert.ok(architect);
    assert.equal(architect.state, "unbound");
    assert.equal(architect.profileHasMessages, true);
    assert.equal(architect.openCommand.argv.at(-1), "--new");
    assert.deepEqual(architect.copyCommand, {
      text: `claude '${initialPrompt(ws.threadId, ARCHITECT)}'`
    });
    assert.equal("openNewCommand" in architect, false);
    assert.equal(reply.text.includes(TOKEN), false);
    assert.equal(reply.text.includes("route-owner-token"), false);
  } finally {
    await daemon.close();
  }
});

test("a slot that never posted gets no --new, and a bound slot gets no copy command while it is reserved", async () => {
  const daemon = await startDaemon();
  const ws = await workspaceWithThread();
  try {
    await registered(daemon, ws.info);
    await appendMessage(ws.root, ws.threadId, {
      agentId: ARCHITECT,
      body: "Posted, then bound."
    });
    const acquire = await send(
      daemon.baseUrl,
      "POST",
      "/api/sessions/acquire",
      {
        workspaceId: ws.info.id,
        threadId: ws.threadId,
        profile: ARCHITECT,
        expectedGeneration: 0
      }
    );
    assert.equal(acquire.status, 200);

    const slots = await slotsOf(daemon, ws);
    const developer = slots.find((slot) => slot.profile === "claude-dev");
    const architect = slots.find((slot) => slot.profile === ARCHITECT);

    assert.ok(developer);
    assert.equal(developer.profileHasMessages, false);
    assert.equal(developer.openCommand.argv.includes("--new"), false);
    assert.deepEqual(developer.copyCommand, {
      text: `claude '${initialPrompt(ws.threadId, "claude-dev")}'`
    });
    assert.ok(architect);
    assert.equal(architect.state, "reserved");
    assert.equal(architect.profileHasMessages, true);
    assert.equal(architect.openCommand.argv.includes("--new"), false);
    assert.equal(architect.copyCommand, undefined);
  } finally {
    await daemon.close();
  }
});
