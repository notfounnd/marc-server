import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  appendMessage,
  createThread,
  initWorkspace,
  listAgentProfiles,
  listThreads,
  readAgentProfile,
  readRules,
  readThread,
  registerAgent
} from "../src/core/workspace.js";

async function tempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "marc-core-agents-"));
}

test("registers agents and appends thread messages", async () => {
  const workspace = await tempWorkspace();
  const registration = await registerAgent(workspace, {
    id: "Codex Agent",
    displayName: "Custom Header Ignored",
    role: "Implementation Agent",
    model: "GPT 5.5",
    description:
      "Development agent working through Codex.\nExtra context is ignored by registerAgent."
  });
  const thread = await createThread(workspace, "Build V1");
  const message = await appendMessage(workspace, thread.id, {
    agentId: registration.id,
    role: "developer",
    body: "Implemented core behavior."
  });

  const agents = await listAgentProfiles(workspace);
  const agentsWithMarkdown = await listAgentProfiles(workspace, {
    includeMarkdown: true
  });
  const profile = await readAgentProfile(workspace, "Codex Agent");
  const rules = await readRules(workspace);
  const threads = await listThreads(workspace);
  const transcript = await readThread(workspace, thread.id);

  assert.deepEqual(registration, {
    id: "codex-agent",
    status: "created",
    created: true,
    alreadyExists: false,
    updated: false
  });
  assert.doesNotMatch(rules, /codex-agent/);
  assert.deepEqual(agents[0], {
    id: "codex-agent",
    role: "implementation-agent",
    model: "gpt-5.5",
    description: "Development agent working through Codex."
  });
  assert.equal("markdown" in agents[0], false);
  assert.match(agentsWithMarkdown[0].markdown ?? "", /ID: `codex-agent`/);
  assert.match(profile, /^# codex-agent$/m);
  assert.match(profile, /^ID: `codex-agent`$/m);
  assert.match(profile, /^Role: implementation-agent$/m);
  assert.match(profile, /^Model: gpt-5\.5$/m);
  assert.match(
    profile,
    /^Description: Development agent working through Codex\.$/m
  );
  assert.doesNotMatch(profile, /Custom Header Ignored/);
  assert.doesNotMatch(profile, /Extra context is ignored/);
  assert.equal(agents.length, 1);
  assert.equal(threads.length, 1);
  assert.equal(transcript.messageCount, 1);
  assert.equal(transcript.lastMessageId, message.id);
  assert.equal(transcript.markdown, undefined);
  assert.equal(transcript.messages?.length, 1);
  assert.equal(transcript.messages?.[0].id, message.id);
  assert.equal(transcript.messages?.[0].body, "Implemented core behavior.");

  const fullTranscript = await readThread(workspace, thread.id, {
    includeMarkdown: true
  });
  assert.match(fullTranscript.markdown ?? "", /Implemented core behavior/);
});

test("reports existing agent registration as updated or unchanged", async () => {
  const workspace = await tempWorkspace();
  const created = await registerAgent(workspace, {
    id: "codex-dev",
    role: "developer",
    model: "gpt-5.5",
    description: "Development agent working through Codex."
  });
  const unchanged = await registerAgent(workspace, {
    id: "codex-dev",
    role: "developer",
    model: "gpt-5.5",
    description: "Development agent working through Codex."
  });
  const updated = await registerAgent(workspace, {
    id: "codex-dev",
    role: "Developer Lead",
    model: "GPT 5.5",
    description: "Updated development agent."
  });

  assert.equal(created.status, "created");
  assert.deepEqual(unchanged, {
    id: "codex-dev",
    status: "unchanged",
    created: false,
    alreadyExists: true,
    updated: false
  });
  assert.deepEqual(updated, {
    id: "codex-dev",
    status: "updated",
    created: false,
    alreadyExists: true,
    updated: true
  });
});

test("writes only the first description line and limits official descriptions", async () => {
  const workspace = await tempWorkspace();
  const longLine = "A".repeat(200);

  await registerAgent(workspace, {
    id: "long-description-agent",
    role: "Review Agent",
    model: "Human",
    description: `${longLine}\nManual context must not be written by agent_register.`
  });

  const profile = await readAgentProfile(workspace, "long-description-agent");

  assert.match(profile, new RegExp(`^Description: ${"A".repeat(160)}$`, "m"));
  assert.doesNotMatch(profile, /Manual context must not be written/);
});

test("preserves manual agent profile context when refreshing registration metadata", async () => {
  const workspace = await tempWorkspace();
  await initWorkspace(workspace);
  await fs.writeFile(
    path.join(workspace, ".marc", "agents", "codex-dev.md"),
    [
      "# Custom Manual Header",
      "",
      "ID: `codex-dev`",
      "Role: developer",
      "Model: gpt-5.5",
      "Description: Existing manual description.",
      "",
      "## Manual Context",
      "",
      "Keep this operational guidance.",
      ""
    ].join("\n")
  );

  const result = await registerAgent(workspace, {
    id: "codex-dev",
    role: "Developer Agent",
    model: "GPT 5.5",
    description: "Development agent working through Codex."
  });
  const profile = await readAgentProfile(workspace, "codex-dev");

  assert.equal(result.status, "updated");
  assert.match(profile, /^# codex-dev$/m);
  assert.match(profile, /^Role: developer-agent$/m);
  assert.match(
    profile,
    /^Description: Development agent working through Codex\.$/m
  );
  assert.match(profile, /## Manual Context/);
  assert.match(profile, /Keep this operational guidance\./);
});

test("agent list parses manual profile descriptions as a single line without truncating", async () => {
  const workspace = await tempWorkspace();
  await initWorkspace(workspace);
  const longDescription = "A".repeat(220);
  await fs.writeFile(
    path.join(workspace, ".marc", "agents", "manual-agent.md"),
    [
      "# Manual Header",
      "",
      "ID: `manual-agent`",
      "Role: reviewer",
      "Model: human",
      `Description: ${longDescription}`,
      "",
      "## Context",
      "This text is available only through full profile reads.",
      ""
    ].join("\n")
  );

  const agents = await listAgentProfiles(workspace);

  assert.deepEqual(agents, [
    {
      id: "manual-agent",
      role: "reviewer",
      model: "human",
      description: longDescription
    }
  ]);
});
