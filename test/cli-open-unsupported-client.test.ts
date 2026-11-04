import assert from "node:assert/strict";
import test from "node:test";
import { runOpenCommand } from "../src/cli-open-command.js";
import { CODEX, VALUES, harness, outputJson } from "./cli-open-fixtures.js";

type Row = {
  name: string;
  values: Record<string, string | boolean>;
};

/** A Codex profile is refused before any daemon call, with exit 5, in both normal and dry-run form. */
const ROWS: Row[] = [
  {
    name: "a profile whose client is not supported is exit 5 before any acquire or launch",
    values: { ...VALUES, profile: CODEX }
  },
  {
    name: "--dry-run refuses an unsupported client the same way, with no acquire",
    values: { ...VALUES, profile: CODEX, "dry-run": true }
  }
];

for (const row of ROWS) {
  test(`marc open: ${row.name}`, async () => {
    const h = harness();
    const code = await runOpenCommand(row.values, h.output, h.deps);

    assert.equal(code, 5);
    const line = outputJson(h.lines);
    assert.equal(line.status, "input_error");
    assert.equal(line.reason, "unsupported_client");
    assert.equal(line.exitCode, 5);
    assert.deepEqual(h.client.calls, []);
    assert.deepEqual(h.launches, []);
  });
}

test("an unsupported client writes one en-US stderr line, the JSON outcome on stdout, and never reaches the daemon", async () => {
  const h = harness();
  const code = await runOpenCommand(
    { ...VALUES, profile: CODEX },
    h.output,
    h.deps
  );

  assert.equal(code, 5);
  assert.deepEqual(h.warnings, [
    `marc open: profile ${CODEX} does not run a supported client. Only Claude Code profiles can be opened for now.`
  ]);
  const line = outputJson(h.lines);
  assert.equal(line.status, "input_error");
  assert.equal(line.reason, "unsupported_client");
  assert.equal(line.profile, CODEX);
  assert.deepEqual(h.client.calls, []);
  assert.deepEqual(h.launches, []);
});
