import { parseMarcReference } from "../marc-references.js";
import type { WorkspaceAuditFinding } from "../types.js";
import {
  finding,
  messageLocation,
  messageMatchesOptions,
  type AuditContext
} from "./support.js";
import { messageReferences } from "./messages.js";

function missingReferenceFinding(
  reference: string,
  context: AuditContext,
  threadId: string,
  messageId: string
): WorkspaceAuditFinding | undefined {
  const parsed = parseMarcReference(reference);
  const location = messageLocation(threadId, messageId);
  if (!parsed) {
    return finding({
      severity: "warning",
      scope: "references",
      code: "reference_invalid",
      location,
      message: `Invalid mARC reference \`${reference}\`.`,
      suggestion:
        "Use canonical `marc://` references for agents, threads, messages, and artifacts."
    });
  }

  const agentIds = new Set(context.agents.map((agent) => agent.id));
  if (parsed.type === "agent" && !agentIds.has(parsed.agentId)) {
    return finding({
      severity: "warning",
      scope: "references",
      code: "reference_agent_missing",
      location,
      message: `Reference points to missing agent \`${parsed.agentId}\`.`,
      suggestion:
        "Register the agent or update the reference to an existing `marc://@agent-id`."
    });
  }

  if (parsed.type === "thread" && !context.threadIds.has(parsed.threadId)) {
    return finding({
      severity: "warning",
      scope: "references",
      code: "reference_thread_missing",
      location,
      message: `Reference points to missing thread \`${parsed.threadId}\`.`,
      suggestion: "Update the reference to an existing `marc://$thread-id`."
    });
  }

  if (parsed.type === "message" && !context.messageIds.has(parsed.messageId)) {
    return finding({
      severity: "warning",
      scope: "references",
      code: "reference_message_missing",
      location,
      message: `Reference points to missing message \`${parsed.messageId}\`.`,
      suggestion: "Update the reference to an existing message."
    });
  }

  return undefined;
}

export async function auditReferences(
  context: AuditContext
): Promise<WorkspaceAuditFinding[]> {
  const findings: WorkspaceAuditFinding[] = [];

  for (const thread of context.threads) {
    for (const message of thread.messages.filter((item) =>
      messageMatchesOptions(item, context)
    )) {
      for (const reference of messageReferences(message.body)) {
        const referenceFinding = missingReferenceFinding(
          reference,
          context,
          thread.id,
          message.id
        );
        if (!referenceFinding) continue;
        findings.push(referenceFinding);
      }
    }
  }

  return findings;
}
