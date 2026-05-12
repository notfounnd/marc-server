import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertInside } from "../src/core/paths.js";
import {
  appendMessage,
  attachArtifact,
  attachArtifactToMessage,
  createThread,
  initWorkspace,
  listAgentProfiles,
  listThreads,
  readRules,
  readMessageArtifact,
  readThread,
  readThreadInfo,
  readThreadSince,
  readThreadTail,
  registerAgent,
  updateWorkspaceRecommendations,
} from "../src/core/workspace.js";

async function tempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "marc-core-"));
}

async function readInstructions(workspace: string): Promise<string> {
  return fs.readFile(path.join(workspace, ".marc", "INSTRUCTIONS.md"), "utf8");
}

function assertSectionOrder(markdown: string, headings: string[]): void {
  const positions = headings.map((heading) => markdown.indexOf(heading));

  for (let index = 0; index < headings.length; index += 1) {
    assert.notEqual(positions[index], -1, `${headings[index]} should exist`);
    if (index > 0) {
      assert.ok(positions[index - 1] < positions[index], `${headings[index - 1]} should appear before ${headings[index]}`);
    }
  }
}

test("initializes the canonical .marc layout", async () => {
  const workspace = await tempWorkspace();
  const info = await initWorkspace(workspace);

  assert.equal(info.rootPath, workspace);
  assert.equal(path.basename(info.marcPath), ".marc");
  await fs.access(path.join(workspace, ".marc", "INSTRUCTIONS.md"));
  await fs.access(path.join(workspace, ".marc", "RULES.md"));
  await fs.access(path.join(workspace, ".marc", "agents"));
  await fs.access(path.join(workspace, ".marc", "threads"));

  const rules = await readRules(workspace);
  assert.match(rules, /- Use `agent_list` to discover registered agents\./);
  assert.match(rules, /- Use `agent_read_profile` to inspect a specific agent profile\./);
  assert.doesNotMatch(rules, /Registered Agents \(Marckers\)/);
  assert.doesNotMatch(rules, /codex-dev/);
});

test("registers agents and appends thread messages", async () => {
  const workspace = await tempWorkspace();
  const agentId = await registerAgent(workspace, {
    id: "Codex Agent",
    displayName: "Codex Agent",
    role: "implementation",
    model: "gpt",
  });
  const thread = await createThread(workspace, "Build V1");
  const message = await appendMessage(workspace, thread.id, {
    agentId,
    role: "developer",
    body: "Implemented core behavior.",
  });

  const agents = await listAgentProfiles(workspace);
  const rules = await readRules(workspace);
  const threads = await listThreads(workspace);
  const transcript = await readThread(workspace, thread.id);

  assert.equal(agentId, "codex-agent");
  assert.doesNotMatch(rules, /codex-agent/);
  assert.match(agents[0].markdown, /ID: `codex-agent`/);
  assert.equal(agents.length, 1);
  assert.equal(threads.length, 1);
  assert.equal(transcript.messageCount, 1);
  assert.equal(transcript.lastMessageId, message.id);
  assert.equal(transcript.markdown, undefined);
  assert.equal(transcript.messages?.length, 1);
  assert.equal(transcript.messages?.[0].id, message.id);
  assert.equal(transcript.messages?.[0].body, "Implemented core behavior.");

  const fullTranscript = await readThread(workspace, thread.id, { includeMarkdown: true });
  assert.match(fullTranscript.markdown ?? "", /Implemented core behavior/);
});

test("reads threads incrementally by message cursor", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Incremental context");
  const first = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: "First message.",
  });
  const second = await appendMessage(workspace, thread.id, {
    agentId: "copilot-dev",
    body: "Second message.",
  });
  const third = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: "Third message.",
  });

  const incremental = await readThreadSince(workspace, thread.id, first.id);

  assert.equal(incremental.ok, true);
  assert.equal(incremental.messageCount, 3);
  assert.equal(incremental.lastMessageId, third.id);
  assert.deepEqual(incremental.messages.map((item) => item.id), [second.id, third.id]);
});

