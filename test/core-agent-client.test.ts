import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { auditWorkspace } from "../src/core/audit.js";
import {
  initWorkspace,
  listAgentProfiles,
  readAgentProfile,
  registerAgent,
  updateWorkspaceRecommendations
} from "../src/core/workspace.js";
import type { AgentProfile } from "../src/core/types.js";

async function tempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "marc-core-agent-client-"));
}

const BASE: AgentProfile = {
  id: "codex-dev",
  role: "developer",
  model: "claude-haiku-5-5",
  description: "Development agent for the client fixture."
};

/** A profile file whose manual context holds a Client-looking line that must never be read as a header. */
function profileFile(clientLines: string[]): string {
  return [
    "# codex-dev",
    "",
    "ID: `codex-dev`",
    "Role: developer",
    "Model: claude-haiku-5-5",
    ...clientLines,
    "Description: Existing profile.",
    "",
    "## Manual Context",
    "",
    "Client: gemini",
    ""
  ].join("\n");
}

/** The Client value of the header only: the text before the Description line. */
function headerClientOf(profile: string): string | undefined {
  const header = profile.slice(0, profile.indexOf("Description:"));
  return /^Client: (.+)$/m.exec(header)?.[1];
}

const registerRows: {
  name: string;
  existing: string[];
  input: AgentProfile;
  expected: string | undefined;
}[] = [
  {
    name: "keeps the file's Client line when the input names no client",
    existing: ["Client: codex"],
    input: BASE,
    expected: "codex"
  },
  {
    name: "replaces the file's Client line when the input names a client",
    existing: ["Client: codex"],
    input: { ...BASE, client: "claude-code" },
    expected: "claude-code"
  },
  {
    name: "keeps a raw value that the audit will report, unchanged",
    existing: ["Client: gemini"],
    input: BASE,
    expected: "gemini"
  },
  {
    name: "writes no Client line when neither the file nor the input names one",
    existing: [],
    input: BASE,
    expected: undefined
  },
  {
    name: "writes the Client line of a new client when the input names one",
    existing: [],
    input: { ...BASE, client: "codex" },
    expected: "codex"
  }
];

for (const row of registerRows) {
  test(`agent register keeps the Client line: ${row.name}`, async () => {
    const workspace = await tempWorkspace();
    await initWorkspace(workspace);
    await fs.writeFile(
      path.join(workspace, ".marc", "agents", "codex-dev.md"),
      profileFile(row.existing)
    );

    await registerAgent(workspace, row.input);
    const profile = await readAgentProfile(workspace, "codex-dev");
    const listed = await listAgentProfiles(workspace);

    assert.equal(headerClientOf(profile), row.expected);
    assert.equal(listed[0]?.client, row.expected);
    assert.match(profile, /Client: gemini/);
  });
}

const auditRows: {
  name: string;
  existing: string[];
  findings: number;
}[] = [
  {
    name: "a known client has no finding",
    existing: ["Client: codex"],
    findings: 0
  },
  {
    name: "an unknown client is reported as a warning",
    existing: ["Client: gemini"],
    findings: 1
  },
  {
    name: "a Client line only in the manual context is not a header field",
    existing: [],
    findings: 0
  }
];

for (const row of auditRows) {
  test(`agent audit reports unknown clients: ${row.name}`, async () => {
    const workspace = await tempWorkspace();
    await initWorkspace(workspace);
    await updateWorkspaceRecommendations(workspace);
    await fs.writeFile(
      path.join(workspace, ".marc", "agents", "codex-dev.md"),
      profileFile(row.existing)
    );

    const result = await auditWorkspace(workspace, {
      scope: "agents",
      severity: "all"
    });
    const unknown = result.findings.filter(
      (finding) => finding.code === "agent_client_unknown"
    );

    assert.equal(unknown.length, row.findings);
    for (const finding of unknown) {
      assert.equal(finding.severity, "warning");
    }
  });
}
