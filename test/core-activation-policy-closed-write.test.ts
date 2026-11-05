import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { writeThreadPolicy } from "../src/core/activation-policy-store.js";
import type { ActivationPolicy } from "../src/core/activation-policy.js";
import {
  createThread,
  initWorkspace,
  writeThreadSummary
} from "../src/core/workspace.js";

function policyOf(enabled: boolean): ActivationPolicy {
  return {
    version: 2,
    revision: "rev-1",
    enabled,
    mode: "confirm",
    attemptCap: 2,
    pendingTtlMinutes: 60,
    updatedAt: "2026-11-10T00:00:00.000Z"
  };
}

async function exists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(
    () => true,
    () => false
  );
}

async function setup(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marc-policy-write-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const info = await initWorkspace(root);
  return { root, info };
}

const POLICY_CASES = [
  { name: "an enabled policy", enabled: true },
  { name: "a disabled policy", enabled: false }
];

for (const row of POLICY_CASES) {
  test(`a save to a closed thread writes nothing and reports closed, for ${row.name}`, async (t) => {
    const { root, info } = await setup(t);
    const closed = await createThread(root, "Closed work");
    await writeThreadSummary(root, { threadId: closed.id, body: "Done." });
    const file = path.join(info.marcPath, "threads", closed.id, "policy.json");

    const outcome = await writeThreadPolicy(
      info,
      closed.id,
      policyOf(row.enabled)
    );

    assert.equal(outcome, "closed");
    assert.equal(await exists(file), false);
  });

  test(`a save to an open thread still writes, for ${row.name}`, async (t) => {
    const { root, info } = await setup(t);
    const open = await createThread(root, "Open work");
    const file = path.join(info.marcPath, "threads", open.id, "policy.json");

    const outcome = await writeThreadPolicy(
      info,
      open.id,
      policyOf(row.enabled)
    );
    const saved = JSON.parse(await fs.readFile(file, "utf8")) as {
      enabled: boolean;
    };

    assert.equal(outcome, "written");
    assert.equal(saved.enabled, row.enabled);
  });
}
