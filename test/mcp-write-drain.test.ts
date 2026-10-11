import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createThread, getWorkspaceInfo } from "../src/core/workspace.js";
import {
  threadWriteResource,
  withWorkspaceWriteLock,
  workspaceWriteLockPath
} from "../src/core/write-coordination.js";
import { McpTestProcess } from "./mcp-process.js";

const protocolMetadata = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {}
};

test("EOF drains a cancelled started write without corrupting Markdown or leaving its lock", async (t) => {
  const workspace = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-mcp-eof-write-")
  );
  const thread = await createThread(workspace, "EOF write drain");
  const workspaceInfo = await getWorkspaceInfo(workspace);
  const resource = threadWriteResource(thread.id);
  const lockPath = workspaceWriteLockPath(workspaceInfo.marcPath, resource);
  let releaseLock: () => void = () => undefined;
  let resolveLockAcquired: () => void = () => undefined;
  const lockAcquired = new Promise<void>((resolve) => {
    resolveLockAcquired = resolve;
  });
  const lockRelease = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const heldLock = withWorkspaceWriteLock(
    workspaceInfo.marcPath,
    resource,
    async () => {
      resolveLockAcquired();
      await lockRelease;
    }
  );
  const serverRef: { current?: McpTestProcess } = {};
  t.after(async () => {
    releaseLock();
    await heldLock.catch(() => undefined);
    try {
      const process = serverRef.current;
      if (!process) return;
      const exit = await process.closeProcess();
      assert.equal(exit.code, 0, process.stderr);
      await process.waitForExit();
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  await lockAcquired;
  const runningServer = new McpTestProcess("source", workspace);
  serverRef.current = runningServer;
  await runningServer.send({
    jsonrpc: "2.0",
    id: 1,
    method: "server/discover",
    params: { _meta: protocolMetadata }
  });
  const discovery = await runningServer.readMessage();
  assert.ok("result" in discovery);
  await runningServer.send({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "message_post",
      arguments: {
        threadId: thread.id,
        agentId: "codex-dev",
        body: "EOF_PENDING_WRITE_VERIFIED confirms this write finished before shutdown.",
        bootstrapConfirmed: true
      },
      _meta: protocolMetadata
    }
  });
  await runningServer.send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/list",
    params: { _meta: protocolMetadata }
  });
  const listing = await runningServer.readMessage();
  assert.ok("result" in listing);
  assert.equal(listing.id, 3);
  await runningServer.send({
    jsonrpc: "2.0",
    method: "notifications/cancelled",
    params: { requestId: 2, reason: "Test cancels the blocked write." }
  });

  const shutdown = runningServer.closeProcess();
  const exitedBeforeUnlock = await runningServer
    .waitForExit(150)
    .then(() => true)
    .catch(() => false);
  assert.equal(exitedBeforeUnlock, false);
  releaseLock();
  await heldLock;
  const exit = await shutdown;
  assert.equal(exit.code, 0, runningServer.stderr);

  const chat = await fs.readFile(path.join(thread.path, "CHAT.md"), "utf8");
  assert.equal(chat.split("EOF_PENDING_WRITE_VERIFIED").length - 1, 1);
  await assert.rejects(fs.access(lockPath));
});
