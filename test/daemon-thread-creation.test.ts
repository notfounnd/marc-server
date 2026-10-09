import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadDaemonConfig } from "../src/daemon/config.js";
import { createDaemonServer } from "../src/daemon/server.js";
import { initWorkspace } from "../src/core/workspace.js";

async function tempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function listen(
  server: Awaited<ReturnType<typeof createDaemonServer>>
): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

async function createHarness(): Promise<{
  baseUrl: string;
  server: Awaited<ReturnType<typeof createDaemonServer>>;
  workspace: Awaited<ReturnType<typeof initWorkspace>>;
}> {
  const dataDir = await tempDir("marc-daemon-");
  const workspaceRoot = await tempDir("marc-workspace-");
  const workspace = await initWorkspace(workspaceRoot);
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0 });
  const server = await createDaemonServer(config);
  const baseUrl = await listen(server);
  const register = await fetch(`${baseUrl}/api/workspaces`, {
    body: JSON.stringify(workspace),
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json"
    },
    method: "POST"
  });
  assert.equal(register.status, 200);

  return { baseUrl, server, workspace };
}

function readSseChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for server event")),
      2000
    );
    reader
      .read()
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

test("daemon creates a canonical thread that appears in the workspace list", async () => {
  const { baseUrl, server, workspace } = await createHarness();
  const eventResponse = await fetch(`${baseUrl}/api/events`, {
    headers: { authorization: "Bearer secret" }
  });
  assert.equal(eventResponse.status, 200);
  assert(eventResponse.body);
  const reader = eventResponse.body.getReader();
  const decoder = new TextDecoder();

  try {
    const connected = await readSseChunk(reader);
    assert.equal(connected.done, false);
    assert.match(decoder.decode(connected.value), /: connected/);

    const response = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads`,
      {
        body: JSON.stringify({ title: "  Launch Notes  " }),
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json"
        },
        method: "POST"
      }
    );

    assert.equal(response.status, 201);
    const created = (await response.json()) as { id: string; title: string };
    assert.equal(created.title, "Launch Notes");

    const chatPath = path.join(
      workspace.marcPath,
      "threads",
      created.id,
      "CHAT.md"
    );
    const chat = await fs.readFile(chatPath, "utf8");
    assert.match(chat, /# Launch Notes/);
    assert.doesNotMatch(chat, /<!-- marc-message/);
    assert.equal(
      (
        await fs.stat(
          path.join(workspace.marcPath, "threads", created.id, "artifacts")
        )
      ).isDirectory(),
      true
    );

    let eventData = "";
    let eventBlock: string | undefined;
    while (!eventBlock) {
      const chunk = await readSseChunk(reader);
      assert.equal(chunk.done, false);
      eventData += decoder.decode(chunk.value, { stream: true });
      eventBlock = eventData
        .split("\n\n")
        .find((block) => eventHasThreadId(block, created.id));
    }
    const payloadLine = eventBlock
      .split("\n")
      .find((line) => line.startsWith("data: "));
    assert.ok(payloadLine);
    const payload = JSON.parse(payloadLine.slice("data: ".length)) as {
      workspaceId: string;
      threadId: string;
    };
    assert.equal(payload.workspaceId, workspace.id);
    assert.equal(payload.threadId, created.id);

    const list = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads`,
      { headers: { authorization: "Bearer secret" } }
    );
    assert.equal(list.status, 200);
    const threads = (await list.json()) as Array<{ id: string; title: string }>;
    assert.ok(
      threads.some(
        (thread) => thread.id === created.id && thread.title === "Launch Notes"
      )
    );

    const threadUrl = `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads/${encodeURIComponent(created.id)}`;
    const readHeaders = { headers: { authorization: "Bearer secret" } };
    const rulesBeforeResponse = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/rules`,
      readHeaders
    );
    assert.equal(rulesBeforeResponse.status, 200);
    const rulesBefore = (await rulesBeforeResponse.json()) as {
      markdown: string;
    };
    const agentsBeforeResponse = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/agents`,
      readHeaders
    );
    assert.equal(agentsBeforeResponse.status, 200);
    assert.deepEqual(await agentsBeforeResponse.json(), []);

    const emptyThreadResponse = await fetch(threadUrl, readHeaders);
    assert.equal(emptyThreadResponse.status, 200);
    const emptyThread = (await emptyThreadResponse.json()) as {
      markdown: string;
      messageCount: number;
      messages: unknown[];
    };
    assert.equal(emptyThread.messageCount, 0);
    assert.deepEqual(emptyThread.messages, []);

    const firstPostResponse = await fetch(threadUrl, {
      body: JSON.stringify({ agentId: "ui-user", message: "First message" }),
      headers: {
        authorization: "Bearer secret",
        "content-type": "application/json"
      },
      method: "POST"
    });
    assert.equal(firstPostResponse.status, 200);
    const firstPost = (await firstPostResponse.json()) as {
      id: string;
      body: string;
    };
    assert.equal(firstPost.body, "First message");

    const loadedThreadResponse = await fetch(threadUrl, readHeaders);
    assert.equal(loadedThreadResponse.status, 200);
    const loadedThread = (await loadedThreadResponse.json()) as {
      messageCount: number;
      messages: Array<{ id: string; body: string }>;
    };
    assert.equal(loadedThread.messageCount, 1);
    assert.equal(loadedThread.messages[0]?.id, firstPost.id);
    assert.equal(loadedThread.messages[0]?.body, "First message");

    const rulesAfterResponse = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/rules`,
      readHeaders
    );
    const rulesAfter = (await rulesAfterResponse.json()) as {
      markdown: string;
    };
    assert.equal(rulesAfterResponse.status, 200);
    assert.equal(rulesAfter.markdown, rulesBefore.markdown);
  } finally {
    await reader.cancel();
    server.close();
  }
});

function eventHasThreadId(block: string, threadId: string): boolean {
  if (!block.startsWith("event: workspace-changed\n")) return false;
  const payloadLine = block
    .split("\n")
    .find((line) => line.startsWith("data: "));
  if (!payloadLine) return false;
  const payload = JSON.parse(payloadLine.slice("data: ".length)) as {
    threadId?: string;
  };
  return payload.threadId === threadId;
}

test("daemon rejects invalid thread creation payloads without writing a thread", async () => {
  const { baseUrl, server, workspace } = await createHarness();

  try {
    const invalidPayloads = [
      "{",
      "null",
      "[]",
      "{}",
      JSON.stringify({ title: null }),
      JSON.stringify({ title: 42 }),
      JSON.stringify({ title: "" }),
      JSON.stringify({ title: "   " }),
      JSON.stringify({ title: "line\nbreak" }),
      JSON.stringify({ title: "carriage\rreturn" }),
      JSON.stringify({ title: "\nLaunch Notes\r" })
    ];

    for (const body of invalidPayloads) {
      const response = await fetch(
        `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads`,
        {
          body,
          headers: {
            authorization: "Bearer secret",
            "content-type": "application/json"
          },
          method: "POST"
        }
      );
      assert.equal(response.status, 400, `Rejected payload ${body}`);
    }

    const threadEntries = await fs.readdir(
      path.join(workspace.marcPath, "threads")
    );
    assert.deepEqual(threadEntries, []);
  } finally {
    server.close();
  }
});

test("daemon authenticates creation and reports an unknown workspace", async () => {
  const { baseUrl, server, workspace } = await createHarness();

  try {
    const unauthorized = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads`,
      {
        body: JSON.stringify({ title: "Unauthenticated" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }
    );
    assert.equal(unauthorized.status, 401);

    const missing = await fetch(`${baseUrl}/api/workspaces/missing/threads`, {
      body: JSON.stringify({ title: "Unknown" }),
      headers: {
        authorization: "Bearer secret",
        "content-type": "application/json"
      },
      method: "POST"
    });
    assert.equal(missing.status, 404);
    assert.equal(await missing.text(), "Workspace not found");
  } finally {
    server.close();
  }
});

test("daemon preserves a created thread when index rebuilding fails", async () => {
  const { baseUrl, server, workspace } = await createHarness();
  const indexPath = path.join(workspace.marcPath, "cache", "thread-index.json");
  await fs.rm(indexPath, { force: true });
  await fs.mkdir(indexPath);

  try {
    const response = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads`,
      {
        body: JSON.stringify({ title: "Index Failure" }),
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json"
        },
        method: "POST"
      }
    );
    assert.equal(response.status, 201);
    const created = (await response.json()) as { id: string; title: string };
    assert.equal(created.title, "Index Failure");
    assert.match(
      await fs.readFile(
        path.join(workspace.marcPath, "threads", created.id, "CHAT.md"),
        "utf8"
      ),
      /# Index Failure/
    );
  } finally {
    server.close();
  }
});
