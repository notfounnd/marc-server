import assert from "node:assert/strict";
import os from "node:os";
import { test } from "node:test";
import {
  DEFAULT_TURN_PORTS,
  launchTurn,
  OUTPUT_LIMIT,
  type RawOutput
} from "../src/daemon/supervision-turn-process.js";

const ENV: Record<string, string> = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined
  )
);
const TRUNCATED_MARK = "\n[output truncated]";

/**
 * Each row runs one process through the real spawn, without a shell, and checks what the executor sees:
 * whether it spawned, how it ended, and what it wrote.
 */
const PROCESS_ROWS: readonly {
  name: string;
  command: string;
  args: string[];
  check: (spawned: number | undefined, raw: RawOutput) => void;
}[] = [
  {
    name: "a command that is not installed never spawns, and names the missing client",
    command: "marc-l2-missing-client",
    args: [],
    check: (spawned, raw) => {
      assert.equal(spawned, undefined);
      assert.equal(raw.spawnError, "ENOENT");
      assert.equal(raw.exitCode, undefined);
    }
  },
  {
    name: "a process that exits with a code is reported with the code",
    command: process.execPath,
    args: ["-e", "process.exit(3)"],
    check: (spawned, raw) => {
      assert.equal(typeof spawned, "number");
      assert.equal(raw.exitCode, 3);
      assert.equal(raw.spawnError, undefined);
    }
  },
  {
    name: "an output longer than the limit is cut and marked",
    command: process.execPath,
    args: ["-e", `process.stdout.write("x".repeat(${OUTPUT_LIMIT + 100}))`],
    check: (_spawned, raw) => {
      assert.equal(raw.stdout.length, OUTPUT_LIMIT + TRUNCATED_MARK.length);
      assert.ok(raw.stdout.endsWith(TRUNCATED_MARK));
      assert.equal(raw.exitCode, 0);
    }
  },
  {
    name: "a short output is kept whole",
    command: process.execPath,
    args: ["-e", "process.stdout.write('{\"ok\":true}')"],
    check: (_spawned, raw) => {
      assert.equal(raw.stdout, '{"ok":true}');
    }
  }
];

for (const row of PROCESS_ROWS) {
  test(`turn process: ${row.name}`, async () => {
    const turn = launchTurn(
      DEFAULT_TURN_PORTS,
      { command: row.command, args: row.args, env: ENV, cwd: os.tmpdir() },
      process.platform
    );
    const spawned = await turn.spawned;
    const raw = await turn.finished;
    row.check(spawned, raw);
  });
}
