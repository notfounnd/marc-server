import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { selectMemoryQualityCases } from "../scripts/memory-quality-selection.js";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const qualityScript = resolve(repositoryRoot, "scripts/memory-quality-v4.ts");
const qualityCases = [
  { family: "toggle", id: "toggle", query: "toggle" },
  { family: "toggle", id: "typo", query: "toogle" },
  {
    family: "security",
    id: "security",
    query: "interface token rotation security"
  }
];

test("keeps the full default quality-case selection", () => {
  assert.deepEqual(
    selectMemoryQualityCases(qualityCases, undefined, undefined),
    qualityCases
  );
});

test("preserves valid family and exact-query selection", () => {
  assert.deepEqual(
    selectMemoryQualityCases(qualityCases, "toggle", undefined),
    qualityCases.slice(0, 2)
  );
  assert.deepEqual(
    selectMemoryQualityCases(qualityCases, undefined, "toogle"),
    [qualityCases[1]]
  );
  assert.deepEqual(selectMemoryQualityCases(qualityCases, "toggle", "toogle"), [
    qualityCases[1]
  ]);
});

test("rejects an empty selection and identifies its filters", () => {
  assert.throws(
    () => selectMemoryQualityCases([], undefined, undefined),
    /No memory quality cases matched the default selection/
  );
  assert.throws(
    () =>
      selectMemoryQualityCases(qualityCases, "__unknown_family__", undefined),
    /No memory quality cases matched --family "__unknown_family__"/
  );
  assert.throws(
    () =>
      selectMemoryQualityCases(qualityCases, undefined, "__unknown_query__"),
    /No memory quality cases matched --query "__unknown_query__"/
  );
  assert.throws(
    () => selectMemoryQualityCases(qualityCases, "toggle", "__unknown_query__"),
    /--family "toggle" and --query "__unknown_query__"/
  );
});

function assertSelectionRejectedBeforeWorkspace(
  filters: string[],
  expectedError: RegExp
): void {
  const temporaryRoot = mkdtempSync(
    resolve(tmpdir(), "memory-quality-empty-selection-")
  );
  const workspaceRoot = resolve(temporaryRoot, "missing-workspace");

  try {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        qualityScript,
        "--workspace",
        workspaceRoot,
        ...filters
      ],
      { cwd: repositoryRoot, encoding: "utf8" }
    );
    const output = `${result.stdout}\n${result.stderr}`;

    assert.equal(result.error, undefined, result.error?.message);
    assert.notEqual(result.status, 0, output);
    assert.match(output, expectedError);
    assert.equal(existsSync(workspaceRoot), false);
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

test("rejects an unknown family before workspace setup in interpret-only mode", () => {
  assertSelectionRejectedBeforeWorkspace(
    ["--family", "__unknown_family__", "--interpret-only"],
    /No memory quality cases matched --family "__unknown_family__"/
  );
});

test("rejects a query without a matching case before workspace setup", () => {
  assertSelectionRejectedBeforeWorkspace(
    ["--query", "__unknown_quality_query__"],
    /No memory quality cases matched --query "__unknown_quality_query__"/
  );
});