test("reports cursor failure without silently returning the full thread", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Missing cursor");
  const message = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: "Existing message.",
  });

  const incremental = await readThreadSince(workspace, thread.id, "msg_missing");

  assert.equal(incremental.ok, false);
  assert.equal(incremental.error, "cursor_not_found");
  assert.equal(incremental.shouldReadFullThread, true);
  assert.equal(incremental.lastMessageId, message.id);
  assert.equal(incremental.messages.length, 0);
});

test("reads cheap thread info and tail messages", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Thread metadata");
  const first = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: "First message.",
  });
  const second = await appendMessage(workspace, thread.id, {
    agentId: "copilot-dev",
    body: "Second message.",
  });
  const third = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: "Third message.",
  });

  const info = await readThreadInfo(workspace, thread.id);
  const tail = await readThreadTail(workspace, thread.id, { limit: 2 });

  assert.equal(info.id, thread.id);
  assert.equal(info.messageCount, 3);
  assert.equal(info.lastMessageId, third.id);
  assert.equal(info.updatedAt, third.timestamp);
  assert.equal(info.summaryAvailable, false);
  assert.deepEqual(tail.messages.map((item) => item.id), [second.id, third.id]);
  assert.equal(tail.messageCount, 3);
  assert.equal(tail.lastMessageId, third.id);
  assert.notEqual(first.id, second.id);
});

test("writes artifacts inside the thread folder only", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Review");
  const artifact = await attachArtifact(workspace, thread.id, "notes.md", "# Notes");

  assert.equal(artifact, "artifacts/notes.md");
  assert.equal(
    await fs.readFile(path.join(workspace, ".marc", "threads", thread.id, "artifacts", "notes.md"), "utf8"),
    "# Notes",
  );
});

test("attaches markdown artifacts to an existing thread message", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Message artifact");
  const message = await appendMessage(workspace, thread.id, {
    agentId: "ui-user",
    role: "user",
    body: "Initial UI note.",
  });

  const relative = await attachArtifactToMessage(workspace, thread.id, message.id, "Detailed Decision", "# Detailed Decision");
  const transcript = await readThread(workspace, thread.id, { includeMarkdown: true });

  assert.equal(relative, "artifacts/detailed-decision.md");
  assert.equal(transcript.messages?.[0].artifacts[0], "artifacts/detailed-decision.md");
  assert.match(transcript.markdown ?? "", /artifacts: artifacts\/detailed-decision\.md/);
  assert.equal(
    await fs.readFile(path.join(workspace, ".marc", "threads", thread.id, "artifacts", "detailed-decision.md"), "utf8"),
    "# Detailed Decision",
  );
  const arbitraryRelative = await attachArtifactToMessage(
    workspace,
    thread.id,
    message.id,
    "notes.qualquercoisa",
    "Arbitrary suffix saved as markdown",
  );
  const multiDotRelative = await attachArtifactToMessage(
    workspace,
    thread.id,
    message.id,
    "diagram.export.jpg",
    "Multi-dot suffix saved as markdown",
  );
  const updatedTranscript = await readThread(workspace, thread.id);

  assert.equal(arbitraryRelative, "artifacts/notes.qualquercoisa.md");
  assert.equal(multiDotRelative, "artifacts/diagram.export.jpg.md");
  assert.deepEqual(updatedTranscript.messages?.[0].artifacts, [
    "artifacts/detailed-decision.md",
    "artifacts/notes.qualquercoisa.md",
    "artifacts/diagram.export.jpg.md",
  ]);

  const artifact = await readMessageArtifact(workspace, thread.id, message.id, "detailed-decision.md");
  assert.deepEqual(artifact, {
    artifact: "artifacts/detailed-decision.md",
    content: "# Detailed Decision",
  });
  await assert.rejects(
    () => readMessageArtifact(workspace, thread.id, message.id, "missing.md"),
    /Artifact not linked to message/,
  );
});

