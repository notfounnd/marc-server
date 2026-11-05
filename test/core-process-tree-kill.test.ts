import assert from "node:assert/strict";
import test from "node:test";
import {
  treeKillFor,
  turnSpawnOptionsFor,
  type TreeKillResult
} from "../src/core/process-tree-kill.js";

const PID = 4242;

const planRows: {
  name: string;
  platform: NodeJS.Platform;
  pid: number;
  expected: TreeKillResult;
}[] = [
  {
    name: "windows plans taskkill over the whole tree of the PID",
    platform: "win32",
    pid: PID,
    expected: {
      status: "planned",
      plan: {
        platform: "win32",
        command: "taskkill",
        args: ["/T", "/F", "/PID", "4242"]
      }
    }
  },
  {
    name: "linux plans SIGKILL on the turn's process group",
    platform: "linux",
    pid: PID,
    expected: {
      status: "planned",
      plan: { platform: "posix", signal: "SIGKILL", processGroup: PID }
    }
  },
  {
    name: "macOS plans SIGKILL on the turn's process group",
    platform: "darwin",
    pid: PID,
    expected: {
      status: "planned",
      plan: { platform: "posix", signal: "SIGKILL", processGroup: PID }
    }
  },
  {
    name: "PID 0 is never planned",
    platform: "win32",
    pid: 0,
    expected: { status: "refused", reason: "invalid_pid" }
  },
  {
    name: "PID 1 is never planned, even on POSIX",
    platform: "linux",
    pid: 1,
    expected: { status: "refused", reason: "invalid_pid" }
  },
  {
    name: "a fractional PID is refused",
    platform: "win32",
    pid: 1.5,
    expected: { status: "refused", reason: "invalid_pid" }
  },
  {
    name: "a negative PID is refused",
    platform: "linux",
    pid: -3,
    expected: { status: "refused", reason: "invalid_pid" }
  }
];

for (const row of planRows) {
  test(`tree kill plan: ${row.name}`, () => {
    assert.deepStrictEqual(treeKillFor(row.pid, row.platform), row.expected);
  });
}

const spawnRows: {
  name: string;
  platform: NodeJS.Platform;
  detached: boolean;
}[] = [
  {
    name: "windows does not detach, because taskkill walks the tree",
    platform: "win32",
    detached: false
  },
  {
    name: "linux detaches the turn into its own process group",
    platform: "linux",
    detached: true
  },
  {
    name: "macOS detaches the turn into its own process group",
    platform: "darwin",
    detached: true
  }
];

for (const row of spawnRows) {
  test(`turn spawn options: ${row.name}`, () => {
    assert.deepStrictEqual(turnSpawnOptionsFor(row.platform), {
      detached: row.detached,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
  });
}
