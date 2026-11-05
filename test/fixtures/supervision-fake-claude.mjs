// A stand-in for `claude -p` in the supervised-turn tests. It prints the JSON the adapter reads, or
// misbehaves as its scenario says. The scenario is chosen by the environment variable FAKE_SCENARIO,
// through the table below, so this script holds no test decision of its own. It never talks to the
// daemon and never receives a token: the test that holds the token writes the stop file instead.
//
// Environment (test-only, never a token):
//   FAKE_SCENARIO            one key of SCENARIOS (default: success)
//   FAKE_TOTAL_COST_USD      the session total the JSON reports (default: 0.001)
//   FAKE_ARGV_FILE           where the script writes its argv, as JSON
//   FAKE_GRANDCHILD_PID_FILE where the "ignore" scenario writes the pid of its grandchild
//   FAKE_STOP_FILE           the "obey" scenario ends when this file exists

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

const argv = process.argv.slice(2);
const MODE_BY_FLAG = { "--resume": "resume", "--session-id": "new" };
const sessionFlag = Object.keys(MODE_BY_FLAG).find((flag) =>
  argv.includes(flag)
);
const ctx = {
  prompt: argv[0],
  sessionId: argv[argv.indexOf(sessionFlag) + 1],
  mode: MODE_BY_FLAG[sessionFlag],
  runId: process.env.MARC_SUPERVISOR_RUN_ID
};

// Without the variable the record goes to the null device, so the script never branches on recording.
fs.writeFileSync(
  process.env.FAKE_ARGV_FILE ?? os.devnull,
  JSON.stringify({ argv, ...ctx }),
  "utf8"
);

function resultOf(overrides = {}) {
  return {
    type: "result",
    subtype: "success",
    is_error: false,
    session_id: ctx.sessionId,
    total_cost_usd: Number(process.env.FAKE_TOTAL_COST_USD ?? "0.001"),
    duration_ms: 5,
    permission_denials: [],
    result: "done",
    ...overrides
  };
}

function finish(code, stdout, stderr = "") {
  process.stderr.write(stderr);
  process.stdout.write(stdout, () => process.exit(code));
}

/** Waits for the stop file the test writes once it has seen the stop notice, then ends as an obedient agent. */
async function obeyStop() {
  while (!fs.existsSync(process.env.FAKE_STOP_FILE ?? "")) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return finish(0, JSON.stringify(resultOf()));
}

/** Starts a grandchild, records its pid, and never ends on its own. Only the tree kill ends it. */
function ignoreStop() {
  const grandchild = spawn(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    { stdio: "ignore" }
  );
  fs.writeFileSync(
    process.env.FAKE_GRANDCHILD_PID_FILE ?? os.devnull,
    String(grandchild.pid),
    "utf8"
  );
  setInterval(() => {}, 1000);
}

/** One behavior per scenario. Each entry is the whole of what the fake client does. */
const SCENARIOS = {
  success: () => finish(0, JSON.stringify(resultOf())),
  obey: () => obeyStop(),
  ignore: () => ignoreStop(),
  fail: () => finish(1, "", "boom"),
  badjson: () => finish(0, "{not json"),
  wrongsession: () =>
    finish(0, JSON.stringify(resultOf({ session_id: "other-session" }))),
  iserror: () =>
    finish(
      0,
      JSON.stringify(
        resultOf({ is_error: true, subtype: "error_during_execution" })
      )
    )
};

SCENARIOS[process.env.FAKE_SCENARIO ?? "success"]();
