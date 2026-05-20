import type { WorkspaceAuditFinding } from "../types.js";
import type { AuditContext } from "./support.js";

export async function auditMessages(
  _context: AuditContext
): Promise<WorkspaceAuditFinding[]> {
  return [];
}

export function removeMarkdownCode(content: string): string {
  return content.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]+`/g, "");
}

export function messageReferences(body: string): string[] {
  return [...removeMarkdownCode(body).matchAll(/marc:\/\/[^\s)]+/g)].map(
    (match) => match[0].replace(/[.,;:!?]+$/, "")
  );
}
