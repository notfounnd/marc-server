import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  policyCandidate,
  validatePolicy
} from "../src/core/activation-policy.js";
import { writeThreadPolicy } from "../src/core/activation-policy-store.js";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import {
  registered,
  startDaemon,
  TOKEN
} from "./daemon-session-http-fixtures.js";
import { CLOCK_ISO } from "./daemon-thread-state-fixtures.js";
import { fixture, singleJsonLine, type Fixture } from "./cli-wait-fixtures.js";

type CliRun = { code: number; stdout: string };

/** The real CLI with a given environment. The daemon is reached through the flags and MARC_TOKEN. */
function runWaitWith(
  args: string[],
  env: Record<string, string>
): Promise<CliRun> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ["--import", "tsx", "src/cli.ts", "wait", ...args],
      {
        cwd: process.cwd(),
        timeout: 120000,
        env: { ...process.env, CLAUDE_CODE_SESSION_ID: "", ...env }
      },
      (error, stdout) => resolve({ code: Number(error?.code ?? 0), stdout })
    );
  });
}

async function enablePolicy(fx: Fixture): Promise<void> {
  const result = validatePolicy(
    policyCandidate({ enabled: true }, "rev-on", CLOCK_ISO)
  );
  if (!result.ok) throw new Error("fixture policy is invalid");
  await writeThreadPolicy(fx.info, fx.threadId, result.policy);
}

test("a governed mention whose author is not a registered architect is refused by the daemon: exit 8 with its reason", async (t) => {
  const daemon = await startDaemon();
  t.after(() => daemon.close());
  const fx = await fixture();
  t.after(() => fs.rm(fx.root, { recursive: true, force: true }));
  await registered(daemon, fx.info);
  await enablePolicy(fx);
  await appendMessageInWorkspace(fx.info, fx.threadId, {
    agentId: "claude-software-architect",
    role: "architect",
    body: "Please review marc://@claude-dev."
  });

  const run = await runWaitWith(
    [
      "--workspace",
      fx.root,
      "--thread",
      fx.threadId,
      "--mention",
      "claude-dev",
      "--since",
      fx.cursor,
      "--session",
      "session-under-test",
      "--data-dir",
      daemon.dataDir,
      "--daemon-url",
      daemon.baseUrl,
      "--timeout-minutes",
      "1"
    ],
    { MARC_TOKEN: TOKEN }
  );
  const line = singleJsonLine(run.stdout);

  assert.equal(run.code, 8);
  assert.equal(line.status, "activation_refused");
  assert.equal(
    (line.refused as Array<{ reason?: string }>)[0]?.reason,
    "ineligible_origin"
  );
});

test("a governed wait without a session cannot reach the daemon: exit 5 with session_required", async (t) => {
  const fx = await fixture();
  t.after(() => fs.rm(fx.root, { recursive: true, force: true }));
  await enablePolicy(fx);
  await appendMessageInWorkspace(fx.info, fx.threadId, {
    agentId: "claude-software-architect",
    role: "architect",
    body: "Please review marc://@claude-dev."
  });

  const run = await runWaitWith(
    [
      "--workspace",
      fx.root,
      "--thread",
      fx.threadId,
      "--mention",
      "claude-dev",
      "--since",
      fx.cursor,
      "--data-dir",
      path.join(fx.root, "no-daemon"),
      "--daemon-url",
      "http://127.0.0.1:1",
      "--timeout-minutes",
      "1"
    ],
    {}
  );
  const line = singleJsonLine(run.stdout);

  assert.deepEqual([run.code, line.status], [5, "error"]);
  assert.match(String(line.error), /session_required/);
});
