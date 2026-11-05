import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { RegistryFile } from "../src/core/session-slots.js";
import { createSessionRegistry } from "../src/daemon/session-registry.js";
import {
  CLOCK_ISO,
  clock,
  legacyBinding,
  listNames,
  readJson,
  registryOf,
  stateHarness,
  threadPath
} from "./daemon-thread-state-fixtures.js";

const ARCHITECT = {
  workspaceId: "ws-a",
  threadId: "thread-1",
  profile: "claude-software-architect"
};

async function writeLegacy(dataDir: string, file: RegistryFile): Promise<void> {
  await fs.writeFile(
    path.join(dataDir, "sessions.json"),
    JSON.stringify(file, null, 2),
    "utf8"
  );
  await fs.writeFile(path.join(dataDir, "sessions.meta.json"), "{}\n", "utf8");
}

const LEGACY = registryOf([
  legacyBinding("ws-a", "thread-1", "claude-dev", 1),
  legacyBinding("ws-a", "thread-1", "claude-software-architect", 2),
  legacyBinding("ws-a", "thread-2", "claude-dev", 1),
  legacyBinding("ws-b", "thread-9", "codex-dev", 3)
]);

test("a legacy sessions.json splits into one state file per thread and keeps the original under a migration suffix", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  await writeLegacy(h.dataDir, LEGACY);

  const registry = createSessionRegistry(h.dataDir, { now: clock }, h.threads);
  await registry.prepare();

  assert.deepEqual(await listNames(path.join(h.dataDir, "threads", "ws-a")), [
    "thread-1.json",
    "thread-1.meta.json",
    "thread-2.json",
    "thread-2.meta.json"
  ]);
  const thread1 = await readJson(threadPath(h.dataDir, "ws-a", "thread-1"));
  assert.deepEqual(Object.keys(thread1.slots as object).sort(), [
    "ws-a:thread-1:claude-dev",
    "ws-a:thread-1:claude-software-architect"
  ]);
  assert.equal(thread1.generation, 2);
  assert.deepEqual(await listNames(path.join(h.dataDir, "threads", "ws-b")), [
    "thread-9.json",
    "thread-9.meta.json"
  ]);

  const top = await listNames(h.dataDir);
  assert.equal(top.includes("sessions.json"), false);
  assert.equal(top.includes("sessions.meta.json"), false);
  assert.deepEqual(
    top.filter((name) => name.startsWith("sessions")),
    [
      `sessions.json.migrated-${CLOCK_ISO.replace(/[:.]/g, "-")}`,
      `sessions.meta.json.migrated-${CLOCK_ISO.replace(/[:.]/g, "-")}`,
      "sessions.migration.json"
    ]
  );

  const merged = await registry.read();
  assert.equal(merged.status, "ready");
  assert.equal(
    Object.keys((merged as { file: RegistryFile }).file.slots).length,
    4
  );
});

test("rerunning the migration changes nothing", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  await writeLegacy(h.dataDir, LEGACY);
  await createSessionRegistry(h.dataDir, { now: clock }, h.threads).prepare();
  const before = await listNames(h.dataDir);
  const threadBefore = await fs.readFile(
    threadPath(h.dataDir, "ws-a", "thread-1"),
    "utf8"
  );

  await createSessionRegistry(h.dataDir, { now: clock }, h.threads).prepare();

  assert.deepEqual(await listNames(h.dataDir), before);
  assert.equal(
    await fs.readFile(threadPath(h.dataDir, "ws-a", "thread-1"), "utf8"),
    threadBefore
  );
});

test("a thread that already has a state file keeps it; the migration never overwrites newer state", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const newer = registryOf([
    legacyBinding("ws-a", "thread-1", "claude-software-architect", 7)
  ]);
  await fs.mkdir(path.join(h.dataDir, "threads", "ws-a"), { recursive: true });
  await h.threads.update({ workspaceId: "ws-a", threadId: "thread-1" }, () => ({
    value: undefined,
    file: newer
  }));
  await writeLegacy(h.dataDir, LEGACY);

  await createSessionRegistry(h.dataDir, { now: clock }, h.threads).prepare();

  const thread1 = await readJson(threadPath(h.dataDir, "ws-a", "thread-1"));
  assert.equal(thread1.generation, 7);
  assert.equal(
    (thread1.slots as Record<string, { generation: number }>)[
      "ws-a:thread-1:claude-software-architect"
    ]?.generation,
    7
  );
});

test("an invalid legacy registry is not migrated, is never rewritten, and fails closed for every operation", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  await fs.writeFile(path.join(h.dataDir, "sessions.json"), "{ broken", "utf8");
  const before = await listNames(h.dataDir);
  const registry = createSessionRegistry(h.dataDir, { now: clock }, h.threads);

  await registry.prepare();

  assert.deepEqual(await registry.read(), {
    status: "invalid",
    reason: "unreadable_json"
  });
  const unreachable = async () => {
    throw new Error("the probe must not run while the registry is invalid");
  };
  assert.deepEqual(
    await registry.acquire(
      { slot: ARCHITECT, expectedGeneration: 0, hostId: "host-a" },
      unreachable
    ),
    { decision: "refused", reason: "registry_invalid" }
  );
  assert.deepEqual(await listNames(h.dataDir), before);
  assert.equal(
    await fs.readFile(path.join(h.dataDir, "sessions.json"), "utf8"),
    "{ broken"
  );
  assert.deepEqual(
    await listNames(path.join(h.dataDir, "threads")).catch(() => []),
    []
  );
});

test("the renamed legacy file is never read as an authoritative fallback once a thread's state is gone", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  await writeLegacy(h.dataDir, LEGACY);
  const registry = createSessionRegistry(
    h.dataDir,
    {
      now: clock,
      newSessionId: () => "fresh-session",
      newOwnerToken: () => "fresh-token"
    },
    h.threads
  );
  await registry.prepare();
  await fs.rm(threadPath(h.dataDir, "ws-a", "thread-1"));
  await fs.rm(path.join(h.dataDir, "threads", "ws-a", "thread-1.meta.json"));

  const acquired = await registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: "host-a" },
    async () => ({
      state: "unbound",
      details: {
        busy: false,
        listening: false,
        reason: "test",
        pastConflict: false
      }
    })
  );

  assert.deepEqual(
    [
      acquired.decision,
      (acquired as { mode?: string }).mode,
      (acquired as { nativeSessionId?: string }).nativeSessionId
    ],
    ["acquired", "new", "fresh-session"]
  );
  const top = await listNames(h.dataDir);
  assert.ok(top.some((name) => name.startsWith("sessions.json.migrated-")));
});

test("a lost legacy registry, marker without data, fails closed and is not recreated", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  await fs.writeFile(
    path.join(h.dataDir, "sessions.meta.json"),
    "{}\n",
    "utf8"
  );
  const registry = createSessionRegistry(h.dataDir, { now: clock }, h.threads);

  await registry.prepare();

  assert.deepEqual(await registry.read(), {
    status: "invalid",
    reason: "registry_lost"
  });
  assert.deepEqual(await listNames(h.dataDir), ["sessions.meta.json"]);
});
