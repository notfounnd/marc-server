import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  serializeRegistry,
  serializeRegistryMeta,
  REGISTRY_FILE_NAME,
  REGISTRY_META_FILE_NAME
} from "../src/daemon/session-file.js";
import { writeFileAtomically } from "../src/core/write-coordination.js";
import { stampFor } from "../src/daemon/marked-file.js";
import { createSessionRegistry } from "../src/daemon/session-registry.js";
import {
  MIGRATION_MARKER_NAME,
  migrateLegacySessions
} from "../src/daemon/legacy-sessions.js";
import {
  createThreadStore,
  THREADS_DIRECTORY
} from "../src/daemon/thread-store.js";
import {
  CLOCK_ISO,
  clock,
  legacyBinding,
  registryOf
} from "./daemon-thread-state-fixtures.js";

async function tempDataDir(t: {
  after(fn: () => unknown): void;
}): Promise<string> {
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-session-marker-")
  );
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  return dataDir;
}

/** Writes the F2 registry and its meta marker, as the F2 build left them. */
async function writeLegacy(
  dataDir: string,
  bindings: ReturnType<typeof legacyBinding>[]
): Promise<void> {
  const file = registryOf(bindings);
  await fs.writeFile(
    path.join(dataDir, REGISTRY_FILE_NAME),
    serializeRegistry(file)
  );
  await fs.writeFile(
    path.join(dataDir, REGISTRY_META_FILE_NAME),
    serializeRegistryMeta(CLOCK_ISO)
  );
}

const TWO_THREADS = [
  legacyBinding("ws-1", "thread-1", "claude-dev", 1),
  legacyBinding("ws-1", "thread-2", "claude-dev", 2)
];

test("a migrated registry stays healthy when sessions.json reappears invalid, in a new instance", async (t) => {
  const dataDir = await tempDataDir(t);
  await writeLegacy(dataDir, TWO_THREADS);
  assert.equal((await createSessionRegistry(dataDir).read()).status, "ready");

  await fs.writeFile(path.join(dataDir, REGISTRY_FILE_NAME), "{ not json");
  const fresh = await createSessionRegistry(dataDir).read();

  assert.equal(fresh.status, "ready");
  assert.equal(await exists(path.join(dataDir, MIGRATION_MARKER_NAME)), true);
});

test("an interrupted migration reruns in a new instance: existing thread state is kept, the rest is written, the marker is set", async (t) => {
  const dataDir = await tempDataDir(t);
  await writeLegacy(dataDir, TWO_THREADS);
  const threadOne = path.join(
    dataDir,
    THREADS_DIRECTORY,
    "ws-1",
    "thread-1.json"
  );
  await fs.mkdir(path.dirname(threadOne), { recursive: true });
  await fs.writeFile(
    threadOne,
    serializeRegistry({ version: 1, generation: 9, slots: {} })
  );

  const resumed = await createSessionRegistry(dataDir).read();

  assert.equal(resumed.status, "ready");
  assert.equal(await exists(path.join(dataDir, REGISTRY_FILE_NAME)), false);
  assert.equal(await exists(path.join(dataDir, MIGRATION_MARKER_NAME)), true);
  assert.equal(
    await exists(
      path.join(dataDir, THREADS_DIRECTORY, "ws-1", "thread-2.json")
    ),
    true
  );
  assert.equal(JSON.parse(await fs.readFile(threadOne, "utf8")).generation, 9);
});

test("a completed migration with an unreadable marker fails closed and never falls back to the legacy file", async (t) => {
  const dataDir = await tempDataDir(t);
  await writeLegacy(dataDir, TWO_THREADS);
  await fs.writeFile(path.join(dataDir, MIGRATION_MARKER_NAME), "{ broken");

  const read = await createSessionRegistry(dataDir).read();

  assert.deepEqual(read, {
    status: "invalid",
    reason: "migration_marker_invalid"
  });
});

test("without a marker, an invalid legacy registry still fails closed as in F2", async (t) => {
  const dataDir = await tempDataDir(t);
  await fs.writeFile(path.join(dataDir, REGISTRY_FILE_NAME), "{ not json");
  await fs.writeFile(
    path.join(dataDir, REGISTRY_META_FILE_NAME),
    serializeRegistryMeta(CLOCK_ISO)
  );

  const read = await createSessionRegistry(dataDir).read();

  assert.equal(read.status, "invalid");
});

