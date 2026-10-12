import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { startMcpTestClient, toolJson } from "./mcp-process.js";

type SummaryResult = {
  threadId: string;
  reference: string;
  summaryPath: string;
  status: "closed";
  closedAt: string;
  summaryRevision: string;
  outcome: "created" | "updated" | "unchanged";
  projections: {
    threadIndex: "updated" | "pending";
    memory: "current" | "scheduled" | "pending";
    errors: string[];
  };
};

test("MCP summary tool creates, reads and revision-checks canonical Markdown", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  const listed = await session.client.listTools();
  assert.ok(listed.tools.some((tool) => tool.name === "thread_write_summary"));

  const missingBootstrap = await session.client.callTool({
    name: "thread_write_summary",
    arguments: { threadId: "summary-test-12345678", body: "Missing bootstrap." }
  });
  assert.equal(missingBootstrap.isError, true);
  assert.equal(
    toolJson<{ error: { code: string } }>(missingBootstrap).error.code,
    "bootstrap_required"
  );

  const bootstrap = await session.client.callTool({
    name: "workspace_bootstrap",
    arguments: {}
  });
  assert.equal(bootstrap.isError, undefined);

  const threadResponse = await session.client.callTool({
    name: "thread_create",
    arguments: { title: "MCP summary lifecycle", bootstrapConfirmed: true }
  });
  const thread = toolJson<{ result: { id: string; path: string } }>(
    threadResponse
  ).result;
  const artifactResponse = await session.client.callTool({
    name: "message_attach_artifact",
    arguments: {
      threadId: thread.id,
      fileName: "preserve.md",
      content: "Artifact remains intact.",
      bootstrapConfirmed: true
    }
  });
  assert.equal(artifactResponse.isError, undefined);
  const chatPath = path.join(thread.path, "CHAT.md");
  const chatBefore = await fs.readFile(chatPath, "utf8");
  const artifactPath = path.join(thread.path, "artifacts", "preserve.md");

  const body = [
    "This thread records a completed summary lifecycle test.",
    "",
    "```text",
    "Thread: this line stays in the caller-authored body",
    "Closed: this line is not close metadata",
    "```",
    "",
    "## Result",
    "",
    "| Check | Result |",
    "| --- | --- |",
    "| Markdown | Preserved |"
  ].join("\n");
  const createdResponse = await session.client.callTool({
    name: "thread_write_summary",
    arguments: {
      threadId: thread.id,
      body,
      bootstrapConfirmed: true
    }
  });
  assert.equal(createdResponse.isError, undefined);
  const created = toolJson<{ result: SummaryResult }>(createdResponse).result;
  assert.equal(created.outcome, "created");
  assert.equal(created.reference, `marc://$${thread.id}`);
  assert.equal(created.status, "closed");

  const infoResponse = await session.client.callTool({
    name: "thread_info",
    arguments: { threadId: thread.id, bootstrapConfirmed: true }
  });
  const info = toolJson<{
    result: { status: string; closedAt?: string; summaryRevision?: string };
  }>(infoResponse).result;
  assert.equal(info.status, "closed");
  assert.equal(info.closedAt, created.closedAt);
  assert.equal(info.summaryRevision, created.summaryRevision);

  const withoutSummaryResponse = await session.client.callTool({
    name: "thread_read",
    arguments: {
      threadId: thread.id,
      includeSummary: false,
      bootstrapConfirmed: true
    }
  });
  const withoutSummary = toolJson<{
    result: { summary?: string; summaryRevision?: string };
  }>(withoutSummaryResponse).result;
  assert.equal(Object.hasOwn(withoutSummary, "summary"), false);
  assert.equal(Object.hasOwn(withoutSummary, "summaryRevision"), false);

  const withSummaryResponse = await session.client.callTool({
    name: "thread_read",
    arguments: { threadId: thread.id, bootstrapConfirmed: true }
  });
  const withSummary = toolJson<{
    result: { summary: string; summaryRevision: string };
  }>(withSummaryResponse).result;
  assert.equal(withSummary.summaryRevision, created.summaryRevision);
  assert.match(
    withSummary.summary,
    /Thread: this line stays in the caller-authored body/
  );
  assert.match(withSummary.summary, /\| Markdown \| Preserved \|/);

  const updatedBody = "Updated synthesis.\n\n## Result\n\nComplete.";
  const updateResponse = await session.client.callTool({
    name: "thread_write_summary",
    arguments: {
      threadId: thread.id,
      mode: "update",
      expectedSummaryRevision: created.summaryRevision,
      body: updatedBody,
      bootstrapConfirmed: true
    }
  });
  assert.equal(updateResponse.isError, undefined);
  const updated = toolJson<{ result: SummaryResult }>(updateResponse).result;
  assert.equal(updated.outcome, "updated");
  assert.equal(updated.closedAt, created.closedAt);

  const retryResponse = await session.client.callTool({
    name: "thread_write_summary",
    arguments: {
      threadId: thread.id,
      mode: "update",
      expectedSummaryRevision: created.summaryRevision,
      body: updatedBody,
      bootstrapConfirmed: true
    }
  });
  const retry = toolJson<{ result: SummaryResult }>(retryResponse).result;
  assert.equal(retry.outcome, "unchanged");
  assert.equal(retry.summaryRevision, updated.summaryRevision);

  const conflictResponse = await session.client.callTool({
    name: "thread_write_summary",
    arguments: {
      threadId: thread.id,
      mode: "update",
      expectedSummaryRevision: created.summaryRevision,
      body: "A conflicting body.",
      bootstrapConfirmed: true
    }
  });
  assert.equal(conflictResponse.isError, true);
  const conflict = toolJson<{ error: { code: string; message: string } }>(
    conflictResponse
  ).error;
  assert.equal(conflict.code, "revision_conflict");
  assert.doesNotMatch(conflict.message, /stack|C:\\|src\\/i);
  assert.equal(await fs.readFile(chatPath, "utf8"), chatBefore);
  assert.equal(
    await fs.readFile(artifactPath, "utf8"),
    "Artifact remains intact."
  );
});