test("rejects paths that escape their allowed root", () => {
  assert.throws(() => assertInside("C:/project/.marc", "C:/project/other.md"), /escapes/);
});

test("updates workspace recommendations idempotently", async () => {
  const workspace = await tempWorkspace();

  const first = await updateWorkspaceRecommendations(workspace);
  const second = await updateWorkspaceRecommendations(workspace);
  const rules = await readRules(workspace);
  const instructions = await readInstructions(workspace);

  assert.deepEqual(first.updated.sort(), []);
  assert.ok(first.alreadyCurrent.includes("INSTRUCTIONS.md"));
  assert.ok(first.alreadyCurrent.includes("RULES.md"));
  assert.deepEqual(second.alreadyCurrent.sort(), ["INSTRUCTIONS.md", "RULES.md"]);
  assert.match(instructions, /^# mARC Instructions\n\n<!-- This file is generated and maintained by mARC/m);
  assert.match(
    instructions,
    /<!-- This file is generated and maintained by mARC\. Do not edit or extend it\. Put project-specific guidance in RULES\.md under Custom Rules\. -->/,
  );
  assert.match(instructions, /## Bootstrap Protocol/);
  assert.match(instructions, /workspace_bootstrap/);
  assert.match(instructions, /bootstrapConfirmed: true/);
  assert.match(instructions, /including this managed `INSTRUCTIONS\.md` file/);
  assert.match(instructions, /Read `RULES\.md` as the workspace behavior contract/);
  assert.doesNotMatch(instructions, /## Message Style/);
  assert.doesNotMatch(instructions, /## Context Reading/);
  assert.match(rules, /## Message Style/);
  assert.match(rules, /Keep messages useful, readable, and complete/);
  assert.match(rules, /Use bullets or short labeled sections when a message has multiple points/);
  assert.match(rules, /Do not remove important context just to make a message shorter/);
  assert.match(rules, /## Workspace Maintenance/);
  assert.match(rules, /Run `workspace_update_recommendations` before starting work on a thread/);
  assertSectionOrder(rules, [
    "## Workspace Maintenance",
    "## Agents",
    "## Conversation Rules",
    "## Message Style",
    "## Context Reading",
    "## Custom Rules",
  ]);
  assert.doesNotMatch(rules, /bootstrapConfirmed: true/);
  assert.match(rules, /`agent_register`/);
  assert.match(rules, /`agent_list`/);
  assert.match(rules, /`agent_read_profile`/);
  assert.match(rules, /## Context Reading/);
  assert.match(rules, /`thread_read_since`/);
  assert.doesNotMatch(rules, /`register_agent`/);
  assert.doesNotMatch(rules, /Registered Agents \(Marckers\)/);
});

test("maintains a custom rules section at the end of RULES.md", async () => {
  const workspace = await tempWorkspace();

  await updateWorkspaceRecommendations(workspace);
  let rules = await readRules(workspace);

  assert.match(
    rules,
    /## Custom Rules\n\n<!-- Keep project-specific custom rules below this line\. This section is preserved by workspace_update_recommendations\. -->\n<!-- Prefer ### or deeper headings to organize project-specific rules in this section\. -->\n$/,
  );

  await fs.appendFile(path.join(workspace, ".marc", "RULES.md"), "- Keep domain examples in Portuguese.\n");
  await updateWorkspaceRecommendations(workspace);
  rules = await readRules(workspace);

  assert.match(
    rules,
    /## Custom Rules\n\n<!-- Keep project-specific custom rules below this line\. This section is preserved by workspace_update_recommendations\. -->\n<!-- Prefer ### or deeper headings to organize project-specific rules in this section\. -->\n\n- Keep domain examples in Portuguese\.\n$/,
  );
});

test("preserves all content below the custom rules boundary", async () => {
  const workspace = await tempWorkspace();
  await initWorkspace(workspace);

  await fs.appendFile(
    path.join(workspace, ".marc", "RULES.md"),
    [
      "## Project Notes",
      "",
      "- Preserve this project-specific H2 section.",
      "",
      "### Project Workflow",
      "",
      "- Preserve this project-specific H3 section.",
      "",
    ].join("\n"),
  );

  const first = await updateWorkspaceRecommendations(workspace);
  const rules = await readRules(workspace);
  const second = await updateWorkspaceRecommendations(workspace);
  const stableRules = await readRules(workspace);

  assert.ok(first.updated.includes("RULES.md"));
  assert.ok(second.alreadyCurrent.includes("RULES.md"));
  assert.equal(stableRules, rules);
  assert.match(rules, /## Custom Rules[\s\S]*## Project Notes[\s\S]*Preserve this project-specific H2 section/);
  assert.match(rules, /## Custom Rules[\s\S]*### Project Workflow[\s\S]*Preserve this project-specific H3 section/);
});

test("removes legacy registered agent inventory while preserving custom rules", async () => {
  const workspace = await tempWorkspace();
  await initWorkspace(workspace);

  await fs.writeFile(
    path.join(workspace, ".marc", "RULES.md"),
    [
      "# mARC Rules",
      "",
      "## Workspace Maintenance",
      "",
      "- Run `workspace_update_recommendations` before starting work on a thread.",
      "",
      "## Agents",
      "",
      "Agents should register through `agent_register` before posting.",
      "",
      "## Conversation Rules",
      "",
      "- Keep messages useful, readable, and complete; link artifacts when relevant.",
      "",
      "## Message Style",
      "",
      "- Keep messages useful, readable, and complete.",
      "",
      "## Context Reading",
      "",
      "- Prefer `thread_read_since` with the stored cursor when checking for new messages.",
      "",
      "### Registered Agents (Marckers)",
      "",
      "- [codex-dev](agents/codex-dev.md) - codex-dev",
      "",
      "### Project Workflow",
      "",
      "- Before finalizing development, review project documentation.",
      "",
      "## Wrong Custom Area",
      "",
      "- This project rule was placed outside Custom Rules and should not be preserved.",
      "",
      "## Custom Rules",
      "",
      "<!-- Keep project-specific custom rules below this line. This section is preserved by workspace_update_recommendations. -->",
      "<!-- Prefer ### or deeper headings to organize project-specific rules in this section. -->",
      "",
    ].join("\n"),
  );

  await updateWorkspaceRecommendations(workspace);
  const rules = await readRules(workspace);

  assert.doesNotMatch(rules, /Registered Agents \(Marckers\)/);
  assert.doesNotMatch(rules, /\[codex-dev\]\(agents\/codex-dev\.md\)/);
  assert.doesNotMatch(rules, /Wrong Custom Area/);
  assert.doesNotMatch(rules, /This project rule was placed outside Custom Rules/);
  assert.match(rules, /## Custom Rules[\s\S]*### Project Workflow[\s\S]*Before finalizing development/);
  assert.doesNotMatch(rules, /## Context Reading[\s\S]*### Project Workflow[\s\S]*## Custom Rules/);
});

test("replaces stale workspace recommendation sections", async () => {
  const workspace = await tempWorkspace();
  await initWorkspace(workspace);

  await fs.writeFile(
    path.join(workspace, ".marc", "RULES.md"),
    [
      "# mARC Rules",
      "",
      "## Agents",
      "",
      "Agents should register through `register_agent` before posting.",
      "",
      "## Conversation Rules",
      "",
      "- Keep messages concise and link artifacts when relevant.",
      "- Prefer short or medium messages. Use more sentences instead of one huge paragraph.",
      "",
      "## Message Style",
      "- Keep messages simple, direct, and useful.",
      "- Prefer short or medium messages.",
      "- Use more sentences instead of one very long paragraph.",
      "",
      "## Context Reading",
      "- Store `lastMessageId` returned by `thread_read`, `thread_tail`, or `thread_info` when continuing a thread.",
      "",
    ].join("\n"),
  );

  await fs.writeFile(
    path.join(workspace, ".marc", "INSTRUCTIONS.md"),
    [
      "# mARC Instructions",
      "",
      "## Message Style",
      "- Keep messages simple, direct, and useful.",
      "",
      "## Workspace Maintenance",
      "- Outdated maintenance rule.",
      "",
      "## Context Reading",
      "- Prefer `thread_read_since` with the stored cursor when checking for new messages.",
      "",
    ].join("\n"),
  );

  const first = await updateWorkspaceRecommendations(workspace);
  const rules = await readRules(workspace);
  const instructions = await readInstructions(workspace);
  const second = await updateWorkspaceRecommendations(workspace);
  const stableRules = await readRules(workspace);

  assert.ok(first.updated.includes("RULES.md"));
  assert.ok(first.updated.includes("INSTRUCTIONS.md"));
  assert.ok(second.alreadyCurrent.includes("RULES.md"));
  assert.ok(second.alreadyCurrent.includes("INSTRUCTIONS.md"));
  assert.equal(stableRules, rules);
  assert.match(rules, /## Message Style\n\n- Keep messages useful, readable, and complete/);
  assert.doesNotMatch(instructions, /## Message Style/);
  assert.doesNotMatch(instructions, /## Context Reading/);
  assert.doesNotMatch(instructions, /Outdated maintenance rule/);
  assert.match(instructions, /## Bootstrap Protocol/);
  assert.match(instructions, /workspace_bootstrap/);
  assert.match(instructions, /bootstrapConfirmed: true/);
  assert.match(instructions, /^# mARC Instructions\n\n<!-- This file is generated and maintained by mARC/m);
  assert.match(
    instructions,
    /<!-- This file is generated and maintained by mARC\. Do not edit or extend it\. Put project-specific guidance in RULES\.md under Custom Rules\. -->/,
  );
  assert.match(instructions, /including this managed `INSTRUCTIONS\.md` file/);
  assert.doesNotMatch(rules, /Prefer short or medium messages/);
  assert.doesNotMatch(rules, /Keep messages concise/);
  assert.match(rules, /Keep messages useful, readable, and complete; link artifacts when relevant/);
  assert.match(rules, /## Workspace Maintenance\n\n- Run `workspace_update_recommendations` before starting work on a thread/);
  assert.match(rules, /## Agents\n\n- Agents should register through `agent_register` before posting\.\n- Use `agent_list` to discover registered agents\.\n- Use `agent_read_profile` to inspect a specific agent profile\./);
  assertSectionOrder(rules, [
    "## Workspace Maintenance",
    "## Agents",
    "## Conversation Rules",
    "## Message Style",
    "## Context Reading",
    "## Custom Rules",
  ]);
  assert.doesNotMatch(rules, /## Context Reading[\s\S]*Keep messages useful, readable, and complete/);
  assert.match(rules, /`agent_register`/);
});

test("rejects oversized chat messages and points agents to artifacts", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Long note");

  await assert.rejects(
    () =>
      appendMessage(workspace, thread.id, {
        agentId: "codex-dev",
        body: "x".repeat(2501),
      }),
    /attach an artifact/i,
  );
});

test("lists open and closed threads from SUMMARY.md state", async () => {
  const workspace = await tempWorkspace();
  const older = await createThread(workspace, "Older open");
  const newer = await createThread(workspace, "Newer open");
  const olderClosed = await createThread(workspace, "Older closed work");
  const newerClosed = await createThread(workspace, "Newer closed work");
  const olderClosedAt = "2026-05-01T10:00:00.000Z";
  const newerClosedAt = "2026-05-02T10:00:00.000Z";

  await fs.writeFile(
    path.join(workspace, ".marc", "threads", olderClosed.id, "SUMMARY.md"),
    ["# Executive Summary", "", `Thread: \`${olderClosed.id}\``, `Closed: \`${olderClosedAt}\``, "", "- Done."].join("\n"),
  );
  await fs.writeFile(
    path.join(workspace, ".marc", "threads", newerClosed.id, "SUMMARY.md"),
    ["# Executive Summary", "", `Thread: \`${newerClosed.id}\``, `Closed: \`${newerClosedAt}\``, "", "- Done."].join("\n"),
  );

  const openThreads = await listThreads(workspace);
  const closedThreads = await listThreads(workspace, { status: "closed" });
  const allThreads = await listThreads(workspace, { status: "all" });
  const transcript = await readThread(workspace, newerClosed.id);

  assert.deepEqual(openThreads.map((thread) => thread.id), [newer.id, older.id]);
  assert.deepEqual(closedThreads.map((thread) => thread.id), [newerClosed.id, olderClosed.id]);
  assert.equal(closedThreads[0].status, "closed");
  assert.equal(closedThreads[0].closedAt, newerClosedAt);
  assert.match(closedThreads[0].summaryPath ?? "", /SUMMARY\.md$/);
  assert.deepEqual(allThreads.map((thread) => thread.id), [newer.id, older.id, newerClosed.id, olderClosed.id]);
  assert.match(transcript.summary ?? "", /Executive Summary/);
});

test("reconciles missing JSON index entries from thread files", async () => {
  const workspace = await tempWorkspace();
  const closed = await createThread(workspace, "Closed from disk");
  const closedAt = "2026-05-01T11:00:00.000Z";

  await fs.writeFile(
    path.join(workspace, ".marc", "threads", closed.id, "SUMMARY.md"),
    ["# Executive Summary", "", `Thread: \`${closed.id}\``, `Closed: \`${closedAt}\``, "", "- Done."].join("\n"),
  );

  await listThreads(workspace, { status: "all" });

  const indexPath = path.join(workspace, ".marc", "cache", "thread-index.json");
  const index = JSON.parse(await fs.readFile(indexPath, "utf8")) as { threads: Array<{ id: string }> };
  index.threads = index.threads.filter((thread) => thread.id !== closed.id);
  await fs.writeFile(indexPath, JSON.stringify(index));

  const closedThreads = await listThreads(workspace, { status: "closed" });

  assert.equal(closedThreads.length, 1);
  assert.equal(closedThreads[0].id, closed.id);
  assert.equal(closedThreads[0].status, "closed");
  assert.equal(closedThreads[0].closedAt, closedAt);
});

test("handles concurrent thread index rebuilds", async () => {
  const workspace = await tempWorkspace();
  const closed = await createThread(workspace, "Concurrent closed");
  const open = await createThread(workspace, "Concurrent open");

  await fs.writeFile(
    path.join(workspace, ".marc", "threads", closed.id, "SUMMARY.md"),
    "# Executive Summary\n\nClosed: `2026-05-01T13:00:00.000Z`\n",
  );

  const results = await Promise.all(
    Array.from({ length: 12 }, (_, index) => listThreads(workspace, { status: index % 2 === 0 ? "all" : "closed" })),
  );

  assert.ok(results.some((threads) => threads.some((thread) => thread.id === open.id)));
  assert.ok(results.every((threads) => threads.some((thread) => thread.id === closed.id)));
});

test("removing SUMMARY.md reopens the thread", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Reopen me");
  const summaryPath = path.join(workspace, ".marc", "threads", thread.id, "SUMMARY.md");

  await fs.writeFile(summaryPath, "# Executive Summary\n\nClosed: `2026-05-01T12:00:00.000Z`\n");
  assert.deepEqual((await listThreads(workspace, { status: "closed" })).map((item) => item.id), [thread.id]);

  await fs.unlink(summaryPath);

  const openThreads = await listThreads(workspace);
  assert.deepEqual(openThreads.map((item) => item.id), [thread.id]);
  assert.equal(openThreads[0].status, "open");
});
