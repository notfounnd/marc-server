import type { WorkspaceAuditFinding } from "../types.js";
import { agentField, finding, type AuditContext } from "./support.js";

function missingAgentMetadataFinding(
  fieldName: string,
  value: string | undefined,
  location: string
): WorkspaceAuditFinding | undefined {
  if (value) return undefined;
  return finding({
    severity: "warning",
    scope: "agents",
    code: "agent_metadata_missing",
    location,
    message: `Agent profile is missing ${fieldName}.`,
    suggestion:
      "Refresh the profile with `agent_register` or fix the metadata block."
  });
}

function agentIdMismatchFinding(
  id: string | undefined,
  agentId: string,
  location: string
): WorkspaceAuditFinding | undefined {
  if (!id) return undefined;
  if (id === agentId) return undefined;
  return finding({
    severity: "warning",
    scope: "agents",
    code: "agent_id_mismatch",
    location,
    message: `Agent profile ID \`${id}\` does not match file id \`${agentId}\`.`,
    suggestion: "Align the `ID` field with the profile file name."
  });
}

function weakAgentDescriptionFinding(
  description: string | undefined,
  location: string
): WorkspaceAuditFinding | undefined {
  if (!description) return undefined;
  if (description.length >= 12) return undefined;
  return finding({
    severity: "suggestion",
    scope: "agents",
    code: "agent_description_weak",
    location,
    message: "Agent profile description is too weak to orient other agents.",
    suggestion: "Use a short operational description of what this agent does."
  });
}

export async function auditAgents(
  context: AuditContext
): Promise<WorkspaceAuditFinding[]> {
  const findings: WorkspaceAuditFinding[] = [];

  for (const agent of context.agents) {
    const id = agentField(agent.markdown, "ID");
    const role = agentField(agent.markdown, "Role");
    const model = agentField(agent.markdown, "Model");
    const description = agentField(agent.markdown, "Description");
    const location = `marc://@${agent.id}`;
    const metadataFindings = Object.entries({
      ID: id,
      Role: role,
      Model: model,
      Description: description
    })
      .map(([fieldName, value]) =>
        missingAgentMetadataFinding(fieldName, value, location)
      )
      .filter((item): item is WorkspaceAuditFinding => Boolean(item));

    findings.push(...metadataFindings);
    findings.push(
      ...[
        agentIdMismatchFinding(id, agent.id, location),
        weakAgentDescriptionFinding(description, location)
      ].filter((item): item is WorkspaceAuditFinding => Boolean(item))
    );
  }

  return findings;
}
