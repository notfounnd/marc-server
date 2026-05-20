import type { WorkspaceAuditFinding } from "../types.js";
import { finding, type AuditContext } from "./support.js";

function rulesCriticalBlocks(rules: string): string[] {
  const blocks = rules.split(/\n(?=\d+\. \*\*)/);
  return blocks.filter((block) => /Severity:\s*critical\b/i.test(block));
}

function slugifyFragment(value: string): string {
  return value
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function customRulesBody(rules: string): string {
  const match = /^## Custom Rules$/m.exec(rules);
  if (!match) return "";

  const rest = rules.slice(match.index + match[0].length);
  const nextHeading = rest.search(/\n##\s+/);
  if (nextHeading === -1) return rest;

  return rest.slice(0, nextHeading);
}

function customRuleSections(
  rules: string
): Array<{ heading: string; body: string; location: string }> {
  const body = customRulesBody(rules);
  const matches = Array.from(body.matchAll(/^###\s+(.+)$/gm));
  if (matches.length === 0) return [];

  return matches.map((match, index) => {
    const next = matches[index + 1];
    const start = (match.index ?? 0) + match[0].length;
    const end = next?.index ?? body.length;
    const heading = match[1].trim();
    return {
      heading,
      body: body.slice(start, end),
      location: `.marc/RULES.md#custom-rules-${slugifyFragment(heading)}`
    };
  });
}

function hasRuleContent(body: string): boolean {
  return body.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("<!--")) return false;
    return true;
  });
}

function hasOperationalRuleFields(body: string): boolean {
  return (
    /Trigger:/i.test(body) &&
    /Do instead:/i.test(body) &&
    /Evidence:/i.test(body) &&
    /Severity:/i.test(body)
  );
}

function missingCriticalRuleFieldFinding(
  block: string,
  field: string
): WorkspaceAuditFinding | undefined {
  if (new RegExp(`${field}:`, "i").test(block)) return undefined;

  const codes: Record<string, string> = {
    Trigger: "critical_rule_missing_trigger",
    "Do instead": "critical_rule_missing_do_instead",
    Evidence: "critical_rule_missing_evidence"
  };
  const suggestions: Record<string, string> = {
    Trigger: "Add a `Trigger` line that states when the rule applies.",
    "Do instead": "Add a concrete `Do instead` line for the agent to execute.",
    Evidence:
      "Add the minimum evidence the agent must leave when the rule applies."
  };
  return finding({
    severity: "critical",
    scope: "rules",
    code: codes[field],
    location: ".marc/RULES.md#custom-rules",
    message: `A critical custom rule is missing \`${field}\`.`,
    suggestion: suggestions[field]
  });
}

export async function auditRules(
  context: AuditContext
): Promise<WorkspaceAuditFinding[]> {
  const findings: WorkspaceAuditFinding[] = [];
  if (!/^## Custom Rules$/m.test(context.rules)) {
    findings.push(
      finding({
        severity: "critical",
        scope: "rules",
        code: "custom_rules_missing",
        location: ".marc/RULES.md",
        message: "`RULES.md` does not contain `## Custom Rules`.",
        suggestion:
          "Restore the managed `## Custom Rules` section through `workspace_update_recommendations`."
      })
    );
  }

  for (const section of customRuleSections(context.rules)) {
    if (!hasRuleContent(section.body)) continue;
    if (hasOperationalRuleFields(section.body)) continue;

    findings.push(
      finding({
        severity: "warning",
        scope: "rules",
        code: "custom_rule_freeform",
        location: section.location,
        message: `Custom rule section "${section.heading}" is free-form and may be harder for agents to apply deterministically.`,
        suggestion:
          "Convert critical guidance to `Trigger`, `Do instead`, `Evidence`, and `Severity` fields. Keep free-form text only when it is intentionally advisory."
      })
    );
  }

  for (const block of rulesCriticalBlocks(context.rules)) {
    const missingFields = ["Trigger", "Do instead", "Evidence"]
      .map((field) => missingCriticalRuleFieldFinding(block, field))
      .filter((item): item is WorkspaceAuditFinding => Boolean(item));
    findings.push(...missingFields);
  }

  return findings;
}
