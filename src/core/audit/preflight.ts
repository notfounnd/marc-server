import type { WorkspaceAuditFinding } from "../types.js";
import type { AuditContext } from "./support.js";

export async function auditPreflight(
  _context: AuditContext
): Promise<WorkspaceAuditFinding[]> {
  return [];
}
