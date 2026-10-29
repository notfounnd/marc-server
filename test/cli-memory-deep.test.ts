import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { tempWorkspace } from "./memory-test-helpers.js";

type CliRun = { code: number; stdout: string; stderr: string };

const CASES: ReadonlyArray<
  readonly [string, (root: string) => string[], boolean, RegExp]
> = [
  [
    "memory deep without --query prints the usage",
    (root) => ["memory", "deep", "--workspace", root],
    false,
    /Usage:[\s\S]*marc memory deep --query/
  ],
  [
    "memory deep with a limit above 20 is rejected before the index is read",
    (root) => [
      "memory",
      "deep",
      "--query",
      "toogle",
      "--limit",
      "21",
      "--workspace",
      root
    ],
    false,
    /memory_deep limit must be an integer from 1 to 20\./
  ],
  [
    "memory deep with rules and a thread is rejected",
    (root) => [
      "memory",
      "deep",
      "--query",
      "toogle",
      "--thread",
      "cafe0051",
      "--source-types",
      "rules",
      "--workspace",
      root
    ],
    false,
    /With threadId, memory_deep sourceTypes must be summary, artifact or chat\./
  ],
  [
    "memory deep with valid options prints the result as JSON",
    (root) => [
      "memory",
      "deep",
      "--query",
      "toogle",
      "--source-types",
      "summary,chat",
      "--limit",
      "3",
      "--query-mode",
      "literal",
      "--workspace",
      root
    ],
    true,
    /"mode": "unscoped"/
  ],
  [
    "a bare --thread flag fails instead of running unscoped",
    (root) => [
      "memory",
      "deep",
      "--query",
      "toogle",
      "--thread",
      "--workspace",
      root
    ],
    false,
    /--thread needs a value\./
  ],
  [
    "a bare --source-types flag fails instead of searching every source",
    (root) => [
      "memory",
      "deep",
      "--query",
      "toogle",
      "--source-types",
      "--workspace",
      root
    ],
    false,
    /--source-types needs a value\./
  ],
  [
    "a bare --limit flag fails instead of using the default limit",
    (root) => [
      "memory",
      "deep",
      "--query",
      "toogle",
      "--limit",
      "--workspace",
      root
    ],
    false,
    /--limit needs a value\./
  ],
  [
    "a bare --query-mode flag fails instead of using auto",
    (root) => [
      "memory",
      "deep",
      "--query",
      "toogle",
      "--query-mode",
      "--workspace",
      root
    ],
    false,
    /--query-mode needs a value\./
  ]
];

CASES.forEach(([label, args, succeeds, pattern]) => {
  test(`the marc CLI: ${label}`, async () => {
    const info = await tempWorkspace();
    const run = await runCli(args(info.rootPath));

    assert.equal(run.code === 0, succeeds, run.stderr);
    assert.match(run.stdout + run.stderr, pattern);
  });
});

function runCli(args: string[]): Promise<CliRun> {
  return new Promise<CliRun>((resolve) => {
    execFile(
      process.execPath,
      ["--import", "tsx", "src/cli.ts", ...args],
      { cwd: process.cwd(), timeout: 120000 },
      (error, stdout, stderr) => {
        resolve({ code: Number(error?.code ?? 0), stdout, stderr });
      }
    );
  });
}
