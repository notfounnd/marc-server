import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  tryWithWorkspaceWriteLock,
  workspaceWriteLockPath
} from "../src/core/write-coordination.js";

const STALE_AFTER_MS = 30000;
const ONE_HOUR_MS = 60 * 60 * 1000;

type LockCase = {
  name: string;
  mtimeAgeMs: number;
  expectedAcquired: boolean;
};

const LOCK_CASES: LockCase[] = [
  {
    name: "a lock left by a dead waiter, older than the stale window, is recovered",
    mtimeAgeMs: ONE_HOUR_MS,
    expectedAcquired: true
  },
  {
    name: "a fresh lock held by a live waiter is not taken over",
    mtimeAgeMs: 0,
    expectedAcquired: false
  }
];

LOCK_CASES.forEach((lockCase) =>
  test(`wait lock: ${lockCase.name}`, async () => {
    const marcPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "marc-wait-lock-")
    );
    const resource = "wait:thread-under-test:session-under-test";
    const lockPath = workspaceWriteLockPath(marcPath, resource);
    try {
      await fs.mkdir(lockPath, { recursive: true });
      await fs.writeFile(
        path.join(lockPath, "owner.json"),
        JSON.stringify({ pid: 999999, resource, token: "previous-owner" }),
        "utf8"
      );
      const when = new Date(Date.now() - lockCase.mtimeAgeMs);
      await fs.utimes(lockPath, when, when);

      const attempt = await tryWithWorkspaceWriteLock(
        marcPath,
        resource,
        async () => "resumed",
        { staleAfterMs: STALE_AFTER_MS }
      );

      assert.equal(attempt.acquired, lockCase.expectedAcquired);
    } finally {
      await fs.rm(marcPath, { recursive: true, force: true });
    }
  })
);
