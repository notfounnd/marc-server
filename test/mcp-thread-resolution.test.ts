import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { resolveThreadId } from "../src/mcp/thread-resolution.js";
import {
  ambiguousThreadSuffix,
  filesystemFailureCases,
  fixtureBaseEntries,
  fixtureFileSystem,
  fixtureWorkspace,
  invalidThreadId,
  linkedChatEntries,
  linkedThreadDirectoryEntries,
  regularThreadFixtureEntries,
  threadNotFound
} from "./thread-resolution-fixtures.js";
import { startMcpTestClient, toolJson } from "./mcp-process.js";

async function createWorkspace(t: TestContext): Promise<string> {
  const workspace = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-thread-resolution-")
  );
  await fs.mkdir(path.join(workspace, ".marc", "threads"), { recursive: true });
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  return workspace;
}

async function createThread(
  workspace: string,
  threadId: string
): Promise<void> {
  const threadPath = path.join(workspace, ".marc", "threads", threadId);
  await fs.mkdir(threadPath, { recursive: true });
  await fs.writeFile(path.join(threadPath, "CHAT.md"), "");
}

const assertThreadNotFound = async (
  workspace: string,
  requestedId: string,
  fileSystem?: Parameters<typeof resolveThreadId>[2]
): Promise<void> =>
  assert.deepEqual(
    await resolveThreadId(workspace, requestedId, fileSystem),
    threadNotFound
  );

test("an eligible thread resolves through the injected filesystem", async () => {
  const workspace = fixtureWorkspace;
  const threadId = "fixture-thread-1234abcd";
  const fileSystem = fixtureFileSystem(regularThreadFixtureEntries([threadId]));

  assert.deepEqual(await resolveThreadId(workspace, threadId, fileSystem), {
    ok: true,
    threadId
  });
});

test("full thread IDs take priority over a matching short suffix", async (t) => {
  const workspace = await createWorkspace(t);
  await createThread(workspace, "alpha-1234abcd");
  await createThread(workspace, "beta-1234abcd");

  assert.deepEqual(await resolveThreadId(workspace, "alpha-1234abcd"), {
    ok: true,
    threadId: "alpha-1234abcd"
  });
});

test("an exact full ID ignores failures in unrelated thread directories", async () => {
  const workspace = fixtureWorkspace;
  const fileSystem = fixtureFileSystem(
    regularThreadFixtureEntries(["exact-target-thread", "unrelated-thread"]),
    [
      {
        operation: "lstat",
        path: ".marc/threads/unrelated-thread",
        code: "EACCES"
      }
    ]
  );

  assert.deepEqual(
    await resolveThreadId(workspace, "exact-target-thread", fileSystem),
    {
      ok: true,
      threadId: "exact-target-thread"
    }
  );
});

test("suffix lookup ignores directories with a different suffix", async () => {
  const workspace = fixtureWorkspace;
  const fileSystem = fixtureFileSystem(
    regularThreadFixtureEntries([
      "wanted-thread-deadbeef",
      "unrelated-thread-1234abcd"
    ]),
    [
      {
        operation: "lstat",
        path: ".marc/threads/unrelated-thread-1234abcd",
        code: "EACCES"
      }
    ]
  );

  assert.deepEqual(await resolveThreadId(workspace, "deadbeef", fileSystem), {
    ok: true,
    threadId: "wanted-thread-deadbeef"
  });
});

test("short suffix lookup accepts uppercase hex and includes closed threads", async (t) => {
  const workspace = await createWorkspace(t);
  await createThread(workspace, "closed-thread-cafebeef");
  await fs.writeFile(
    path.join(
      workspace,
      ".marc",
      "threads",
      "closed-thread-cafebeef",
      "SUMMARY.md"
    ),
    "# Closed\n"
  );

  assert.deepEqual(await resolveThreadId(workspace, "CAFEBEEF"), {
    ok: true,
    threadId: "closed-thread-cafebeef"
  });
});

test("ambiguous suffix candidates are returned as sorted canonical IDs", async (t) => {
  const workspace = await createWorkspace(t);
  await createThread(workspace, "zeta-deadbeef");
  await createThread(workspace, "alpha-deadbeef");

  assert.deepEqual(
    await resolveThreadId(workspace, "DEADBEEF"),
    ambiguousThreadSuffix
  );
});

test("missing IDs and path-like IDs have distinct resolution errors", async (t) => {
  const workspace = await createWorkspace(t);
  await createThread(workspace, "alpha-1234abcd");

  for (const fragment of ["1234abc", "01234abcd", "12345678"]) {
    await assertThreadNotFound(workspace, fragment);
  }
  assert.deepEqual(
    await resolveThreadId(workspace, "../outside"),
    invalidThreadId
  );
  await assertThreadNotFound(workspace, "ALPHA-1234ABCD");
});

test("only directories with a regular CHAT.md file are eligible", async (t) => {
  const workspace = await createWorkspace(t);
  const threadsPath = path.join(workspace, ".marc", "threads");
  await fs.mkdir(path.join(threadsPath, "no-chat-deadbeef"));
  await fs.mkdir(path.join(threadsPath, "chat-directory-deadbeef", "CHAT.md"), {
    recursive: true
  });

  await assertThreadNotFound(workspace, "deadbeef");
});

