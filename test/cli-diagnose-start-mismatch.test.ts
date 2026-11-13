import assert from "node:assert/strict";
import test from "node:test";
import {
  runDiagnoseCommand,
  productionDiagnoseDeps
} from "../src/cli-diagnose-command.js";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import type { ThreadDiagnostics } from "../src/daemon/diagnostics-view.js";
import { ARCHITECT, send, TOKEN } from "./daemon-session-http-fixtures.js";
import {
  CLIENT_PID,
  CODEX,
  mention,
  patchStateFile,
  reservationBody,
  started
} from "./daemon-activation-reservation-fixtures.js";

/** The parts of the thread state file this test edits: the binding's recorded client start. */
type StateFile = {
  slots: Record<
    string,
    { profile: string; owner: { clientStartedAt?: number } }
  >;
};

/**
 * End to end, on a temporary daemon: a client that restarted after its slot was bound holds the waiter as
 * identity_unverified, and marc diagnose names start_mismatch as the check that failed.
 */
test("marc diagnose names the start_mismatch that holds a waiter", async (t) => {
  const { daemon, ws, base } = await started(t);
  await patchStateFile<StateFile>(
    daemon.dataDir,
    ws.info.id,
    ws.threadId,
    (file) => {
      const binding = Object.values(file.slots).find(
        (item) => item.profile === CODEX
      );
      assert.ok(binding);
      binding.owner.clientStartedAt = 999;
    }
  );
  const message = await appendMessageInWorkspace(ws.info, ws.threadId, {
    agentId: ARCHITECT,
    body: mention(),
    role: "architect"
  });
  const decision = JSON.parse(
    (
      await send(
        daemon.baseUrl,
        "POST",
        `${base}/reservations`,
        reservationBody(message.id)
      )
    ).text
  ) as { decision: string; reason?: string };
  assert.deepEqual(
    [decision.decision, decision.reason],
    ["held", "identity_unverified"]
  );

  const lines: string[] = [];
  const exitCode = await runDiagnoseCommand(
    {
      workspace: ws.root,
      thread: ws.threadId,
      "data-dir": daemon.dataDir,
      "daemon-url": daemon.baseUrl,
      profile: CODEX
    },
    { print: (line) => lines.push(line) },
    { ...productionDiagnoseDeps(), env: { MARC_TOKEN: TOKEN } }
  );
  assert.equal(exitCode, 0);
  const view = JSON.parse(lines.join("\n")) as ThreadDiagnostics;
  assert.equal(view.reservations.length, 1);
  assert.equal(view.reservations[0].reason, "identity_unverified");
  assert.equal(view.reservations[0].identityCheck, "start_mismatch");
  const slot = view.slots[0];
  assert.equal(slot.binding.clientStartedAt, 999);
  assert.deepEqual(
    slot.processes.map((item) => [item.pid, item.startedAt]),
    [[CLIENT_PID, 1000]]
  );
});