test("a failed completion marker write reruns in a new instance, keeps the thread state and ignores a reappearing original", async (t) => {
  const dataDir = await tempDataDir(t);
  await writeLegacy(dataDir, TWO_THREADS);

  await assert.rejects(
    migrateLegacySessions(
      dataDir,
      threadStoreOf(dataDir),
      clock,
      failingMarkerWrite
    ),
    { code: "ENOSPC" }
  );
  const written = await threadSnapshot(dataDir);

  assert.equal(written.thread1.generation, 1);
  assert.equal(written.thread2.generation, 2);
  assert.equal(await exists(path.join(dataDir, REGISTRY_FILE_NAME)), true);
  assert.equal(await exists(path.join(dataDir, MIGRATION_MARKER_NAME)), false);

  const resumed = await createSessionRegistry(dataDir).read();
  const afterResume = await threadSnapshot(dataDir);

  assert.equal(resumed.status, "ready");
  assert.equal(await exists(path.join(dataDir, MIGRATION_MARKER_NAME)), true);
  assert.equal(afterResume.thread1.generation, written.thread1.generation);
  assert.deepEqual(afterResume.thread1.slots, written.thread1.slots);
  assert.equal(afterResume.thread2.generation, written.thread2.generation);
  assert.deepEqual(afterResume.thread2.slots, written.thread2.slots);
  assert.deepEqual(afterResume, written);

  await fs.writeFile(path.join(dataDir, REGISTRY_FILE_NAME), "{ not json");
  const reappeared = await createSessionRegistry(dataDir).read();

  assert.equal(reappeared.status, "ready");
  assert.deepEqual(await threadSnapshot(dataDir), written);
});

test("a crash after the completion marker archives the legacy file without reading it", async (t) => {
  const dataDir = await tempDataDir(t);
  await writeLegacy(dataDir, TWO_THREADS);
  await fs.writeFile(
    path.join(dataDir, MIGRATION_MARKER_NAME),
    `${JSON.stringify({ version: 1, completedAt: CLOCK_ISO }, null, 2)}\n`
  );

  const read = await createSessionRegistry(dataDir).read();

  assert.equal(read.status, "ready");
  assert.equal(await exists(threadFile(dataDir, "thread-1")), false);
  assert.equal(await exists(path.join(dataDir, REGISTRY_FILE_NAME)), false);
  assert.equal(
    await exists(path.join(dataDir, REGISTRY_META_FILE_NAME)),
    false
  );
  assert.equal(await exists(path.join(dataDir, MIGRATION_MARKER_NAME)), true);
  assert.equal(await archivedCount(dataDir, REGISTRY_FILE_NAME), 1);
  assert.equal(await archivedCount(dataDir, REGISTRY_META_FILE_NAME), 1);
});

test("a failed archive rename after the marker never blocks the daemon, and the legacy file is not read again", async (t) => {
  const dataDir = await tempDataDir(t);
  await writeLegacy(dataDir, TWO_THREADS);
  await fs.mkdir(
    path.join(dataDir, `${REGISTRY_FILE_NAME}.migrated-${stampFor(CLOCK_ISO)}`)
  );

  const first = await createSessionRegistry(dataDir, { now: clock }).read();
  const afterFirst = await threadSnapshot(dataDir);

  assert.equal(first.status, "ready");
  assert.equal(await exists(path.join(dataDir, MIGRATION_MARKER_NAME)), true);
  assert.equal(await exists(path.join(dataDir, REGISTRY_FILE_NAME)), true);

  await fs.writeFile(
    path.join(dataDir, REGISTRY_FILE_NAME),
    serializeRegistry(
      registryOf([legacyBinding("ws-1", "thread-3", "claude-dev", 3)])
    )
  );
  const second = await createSessionRegistry(dataDir, { now: clock }).read();

  assert.equal(second.status, "ready");
  assert.equal(await exists(threadFile(dataDir, "thread-3")), false);
  assert.deepEqual(await threadSnapshot(dataDir), afterFirst);
});

type StoredThread = { generation: number; slots: unknown; createdAt: string };

/** Simulates a disk that runs out of space on the completion marker, after the per-thread files are written. */
async function failingMarkerWrite(): Promise<void> {
  throw Object.assign(new Error("ENOSPC: no space left on device"), {
    code: "ENOSPC"
  });
}

function threadStoreOf(dataDir: string) {
  return createThreadStore(dataDir, {
    writeAtomic: writeFileAtomically,
    now: clock
  });
}

function threadFile(dataDir: string, threadId: string): string {
  return path.join(dataDir, THREADS_DIRECTORY, "ws-1", `${threadId}.json`);
}

async function threadSnapshot(
  dataDir: string
): Promise<{ thread1: StoredThread; thread2: StoredThread }> {
  return {
    thread1: await readThread(threadFile(dataDir, "thread-1")),
    thread2: await readThread(threadFile(dataDir, "thread-2"))
  };
}

async function readThread(filePath: string): Promise<StoredThread> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as StoredThread;
}

async function archivedCount(
  dataDir: string,
  fileName: string
): Promise<number> {
  const names = await fs.readdir(dataDir);
  const archived = names.filter((name) =>
    name.startsWith(`${fileName}.migrated-`)
  );
  return archived.length;
}

async function exists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(
    () => true,
    () => false
  );
}
