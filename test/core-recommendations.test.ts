import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { auditWorkspace } from "../src/core/audit.js";
import { assertInside } from "../src/core/paths.js";
import {
  appendMessage,
  createThread,
  initWorkspace,
  readRules,
  updateWorkspaceRecommendations
} from "../src/core/workspace.js";

async function tempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "marc-core-recommendations-"));
}

async function readInstructions(workspace: string): Promise<string> {
  return fs.readFile(path.join(workspace, ".marc", "INSTRUCTIONS.md"), "utf8");
}

function assertSectionOrder(markdown: string, headings: string[]): void {
  const positions = headings.map((heading) => markdown.indexOf(heading));

  for (let index = 0; index < headings.length; index += 1) {
    assert.notEqual(positions[index], -1, `${headings[index]} should exist`);
  }

  for (let index = 1; index < headings.length; index += 1) {
    assert.ok(
      positions[index - 1] < positions[index],
      `${headings[index - 1]} should appear before ${headings[index]}`
    );
  }
}

test("rejects paths that escape their allowed root", () => {
  assert.throws(
    () => assertInside("C:/project/.marc", "C:/project/other.md"),
    /escapes/
  );
});

test("updates workspace recommendations idempotently", async () => {
  const workspace = await tempWorkspace();

  const first = await updateWorkspaceRecommendations(workspace);
  const second = await updateWorkspaceRecommendations(workspace);
  const rules = await readRules(workspace);
  const instructions = await readInstructions(workspace);
  const skill = await fs.readFile(
    path.join(workspace, ".agents", "skills", "marc-ops", "SKILL.md"),
    "utf8"
  );

  assert.deepEqual(first.updated.sort(), [".agents/skills/marc-ops/SKILL.md"]);
  assert.ok(first.alreadyCurrent.includes("INSTRUCTIONS.md"));
  assert.ok(first.alreadyCurrent.includes("RULES.md"));
  assert.deepEqual(second.alreadyCurrent.sort(), [
    ".agents/skills/marc-ops/SKILL.md",
    "INSTRUCTIONS.md",
    "RULES.md"
  ]);
  assert.doesNotMatch(instructions, /## Message Style/);
  assert.match(instructions, /## Bootstrap Protocol/);
  assert.match(instructions, /workspace_bootstrap/);
  assert.ok(
    skill.includes(
      'description: "Operate inside a mARC-enabled repository. Activates EVERY session in this workspace. Always active when a session starts, after every compaction, and whenever development is requested only if the skill has not already been loaded in the active session. Establish bootstrap context, read RULES.md, and apply Custom Rules, artifact metadata, marc:// references, and workspace_audit checkpoints. This process must not be ignored."'
    )
  );
  assert.ok(
    skill.includes(
      'when_to_use: "Use this always-active skill at the start of every session in a mARC workspace, after every compaction, reconnecting, or context loss, and whenever development is requested only if it has not already been loaded in the active session. Use it before proposing, planning, editing, posting messages, attaching artifacts, validating, concluding, or closing mARC work."'
    )
  );
  assert.doesNotMatch(skill, /^description: \|$/m);
  assert.doesNotMatch(skill, /^when_to_use: \|$/m);
  assert.match(skill, /## Always Active/);
  assert.match(
    skill,
    /\*\*This skill is active for every session in this mARC workspace\.\*\*/
  );
  assert.match(rules, /## Message Style/);
  assert.match(
    rules,
    /Do not remove important context just to make a message shorter/
  );
  assertSectionOrder(rules, [
    "## Workspace Maintenance",
    "## Agents",
    "## Conversation Rules",
    "## Message Style",
    "## Context Reading",
    "## Operational Custom Rules",
    "## Custom Rules"
  ]);
});

test("maintains a custom rules section at the end of RULES.md", async () => {
  const workspace = await tempWorkspace();

  await updateWorkspaceRecommendations(workspace);
  let rules = await readRules(workspace);

  assert.match(
    rules,
    /## Custom Rules\n\n<!-- Keep project-specific custom rules below this line\. This section is preserved by workspace_update_recommendations\. -->\n<!-- Prefer ### or deeper headings to organize project-specific rules in this section\. -->\n$/
  );

  await fs.appendFile(
    path.join(workspace, ".marc", "RULES.md"),
    "- Keep domain examples in Portuguese.\n"
  );
  await updateWorkspaceRecommendations(workspace);
  rules = await readRules(workspace);

  assert.match(
    rules,
    /## Custom Rules[\s\S]*- Keep domain examples in Portuguese\.\n$/
  );
});

test("audits free-form custom rules as operational guidance warnings", async () => {
  const workspace = await tempWorkspace();
  await updateWorkspaceRecommendations(workspace);
  await fs.appendFile(
    path.join(workspace, ".marc", "RULES.md"),
    [
      "",
      "### Agent Tooling",
      "",
      "- Always use context-mode for repository investigation.",
      "",
      "### Required Preflight",
      "",
      "1. **Planning sources**",
      "   Trigger: before presenting a plan.",
      "   Do instead: read README.md and docs first.",
      "   Evidence: list the files read.",
      "   Severity: critical.",
      ""
    ].join("\n")
  );

  const result = await auditWorkspace(workspace, {
    scope: "rules",
    severity: "warning"
  });

  assert.equal(result.ok, true);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].code, "custom_rule_freeform");
  assert.equal(
    result.findings[0].location,
    ".marc/RULES.md#custom-rules-agent-tooling"
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
      ""
    ].join("\n")
  );

  const first = await updateWorkspaceRecommendations(workspace);
  const rules = await readRules(workspace);
  const second = await updateWorkspaceRecommendations(workspace);
  const stableRules = await readRules(workspace);

  assert.ok(first.updated.includes("RULES.md"));
  assert.ok(second.alreadyCurrent.includes("RULES.md"));
  assert.equal(stableRules, rules);
  assert.match(
    rules,
    /## Custom Rules[\s\S]*## Project Notes[\s\S]*Preserve this project-specific H2 section/
  );
  assert.match(
    rules,
    /## Custom Rules[\s\S]*### Project Workflow[\s\S]*Preserve this project-specific H3 section/
  );
});

test("removes legacy registered agent inventory while preserving custom rules", async () => {
  const workspace = await tempWorkspace();
  await initWorkspace(workspace);

  await fs.writeFile(
    path.join(workspace, ".marc", "RULES.md"),
    [
      "# mARC Rules",
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
      ""
    ].join("\n")
  );

  await updateWorkspaceRecommendations(workspace);
  const rules = await readRules(workspace);

  assert.doesNotMatch(rules, /Registered Agents \(Marckers\)/);
  assert.doesNotMatch(rules, /\[codex-dev\]\(agents\/codex-dev\.md\)/);
  assert.doesNotMatch(rules, /Wrong Custom Area/);
  assert.doesNotMatch(
    rules,
    /This project rule was placed outside Custom Rules/
  );
  assert.match(
    rules,
    /## Custom Rules[\s\S]*### Project Workflow[\s\S]*Before finalizing development/
  );
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
      "- Prefer short or medium messages.",
      ""
    ].join("\n")
  );
  await fs.writeFile(
    path.join(workspace, ".marc", "INSTRUCTIONS.md"),
    "# mARC Instructions\n\n## Message Style\n- Old rule.\n"
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
  assert.doesNotMatch(instructions, /## Message Style/);
  assert.match(instructions, /## Bootstrap Protocol/);
  assert.doesNotMatch(rules, /register_agent/);
  assert.doesNotMatch(rules, /Keep messages concise/);
  assert.match(rules, /`agent_register`/);
  assert.match(rules, /Keep messages useful, readable, and complete/);
  assert.match(
    rules,
    /Use artifact metadata for long plans, logs, reviews, or detailed analysis/
  );
});

test("preserves custom rules during concurrent recommendation refreshes", async () => {
  const workspace = await tempWorkspace();
  await updateWorkspaceRecommendations(workspace);
  await fs.appendFile(
    path.join(workspace, ".marc", "RULES.md"),
    ["", "### Project Rule", "", "- Preserve this custom rule.", ""].join("\n")
  );

  await Promise.all(
    Array.from({ length: 12 }, () => updateWorkspaceRecommendations(workspace))
  );

  const rules = await readRules(workspace);

  assert.match(rules, /### Project Rule/);
  assert.match(rules, /Preserve this custom rule\./);
  assert.equal(rules.match(/### Project Rule/g)?.length, 1);
});

test("rejects oversized chat messages and points agents to artifacts", async () => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Long note");

  await assert.rejects(
    () =>
      appendMessage(workspace, thread.id, {
        agentId: "codex-dev",
        body: "x".repeat(2501)
      }),
    /attach an artifact/i
  );
});
