import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { auditWorkspace } from "../src/core/audit.js";
import {
  appendMessage,
  attachArtifact,
  createThread,
  updateWorkspaceRecommendations
} from "../src/core/workspace.js";

async function tempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "marc-core-"));
}

test("audits workspace content for rules, artifacts, references, agents, and preflight", async () => {
  const workspace = await tempWorkspace();
  await updateWorkspaceRecommendations(workspace);
  const thread = await createThread(workspace, "Audit target");
  const message = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    role: "developer",
    body: [
      "Plano registrado em artifacts/plano.md.",
      "",
      "Referencias: marc://@missing-agent e marc://not-valid."
    ].join("\n"),
    artifacts: ["artifacts/missing.md"]
  });
  await attachArtifact(workspace, thread.id, "orphan.md", "# Orphan\n");
  await fs.writeFile(
    path.join(workspace, ".marc", "agents", "broken-agent.md"),
    [
      "# broken-agent",
      "",
      "ID: `other-agent`",
      "Role: reviewer",
      "Model: human",
      "Description: bad",
      ""
    ].join("\n")
  );
  await fs.appendFile(
    path.join(workspace, ".marc", "RULES.md"),
    [
      "",
      "### Required Preflight",
      "",
      "1. **Planning sources**",
      "   Severity: critical.",
      ""
    ].join("\n")
  );

  const result = await auditWorkspace(workspace, {
    scope: "all",
    threadId: thread.id,
    messageId: message.id,
    maxFindings: 20
  });
  const codes = result.findings.map((finding) => finding.code);

  assert.equal(result.ok, false);
  assert.ok(codes.includes("artifact_link_missing_file"));
  assert.ok(codes.includes("artifact_file_orphaned"));
  assert.ok(codes.includes("artifact_reference_not_attached"));
  assert.ok(codes.includes("reference_invalid"));
  assert.ok(codes.includes("reference_agent_missing"));
  assert.ok(codes.includes("agent_id_mismatch"));
  assert.ok(codes.includes("agent_description_weak"));
  assert.ok(codes.includes("critical_rule_missing_trigger"));
  assert.ok(codes.includes("critical_rule_missing_do_instead"));
  assert.ok(codes.includes("critical_rule_missing_evidence"));
});

test("does not audit planning text semantically", async () => {
  const workspace = await tempWorkspace();
  await updateWorkspaceRecommendations(workspace);
  const thread = await createThread(workspace, "Semantic audit target");
  const message = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: "Plano detalhado registrado antes do desenvolvimento."
  });

  const result = await auditWorkspace(workspace, {
    scope: "all",
    threadId: thread.id,
    messageId: message.id
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.findings, []);
});

test("resolves references to closed threads", async () => {
  const workspace = await tempWorkspace();
  await updateWorkspaceRecommendations(workspace);
  const target = await createThread(workspace, "Closed reference target");
  await fs.writeFile(
    path.join(workspace, ".marc", "threads", target.id, "SUMMARY.md"),
    "# Summary\n"
  );
  const thread = await createThread(workspace, "Reference audit target");
  const message = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: `Reference: marc://$${target.id}.`
  });

  const result = await auditWorkspace(workspace, {
    scope: "references",
    threadId: thread.id,
    messageId: message.id
  });

  assert.equal(result.ok, true);
  assert.ok(
    !result.findings.some(
      (finding) => finding.code === "reference_thread_missing"
    )
  );
});

test("ignores mARC references inside markdown code", async () => {
  const workspace = await tempWorkspace();
  await updateWorkspaceRecommendations(workspace);
  const thread = await createThread(workspace, "Code reference audit target");
  const message = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: [
      "Use `marc://$thread-id` as a placeholder.",
      "",
      "```text",
      "marc://$another-placeholder",
      "```"
    ].join("\n")
  });

  const result = await auditWorkspace(workspace, {
    scope: "references",
    threadId: thread.id,
    messageId: message.id
  });

  assert.deepEqual(result.findings, []);
});

test("reports missing agent metadata as warnings", async () => {
  const workspace = await tempWorkspace();
  await updateWorkspaceRecommendations(workspace);
  await fs.writeFile(
    path.join(workspace, ".marc", "agents", "incomplete-agent.md"),
    [
      "# incomplete-agent",
      "",
      "ID: `incomplete-agent`",
      "Role: reviewer",
      "Model: human",
      ""
    ].join("\n")
  );

  const result = await auditWorkspace(workspace, {
    scope: "agents",
    severity: "warning"
  });

  const metadataFinding = result.findings.find(
    (finding) => finding.code === "agent_metadata_missing"
  );
  assert.equal(result.ok, true);
  assert.equal(metadataFinding?.severity, "warning");
});

test("deduplicates repeated findings in all scope", async () => {
  const workspace = await tempWorkspace();
  await updateWorkspaceRecommendations(workspace);
  const thread = await createThread(workspace, "Duplicate audit target");
  const message = await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: "References: marc://not-valid marc://not-valid"
  });

  const result = await auditWorkspace(workspace, {
    scope: "all",
    threadId: thread.id,
    messageId: message.id
  });
  const invalidReferences = result.findings.filter(
    (finding) => finding.code === "reference_invalid"
  );

  assert.equal(invalidReferences.length, 1);
});

test("filters workspace audit findings by severity and max findings", async () => {
  const workspace = await tempWorkspace();
  await updateWorkspaceRecommendations(workspace);
  const thread = await createThread(workspace, "Filtered audit target");
  await appendMessage(workspace, thread.id, {
    agentId: "codex-dev",
    body: "Plano sem fontes.",
    artifacts: ["artifacts/missing.md"]
  });

  const result = await auditWorkspace(workspace, {
    scope: "all",
    threadId: thread.id,
    severity: "critical",
    maxFindings: 1
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.summary.totalFindings, 1);
  assert.equal(result.findings[0].severity, "critical");
});