test("symlink thread directories are ignored for full IDs and suffixes", async () => {
  const threadId = "linked-thread-deadbeef";
  const regularId = "canonical-thread-deadbeef";
  const linkedOnly = fixtureFileSystem([
    ...fixtureBaseEntries,
    ...linkedThreadDirectoryEntries(threadId)
  ]);
  const fileSystem = fixtureFileSystem([
    ...regularThreadFixtureEntries([regularId]),
    ...linkedThreadDirectoryEntries(threadId)
  ]);

  await assertThreadNotFound(fixtureWorkspace, threadId, linkedOnly);
  await assertThreadNotFound(fixtureWorkspace, "deadbeef", linkedOnly);
  await assertThreadNotFound(fixtureWorkspace, threadId, fileSystem);
  assert.deepEqual(
    await resolveThreadId(fixtureWorkspace, "deadbeef", fileSystem),
    {
      ok: true,
      threadId: regularId
    }
  );
});

test("symlink CHAT.md files are ignored for full IDs and suffixes", async () => {
  const threadId = "linked-chat-deadbeef";
  const regularId = "canonical-chat-deadbeef";
  const linkedOnly = fixtureFileSystem([
    ...fixtureBaseEntries,
    ...linkedChatEntries(threadId)
  ]);
  const fileSystem = fixtureFileSystem([
    ...regularThreadFixtureEntries([regularId]),
    ...linkedChatEntries(threadId)
  ]);

  await assertThreadNotFound(fixtureWorkspace, threadId, linkedOnly);
  await assertThreadNotFound(fixtureWorkspace, "deadbeef", linkedOnly);
  await assertThreadNotFound(fixtureWorkspace, threadId, fileSystem);
  assert.deepEqual(
    await resolveThreadId(fixtureWorkspace, "deadbeef", fileSystem),
    {
      ok: true,
      threadId: regularId
    }
  );
});

test("matching EACCES errors reject thread resolution", async () => {
  const threadId = "denied-thread-deadbeef";
  const fileSystem = fixtureFileSystem(
    regularThreadFixtureEntries([threadId]),
    [{ operation: "lstat", path: `.marc/threads/${threadId}`, code: "EACCES" }]
  );

  await Promise.all(
    [threadId, "deadbeef"].map((id) =>
      assert.rejects(resolveThreadId(fixtureWorkspace, id, fileSystem), {
        code: "EACCES"
      })
    )
  );
});

for (const code of ["ENOENT", "ENOTDIR"]) {
  test(`${code} is treated as a missing path`, async () => {
    const fileSystem = fixtureFileSystem(
      [{ path: ".marc", type: "directory" }],
      [{ operation: "lstat", path: ".marc/threads", code }]
    );

    await assertThreadNotFound(
      fixtureWorkspace,
      "missing-thread-deadbeef",
      fileSystem
    );
  });
}

for (const failure of filesystemFailureCases) {
  test(`${failure.name} rejects thread resolution`, async () => {
    const fileSystem = fixtureFileSystem(fixtureBaseEntries, [failure]);
    await assert.rejects(
      resolveThreadId(
        fixtureWorkspace,
        "unavailable-thread-deadbeef",
        fileSystem
      ),
      { code: failure.code }
    );
  });
}

test("MCP readers report missing, ambiguous, and invalid thread IDs", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());

  await session.client.callTool({ name: "workspace_bootstrap", arguments: {} });

  const threadRoot = path.join(session.workspace, ".marc", "threads");
  for (const threadId of ["zeta-abcdef12", "alpha-abcdef12"]) {
    const threadPath = path.join(threadRoot, threadId);
    await fs.mkdir(threadPath, { recursive: true });
    await fs.writeFile(path.join(threadPath, "CHAT.md"), "");
  }

  const callError = async (
    name: string,
    threadId: string,
    bootstrapConfirmed = true,
    extraArguments: Record<string, unknown> = {}
  ) => {
    const response = await session.client.callTool({
      name,
      arguments: { ...extraArguments, threadId, bootstrapConfirmed }
    });
    assert.equal(response.isError, true, `${name} should return a tool error`);
    return toolJson<{
      error: { code: string; details?: { candidates?: string[] } };
    }>(response).error;
  };

  const readerArguments: Record<string, Record<string, unknown>> = {
    thread_read: {},
    thread_read_since: { afterMessageId: "missing-cursor" },
    thread_info: {},
    thread_tail: { limit: 1 }
  };
  for (const [name, extraArguments] of Object.entries(readerArguments)) {
    const missing = await callError(name, "87654321", true, extraArguments);
    assert.equal(missing.code, "thread_not_found", name);

    const ambiguous = await callError(name, "ABCDEF12", true, extraArguments);
    assert.equal(ambiguous.code, "ambiguous_thread_id", name);
    assert.deepEqual(
      ambiguous.details?.candidates,
      ["alpha-abcdef12", "zeta-abcdef12"],
      name
    );
  }

  for (const invalidId of ["../outside", "one/two", "one\\two", "..", "."]) {
    const invalid = await callError("thread_info", invalidId);
    assert.equal(invalid.code, "invalid_thread_id", invalidId);
  }

  const unbootstrapped = await callError("thread_read", "../outside", false);
  assert.equal(unbootstrapped.code, "bootstrap_required");
});
