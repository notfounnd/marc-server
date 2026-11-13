import assert from "node:assert/strict";
import test from "node:test";
import type { SlotState } from "../src/core/session-slots.js";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import {
  stateViewOf,
  type ThreadDiagnostics
} from "../src/daemon/diagnostics-view.js";
import { isRegistryFile } from "../src/daemon/session-file.js";
import { ARCHITECT, get, send } from "./daemon-session-http-fixtures.js";
import {
  CODEX,
  mention,
  patchStateFile,
  reservationBody,
  started
} from "./daemon-activation-reservation-fixtures.js";

/** The parts of the thread state file these tests patch. */
type StateFile = {
  slots: Record<string, { profile: string; owner: Record<string, unknown> }>;
  supervision?: {
    records: Array<Record<string, unknown>>;
    floors: Record<string, string>;
  };
};

function codexBinding(file: StateFile) {
  return Object.values(file.slots).find((item) => item.profile === CODEX);
}

const AT = "2026-11-03T12:00:00.000Z";

/** A synthetic extra field in the conflict or the outcome passes the validator and never reaches the response. */
test("the nested conflict and outcome carry only their public fields", async (t) => {
  const { daemon, ws, base } = await started(t);
  const message = await appendMessageInWorkspace(ws.info, ws.threadId, {
    agentId: ARCHITECT,
    body: mention(),
    role: "architect"
  });
  await send(
    daemon.baseUrl,
    "POST",
    `${base}/reservations`,
    reservationBody(message.id)
  );
  await patchStateFile<StateFile>(
    daemon.dataDir,
    ws.info.id,
    ws.threadId,
    (file) => {
      const binding = codexBinding(file);
      assert.ok(binding);
      Object.assign(binding, {
        conflicts: [
          { sessionId: "session-conflict", at: AT, ownerToken: "CANARY_OWNER" }
        ]
      });
      file.supervision = {
        floors: {},
        records: [
          {
            messageId: "msg_outcome_fixture",
            messageAt: AT,
            recipient: CODEX,
            stage: "planning",
            status: "failed",
            createdAt: AT,
            expiresAt: AT,
            attempt: 1,
            outcome: { denials: 2, failure: "error", runId: "CANARY_RUN" }
          }
        ]
      };
      assert.equal(isRegistryFile(file), true);
    }
  );
  const reply = await get(
    daemon.baseUrl,
    `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/diagnostics`
  );
  assert.equal(reply.status, 200);
  for (const canary of ["CANARY_OWNER", "CANARY_RUN", "ownerToken", "runId"]) {
    assert.equal(reply.text.includes(canary), false, `leaked ${canary}`);
  }
  const view = JSON.parse(reply.text) as ThreadDiagnostics;
  assert.equal(view.registry.status, "ready");
  const slot = view.slots.find((item) => item.profile === CODEX);
  assert.deepEqual(slot?.binding.conflicts, [
    { sessionId: "session-conflict", at: AT }
  ]);
  assert.deepEqual(view.supervision[0].outcome, {
    denials: 2,
    failure: "error"
  });
});

/** The slot details are a closed list: a field added to the derived state never leaves through the view. */
test("the slot details list only their public fields", () => {
  const state = {
    state: "online",
    details: {
      busy: false,
      listening: true,
      reason: "owner_listed",
      pastConflict: false,
      detailsCanary: "CANARY_DETAILS"
    }
  } as SlotState;
  const view = stateViewOf(state);
  assert.deepEqual(view, {
    state: "online",
    details: {
      busy: false,
      listening: true,
      reason: "owner_listed",
      pastConflict: false
    }
  });
  assert.equal(JSON.stringify(view).includes("CANARY_DETAILS"), false);
});
