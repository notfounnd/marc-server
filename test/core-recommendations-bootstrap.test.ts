import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  readRules,
  updateWorkspaceRecommendations
} from "../src/core/workspace.js";

async function tempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "marc-bootstrap-guidance-"));
}

async function readInstructions(workspace: string): Promise<string> {
  return fs.readFile(path.join(workspace, ".marc", "INSTRUCTIONS.md"), "utf8");
}

async function readWorkspaceSkill(workspace: string): Promise<string> {
  return fs.readFile(
    path.join(workspace, ".agents", "skills", "marc-ops", "SKILL.md"),
    "utf8"
  );
}

test("guides agents to reuse known workspace context without ritual bootstrap", async () => {
  const workspace = await tempWorkspace();

  await updateWorkspaceRecommendations(workspace);
  const instructions = await readInstructions(workspace);
  const rules = await readRules(workspace);
  const skill = await readWorkspaceSkill(workspace);

  assert.match(
    instructions,
    /Reuse the current workspace contract while it remains known/
  );
  assert.match(
    rules,
    /Avoid repeating bootstrap as a ritual before each mARC action/
  );
  assert.doesNotMatch(skill, /bootstrapConfirmed/);
  assert.match(skill, /Always when starting a session in a mARC workspace/);
  assert.match(
    skill,
    /Always when resuming after compaction, reconnect, rebuild, tool error, or daemon\/MCP restart/
  );
  assert.match(
    skill,
    /Always when bootstrap context is missing, stale, or uncertain/
  );
  assert.match(skill, /Always when choosing how to read or continue a thread/);
  assert.match(
    skill,
    /Always when a specific mARC thread, message, artifact, or agent reference is the requested source/
  );
  assert.doesNotMatch(skill, /Always before reading or continuing a thread/);
  assert.doesNotMatch(skill, /Always before posting a message in a thread/);
  assert.match(
    skill,
    /Establish bootstrap context at the start of a session or workspace/
  );
  assert.match(
    skill,
    /Read `RULES\.md` from the bootstrap response and treat it as the workspace contract/
  );
  assert.match(
    skill,
    /Reuse the current workspace contract while it remains known/
  );
});

test("guides agents to attach artifacts through message metadata", async () => {
  const workspace = await tempWorkspace();

  await updateWorkspaceRecommendations(workspace);
  const rules = await readRules(workspace);
  const skill = await readWorkspaceSkill(workspace);

  assert.doesNotMatch(skill, /reference the attached path in the message/);
  assert.match(
    skill,
    /Attach artifacts through message metadata so the UI can display them/
  );
  assert.match(
    skill,
    /Do not repeat `artifacts\/.*` paths in the message body just to show an attached artifact/
  );
  assert.match(
    rules,
    /Use artifact metadata for long plans, logs, reviews, or detailed analysis/
  );
  assert.doesNotMatch(rules, /link artifacts when relevant/i);
});

test("guides agents to advance thread cursors only after consuming message content", async () => {
  const workspace = await tempWorkspace();

  await updateWorkspaceRecommendations(workspace);
  const rules = await readRules(workspace);
  const skill = await readWorkspaceSkill(workspace);

  assert.match(
    skill,
    /Advance the consumed cursor only after you have read and processed message content/
  );
  assert.match(
    skill,
    /Metadata from `thread_info` does not advance the consumed-content cursor/
  );
  assert.match(skill, /`thread_tail` proves only the returned window was read/);
  assert.match(
    rules,
    /Store a thread cursor only after its message content has been read and consumed/
  );
  assert.match(
    rules,
    /`thread_info` metadata does not advance the consumed-content cursor/
  );
  assert.match(rules, /`thread_tail` covers only its returned window/);
});

test("guides agents to reuse profiles and publish material thread updates", async () => {
  const workspace = await tempWorkspace();

  await updateWorkspaceRecommendations(workspace);
  const rules = await readRules(workspace);
  const skill = await readWorkspaceSkill(workspace);

  assert.match(
    skill,
    /Discover and reuse a suitable profile before registering/
  );
  assert.match(
    skill,
    /only when necessary and permitted by the workspace contract/
  );
  assert.match(
    skill,
    /Publish material decisions, findings, risks, blockers, and results/
  );
  assert.match(
    skill,
    /Avoid routine read acknowledgments and iteration-by-iteration status updates/
  );
  assert.doesNotMatch(skill, /Prefer incremental thread comments/);
  assert.match(rules, /Reuse an existing profile when it fits/);
  assert.match(
    rules,
    /Register or update a profile only when necessary and permitted/
  );
  assert.match(
    rules,
    /Publish material decisions, discoveries, risks, blockers, results, and consolidated deliveries or genuine handoffs/
  );
});

test("distinguishes bootstrap from recommendation refresh and preserves JSON formats", async () => {
  const workspace = await tempWorkspace();

  await updateWorkspaceRecommendations(workspace);
  const rules = await readRules(workspace);
  const skill = await readWorkspaceSkill(workspace);

  assert.match(skill, /Refreshing recommendations does not replace bootstrap/);
  assert.match(
    rules,
    /Run `workspace_update_recommendations` before starting work on a thread/
  );
  assert.match(
    skill,
    /Keep Markdown for human-readable knowledge and coordination records/
  );
  assert.match(skill, /preserve structured formats such as JSON/);
  assert.match(
    rules,
    /Use Markdown for human-readable knowledge and coordination records; preserve structured workspace formats such as JSON/
  );
  assert.match(
    rules,
    /Refreshing recommendations does not establish or restore bootstrap context/
  );
});
