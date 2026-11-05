import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  writeFileAtomically,
  type AtomicRename
} from "../src/core/write-coordination.js";

/** One planned rename outcome: it either fails with the given error, or performs the real rename. */
type Step = (sourcePath: string, destinationPath: string) => Promise<void>;

const realStep: Step = (sourcePath, destinationPath) =>
  fs.rename(sourcePath, destinationPath);

function failingStep(error: Error): Step {
  return () => Promise.reject(error);
}

function errorWithCode(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: rename refused`), { code });
}

/** A rename that follows the plan one call at a time, then performs the real rename. */
function scripted(plan: Step[]): { rename: AtomicRename; calls: () => number } {
  const remaining = [...plan];
  let calls = 0;
  const rename: AtomicRename = (sourcePath, destinationPath) => {
    calls += 1;
    const step = remaining.shift() ?? realStep;
    return step(sourcePath, destinationPath);
  };
  return { rename, calls: () => calls };
}

const NO_WAIT = async (): Promise<void> => undefined;

async function tempDir(t: { after(fn: () => unknown): void }): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marc-rename-retry-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

async function leftoverTemporaries(dir: string): Promise<string[]> {
  return (await fs.readdir(dir)).filter((name) => name.endsWith(".tmp"));
}

type TransientRow = { code: string; refusals: number };

const TRANSIENT_ROWS: TransientRow[] = [
  { code: "EPERM", refusals: 2 },
  { code: "EACCES", refusals: 1 },
  { code: "EBUSY", refusals: 3 }
];

for (const row of TRANSIENT_ROWS) {
  test(`a transient ${row.code} is retried and the write lands`, async (t) => {
    const dir = await tempDir(t);
    const target = path.join(dir, "policy.json");
    const failure = errorWithCode(row.code);
    const plan = Array.from({ length: row.refusals }, () =>
      failingStep(failure)
    );
    const { rename, calls } = scripted(plan);

    await writeFileAtomically(target, '{"ok":true}\n', {
      rename,
      wait: NO_WAIT
    });

    assert.equal(await fs.readFile(target, "utf8"), '{"ok":true}\n');
    assert.equal(calls(), row.refusals + 1);
    assert.deepEqual(await leftoverTemporaries(dir), []);
  });
}

test("a persistent EPERM gives up after the bounded attempts, rethrows the original error, and leaves no temporary file", async (t) => {
  const dir = await tempDir(t);
  const target = path.join(dir, "policy.json");
  const original = errorWithCode("EPERM");
  const { rename, calls } = scripted(
    Array.from({ length: 20 }, () => failingStep(original))
  );

  await assert.rejects(
    writeFileAtomically(target, "{}\n", { rename, wait: NO_WAIT }),
    (caught: unknown) => caught === original
  );

  assert.equal(calls(), 10);
  assert.deepEqual(await leftoverTemporaries(dir), []);
  await assert.rejects(fs.access(target));
});

type NonRetryableRow = { name: string; code: string };

const NON_RETRYABLE_ROWS: NonRetryableRow[] = [
  { name: "a full disk", code: "ENOSPC" },
  { name: "a missing folder", code: "ENOENT" }
];

for (const row of NON_RETRYABLE_ROWS) {
  test(`${row.name} is not retried: it fails at once with no temporary file left`, async (t) => {
    const dir = await tempDir(t);
    const target = path.join(dir, "policy.json");
    const original = errorWithCode(row.code);
    const { rename, calls } = scripted(
      Array.from({ length: 5 }, () => failingStep(original))
    );

    await assert.rejects(
      writeFileAtomically(target, "{}\n", { rename, wait: NO_WAIT }),
      (caught: unknown) => caught === original
    );

    assert.equal(calls(), 1);
    assert.deepEqual(await leftoverTemporaries(dir), []);
  });
}
