import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { SessionBinding } from "../src/core/session-slots.js";
import {
  isRegistryFile,
  readRegistryView
} from "../src/daemon/session-file.js";

const SESSION = "11111111-1111-4111-8111-111111111111";

function binding(overrides: Partial<SessionBinding> = {}): SessionBinding {
  return {
    workspaceId: "ws-1",
    threadId: "thread-1",
    profile: "claude-dev",
    client: "claude-code",
    nativeSessionId: SESSION,
    hostId: "host-a",
    origin: "open",
    generation: 1,
    owner: { clientPid: 100, clientStartedAt: 1, ownerToken: "token" },
    boundAt: "2026-11-03T12:00:00.000Z",
    conflicts: [],
    ...overrides
  };
}

const KEY = "ws-1:thread-1:claude-dev";

const SHAPES: Array<[string, unknown, boolean]> = [
  [
    "accepts a valid empty file",
    { version: 1, generation: 0, slots: {} },
    true
  ],
  [
    "accepts a binding with the re-link fields kept for diagnosis",
    {
      version: 1,
      generation: 2,
      slots: {
        [KEY]: binding({
          previousSessionId: SESSION,
          sessionChangedAt: "2026-11-03T12:00:00.000Z"
        })
      }
    },
    true
  ],
  [
    "rejects an unsupported version",
    { version: 2, generation: 0, slots: {} },
    false
  ],
  [
    "rejects a negative generation",
    { version: 1, generation: -1, slots: {} },
    false
  ],
  [
    "rejects a slot whose key does not match the binding",
    { version: 1, generation: 1, slots: { wrong: binding() } },
    false
  ],
  [
    "rejects a binding without a session",
    {
      version: 1,
      generation: 1,
      slots: { [KEY]: binding({ nativeSessionId: "" }) }
    },
    false
  ]
];

for (const [name, value, expected] of SHAPES) {
  test(`registry file guard: ${name}`, () => {
    assert.equal(isRegistryFile(value), expected);
  });
}

async function fileWith(content: string | undefined): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marc-session-file-"));
  const filePath = path.join(dir, "sessions.json");
  await fs.writeFile(filePath, content ?? "", "utf8").catch(() => undefined);
  return filePath;
}

test("a missing file reads as an empty ready registry", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marc-session-missing-"));
  assert.deepEqual(await readRegistryView(path.join(dir, "sessions.json")), {
    status: "ready",
    file: { version: 1, generation: 0, slots: {} }
  });
});

test("an unparseable file is reported as invalid and left untouched", async () => {
  const filePath = await fileWith("{ broken");
  assert.deepEqual(await readRegistryView(filePath), {
    status: "invalid",
    reason: "unreadable_json"
  });
  assert.equal(await fs.readFile(filePath, "utf8"), "{ broken");
});

async function markedDir(): Promise<{ dir: string; filePath: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marc-session-meta-"));
  await fs.writeFile(path.join(dir, "sessions.meta.json"), "{}\n", "utf8");
  return { dir, filePath: path.join(dir, "sessions.json") };
}

test("a missing sessions.json next to its meta marker reads as lost and creates nothing", async () => {
  const { filePath } = await markedDir();
  assert.deepEqual(await readRegistryView(filePath), {
    status: "invalid",
    reason: "registry_lost"
  });
  await assert.rejects(fs.access(filePath));
});

test("a sessions.json next to its meta marker is parsed as before", async () => {
  const { filePath } = await markedDir();
  await fs.writeFile(
    filePath,
    JSON.stringify({ version: 1, generation: 4, slots: {} }),
    "utf8"
  );
  assert.deepEqual(await readRegistryView(filePath), {
    status: "ready",
    file: { version: 1, generation: 4, slots: {} }
  });
});

test("removing the meta marker as well turns a lost registry into a fresh one", async () => {
  const { dir, filePath } = await markedDir();
  assert.equal((await readRegistryView(filePath)).status, "invalid");
  await fs.rm(path.join(dir, "sessions.meta.json"));
  assert.deepEqual(await readRegistryView(filePath), {
    status: "ready",
    file: { version: 1, generation: 0, slots: {} }
  });
});
