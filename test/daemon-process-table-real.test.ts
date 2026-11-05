import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { test } from "node:test";
import { ancestorsOf } from "../src/core/process-table.js";
import { OS_PROCESS_TABLE } from "../src/daemon/process-table-os.js";

/**
 * A node process started by this test. It starts a grandchild and prints the grandchild's pid, then waits.
 * Only these two processes are started here, and only their verified pids are stopped at the end.
 */
const CHILD_SCRIPT = [
  "const { spawn } = require('node:child_process');",
  "const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });",
  "console.log(String(grandchild.pid));",
  "setInterval(() => {}, 1000);"
].join(" ");

function firstLine(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    child.stdout?.once("data", (chunk: Buffer) =>
      resolve(String(chunk).split(/\r?\n/)[0] ?? "")
    );
    child.once("error", reject);
  });
}

function stopIfRunning(pid: number): void {
  try {
    process.kill(pid);
  } catch {
    return;
  }
}

test("the operating system's table gives a grandchild's chain up to this test process", async (t) => {
  const child = spawn(process.execPath, ["-e", CHILD_SCRIPT], {
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true
  });
  const grandchildPid = Number(await firstLine(child));
  t.after(() => {
    child.kill();
    stopIfRunning(grandchildPid);
  });
  assert.ok(child.pid !== undefined);
  const read = await OS_PROCESS_TABLE.list();
  assert.ok("rows" in read, "the process table of this machine can be read");
  const chain = ancestorsOf(read.rows, grandchildPid);
  assert.deepEqual(chain.slice(0, 2), [child.pid, process.pid]);
});
