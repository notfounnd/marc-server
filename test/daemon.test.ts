import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadDaemonConfig } from "../src/daemon/config.js";
import { createDaemonServer } from "../src/daemon/server.js";
import { appendMessage, createThread, initWorkspace, readThread } from "../src/core/workspace.js";

async function tempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function listen(server: Awaited<ReturnType<typeof createDaemonServer>>): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

test("daemon requires token and serves registered workspace threads", async () => {
  const dataDir = await tempDir("marc-daemon-");
  const workspaceRoot = await tempDir("marc-workspace-");
  const workspace = await initWorkspace(workspaceRoot);
  const thread = await createThread(workspaceRoot, "Daemon visible");
  const olderClosedThread = await createThread(workspaceRoot, "Daemon older closed");
  const newerClosedThread = await createThread(workspaceRoot, "Daemon newer closed");
  await fs.writeFile(
    path.join(workspaceRoot, ".marc", "threads", olderClosedThread.id, "SUMMARY.md"),
    "# Executive Summary\n\nClosed: `2026-05-01T13:00:00.000Z`\n",
  );
  await fs.writeFile(
    path.join(workspaceRoot, ".marc", "threads", newerClosedThread.id, "SUMMARY.md"),
    "# Executive Summary\n\nClosed: `2026-05-02T13:00:00.000Z`\n",
  );
  const config = await loadDaemonConfig({ dataDir, token: "secret", port: 0 });
  const server = await createDaemonServer(config);
  const baseUrl = await listen(server);

  try {
    const unauthorized = await fetch(`${baseUrl}/api/workspaces`);
    assert.equal(unauthorized.status, 401);

    const register = await fetch(`${baseUrl}/api/workspaces`, {
      method: "POST",
      headers: {
        authorization: "Bearer secret",
        "content-type": "application/json",
      },
      body: JSON.stringify(workspace),
    });
    assert.equal(register.status, 200);

    const threads = await fetch(`${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads`, {
      headers: { authorization: "Bearer secret" },
    });
    assert.equal(threads.status, 200);
    const body = (await threads.json()) as Array<{ id: string }>;
    assert.equal(body[0].id, thread.id);

    const closedThreads = await fetch(`${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads?status=closed`, {
      headers: { authorization: "Bearer secret" },
    });
    assert.equal(closedThreads.status, 200);
    const closedBody = (await closedThreads.json()) as Array<{ id: string; status: string; closedAt: string }>;
    assert.deepEqual(closedBody.map((item) => item.id), [newerClosedThread.id, olderClosedThread.id]);
    assert.equal(closedBody[0].status, "closed");
    assert.equal(closedBody[0].closedAt, "2026-05-02T13:00:00.000Z");

    const uiMessage = await appendMessage(workspaceRoot, thread.id, {
      agentId: "ui-user",
      role: "user",
      body: "Needs a detailed artifact.",
    });
    const artifactResponse = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads/${encodeURIComponent(thread.id)}/messages/${encodeURIComponent(uiMessage.id)}/artifacts`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ fileName: "Long Notes", content: "# Long Notes" }),
      },
    );
    assert.equal(artifactResponse.status, 200);
    assert.deepEqual(await artifactResponse.json(), { artifact: "artifacts/long-notes.md" });
    assert.equal(
      (await readThread(workspaceRoot, thread.id)).messages?.find((message) => message.id === uiMessage.id)?.artifacts[0],
      "artifacts/long-notes.md",
    );

    const readArtifactResponse = await fetch(
      `${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/threads/${encodeURIComponent(thread.id)}/messages/${encodeURIComponent(uiMessage.id)}/artifacts/${encodeURIComponent("long-notes.md")}`,
      {
        headers: { authorization: "Bearer secret" },
      },
    );
    assert.equal(readArtifactResponse.status, 200);
    assert.deepEqual(await readArtifactResponse.json(), {
      artifact: "artifacts/long-notes.md",
      content: "# Long Notes",
    });

    const unregister = await fetch(`${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}`, {
      method: "DELETE",
      headers: { authorization: "Bearer secret" },
    });
    assert.equal(unregister.status, 200);

    const afterUnregister = await fetch(`${baseUrl}/api/workspaces`, {
      headers: { authorization: "Bearer secret" },
    });
    assert.deepEqual(await afterUnregister.json(), []);
  } finally {
    server.close();
  }
});
