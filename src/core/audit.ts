import { auditAgents } from "./audit/agents.js";
import { auditArtifacts } from "./audit/artifacts.js";
import { auditMessages } from "./audit/messages.js";
import { auditPreflight } from "./audit/preflight.js";
import { auditReferences } from "./audit/references.js";
import { auditRules } from "./audit/rules.js";
import {
  auditScopeNames,
  auditSeverities,
  dedupeFindings,
  filterFindings,
  loadAuditContext,
  normalizeOptions,
  summarizeFindings,
  type AuditContext
} from "./audit/support.js";
import type {
  WorkspaceAuditFinding,
  WorkspaceAuditOptions,
  WorkspaceAuditResult,
  WorkspaceAuditScope
} from "./types.js";

type ScopeAudit = (context: AuditContext) => Promise<WorkspaceAuditFinding[]>;

const SCOPE_AUDITS: Record<
  Exclude<WorkspaceAuditScope, "all" | "preflight">,
  ScopeAudit
> = {
  rules: auditRules,
  messages: auditMessages,
  agents: auditAgents,
  references: auditReferences,
  artifacts: auditArtifacts
};

function selectedScopes(
  scope: WorkspaceAuditScope
): Array<Exclude<WorkspaceAuditScope, "all">> {
  if (scope === "all") return auditScopeNames;
  return [scope];
}

async function auditScope(
  scope: Exclude<WorkspaceAuditScope, "all">,
  context: AuditContext
): Promise<WorkspaceAuditFinding[]> {
  if (scope === "preflight") return auditPreflight(context);
  return SCOPE_AUDITS[scope](context);
}

export async function auditWorkspace(
  workspaceRoot: string,
  options: WorkspaceAuditOptions = {}
): Promise<WorkspaceAuditResult> {
  const normalizedOptions = normalizeOptions(options);
  const context = await loadAuditContext(workspaceRoot, normalizedOptions);
  const scopes = selectedScopes(normalizedOptions.scope);
  const findings: WorkspaceAuditFinding[] = [];

  for (const scope of scopes) {
    findings.push(...(await auditScope(scope, context)));
  }

  const filteredFindings = filterFindings(
    dedupeFindings(findings),
    normalizedOptions.severity,
    normalizedOptions.maxFindings
  );
  return {
    ok: filteredFindings.every(
      (findingItem) => findingItem.severity !== "critical"
    ),
    summary: summarizeFindings(scopes, filteredFindings),
    findings: filteredFindings
  };
}

export const workspaceAuditSeverities = auditSeverities;
