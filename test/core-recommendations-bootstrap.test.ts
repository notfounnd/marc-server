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
