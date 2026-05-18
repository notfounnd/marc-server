import fs from "node:fs/promises";
import path from "node:path";
import { parseMessages } from "./markdown.js";
import { parseMarcReference } from "./marc-references.js";
import { marcDir, safeJoin } from "./paths.js";
import type {
  ChatMessage,
  WorkspaceAuditFinding,
  WorkspaceAuditOptions,
  WorkspaceAuditResult,
  WorkspaceAuditScope,
  WorkspaceAuditSeverity,
} from "./types.js";

const DEFAULT_MAX_FINDINGS = 50;
const AUDIT_SCOPES: Array<Exclude<WorkspaceAuditScope, "all">> = [
  "rules",
  "messages",
  "agents",
  "references",
  "artifacts",
  "preflight",
];
const FINDING_SEVERITIES = ["critical", "warning", "suggestion"] as const;

type AuditContext = {
  workspaceRoot: string;
  marcPath: string;
  options: Required<Pick<WorkspaceAuditOptions, "scope" | "severity" | "maxFindings">> &
    Pick<WorkspaceAuditOptions, "threadId" | "messageId">;
  threads: AuditThread[];
  threadIds: Set<string>;
  messageIds: Set<string>;
  agents: AuditAgent[];
  rules: string;
};

type AuditThread = {
  id: string;
  path: string;
  messages: ChatMessage[];
  artifactFiles: Set<string>;
};

type AuditAgent = {
  id: string;
  markdown: string;
};

type AuditReferences = {
  threadIds: Set<string>;
  messageIds: Set<string>;
};

type ScopeAudit = (context: AuditContext) => Promise<WorkspaceAuditFinding[]>;

function normalizeOptions(options: WorkspaceAuditOptions): AuditContext["options"] {
  return {
    scope: options.scope ?? "all",
    severity: options.severity ?? "all",
    maxFindings: Math.max(1, Math.min(100, Math.floor(options.maxFindings ?? DEFAULT_MAX_FINDINGS))),
    threadId: options.threadId,
    messageId: options.messageId,
  };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath: string): Promise<string> {
  const fileExists = await exists(filePath);
  if (!fileExists) return "";
  return fs.readFile(filePath, "utf8");
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  const rootExists = await exists(root);
  if (!rootExists) return [];

  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => entry.name).sort();
}

async function loadThreads(marcPath: string, threadId?: string): Promise<AuditThread[]> {
  const threadsRoot = safeJoin(marcPath, "threads");
  const threadsRootExists = await exists(threadsRoot);
  if (!threadsRootExists) return [];

  const entries = await fs.readdir(threadsRoot, { withFileTypes: true });
  const threadEntries = entries.filter((entry) => entry.isDirectory());
  const filteredEntries = threadId ? threadEntries.filter((entry) => entry.name === threadId) : threadEntries;
  const threads: AuditThread[] = [];

  for (const entry of filteredEntries) {
    const threadPath = safeJoin(threadsRoot, entry.name);
    const markdown = await readTextIfExists(safeJoin(threadPath, "CHAT.md"));
    const artifactNames = await listMarkdownFiles(safeJoin(threadPath, "artifacts"));
    threads.push({
      id: entry.name,
      path: threadPath,
      messages: parseMessages(markdown),
      artifactFiles: new Set(artifactNames.map((name) => `artifacts/${name}`)),
    });
  }

  return threads;
}

async function loadAuditReferences(marcPath: string): Promise<AuditReferences> {
  const threadIds = new Set<string>();
  const messageIds = new Set<string>();
  const threadsRoot = safeJoin(marcPath, "threads");
  const threadsRootExists = await exists(threadsRoot);
  if (!threadsRootExists) return { threadIds, messageIds };

  const entries = await fs.readdir(threadsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    threadIds.add(entry.name);
    const threadPath = safeJoin(threadsRoot, entry.name);
    const markdown = await readTextIfExists(safeJoin(threadPath, "CHAT.md"));
    const messages = parseMessages(markdown);
    for (const message of messages) {
      messageIds.add(message.id);
    }
  }

  return { threadIds, messageIds };
}

async function loadAgents(marcPath: string): Promise<AuditAgent[]> {
  const agentsRoot = safeJoin(marcPath, "agents");
  const agentFiles = await listMarkdownFiles(agentsRoot);
  const agents: AuditAgent[] = [];

  for (const fileName of agentFiles) {
    const id = fileName.replace(/\.md$/, "");
    agents.push({
      id,
      markdown: await fs.readFile(safeJoin(agentsRoot, fileName), "utf8"),
    });
  }

  return agents;
}

function finding(findingInput: WorkspaceAuditFinding): WorkspaceAuditFinding {
  return findingInput;
}

function messageLocation(threadId: string, messageId: string): string {
  return `marc://$${threadId}/#${messageId}`;
}

function threadArtifactLocation(threadId: string, artifact: string): string {
  return `marc://$${threadId}/!${artifact.replace(/^artifacts\//, "")}`;
}

function agentField(markdown: string, field: string): string | undefined {
  return markdown.match(new RegExp(`^${field}:\\s+(.+)$`, "m"))?.[1]?.replace(/^`|`$/g, "").trim();
}

function messageMatchesOptions(message: ChatMessage, context: AuditContext): boolean {
  if (!context.options.messageId) return true;
  return message.id === context.options.messageId;
}

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

function customRuleSections(rules: string): Array<{ heading: string; body: string; location: string }> {
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
      location: `.marc/RULES.md#custom-rules-${slugifyFragment(heading)}`,
    };
  });
}

function hasRuleContent(body: string): boolean {
  return body
    .split(/\r?\n/)
    .some((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith("<!--")) return false;
      return true;
    });
}

function hasOperationalRuleFields(body: string): boolean {
  return /Trigger:/i.test(body)
    && /Do instead:/i.test(body)
    && /Evidence:/i.test(body)
    && /Severity:/i.test(body);
}

async function auditRules(context: AuditContext): Promise<WorkspaceAuditFinding[]> {
  const findings: WorkspaceAuditFinding[] = [];
  if (!/^## Custom Rules$/m.test(context.rules)) {
    findings.push(finding({
      severity: "critical",
      scope: "rules",
      code: "custom_rules_missing",
      location: ".marc/RULES.md",
      message: "`RULES.md` does not contain `## Custom Rules`.",
      suggestion: "Restore the managed `## Custom Rules` section through `workspace_update_recommendations`.",
    }));
  }

  for (const section of customRuleSections(context.rules)) {
    if (!hasRuleContent(section.body)) continue;
    if (hasOperationalRuleFields(section.body)) continue;

    findings.push(finding({
      severity: "warning",
      scope: "rules",
      code: "custom_rule_freeform",
      location: section.location,
      message: `Custom rule section "${section.heading}" is free-form and may be harder for agents to apply deterministically.`,
      suggestion: "Convert critical guidance to `Trigger`, `Do instead`, `Evidence`, and `Severity` fields. Keep free-form text only when it is intentionally advisory.",
    }));
  }

  for (const block of rulesCriticalBlocks(context.rules)) {
    const location = ".marc/RULES.md#custom-rules";
    if (!/Trigger:/i.test(block)) {
      findings.push(finding({
        severity: "critical",
        scope: "rules",
        code: "critical_rule_missing_trigger",
        location,
        message: "A critical custom rule is missing `Trigger`.",
        suggestion: "Add a `Trigger` line that states when the rule applies.",
      }));
    }
    if (!/Do instead:/i.test(block)) {
      findings.push(finding({
        severity: "critical",
        scope: "rules",
        code: "critical_rule_missing_do_instead",
        location,
        message: "A critical custom rule is missing `Do instead`.",
        suggestion: "Add a concrete `Do instead` line for the agent to execute.",
      }));
    }
    if (!/Evidence:/i.test(block)) {
      findings.push(finding({
        severity: "critical",
        scope: "rules",
        code: "critical_rule_missing_evidence",
        location,
        message: "A critical custom rule is missing `Evidence`.",
        suggestion: "Add the minimum evidence the agent must leave when the rule applies.",
      }));
    }
  }

  return findings;
}

async function auditArtifacts(context: AuditContext): Promise<WorkspaceAuditFinding[]> {
  const findings: WorkspaceAuditFinding[] = [];

  for (const thread of context.threads) {
    const linkedArtifacts = new Set(thread.messages.flatMap((message) => message.artifacts));

    for (const message of thread.messages.filter((item) => messageMatchesOptions(item, context))) {
      for (const artifact of message.artifacts) {
        if (thread.artifactFiles.has(artifact)) continue;
        findings.push(finding({
          severity: "critical",
          scope: "artifacts",
          code: "artifact_link_missing_file",
          location: messageLocation(thread.id, message.id),
          message: `Message links missing artifact \`${artifact}\`.`,
          suggestion: "Create the artifact before posting or remove the stale artifact metadata.",
        }));
      }

      const bodyArtifacts = [...message.body.matchAll(/\bartifacts\/[A-Za-z0-9._-]+\.md\b/g)].map((match) => match[0]);
      for (const artifact of bodyArtifacts) {
        if (message.artifacts.includes(artifact)) continue;
        findings.push(finding({
          severity: "warning",
          scope: "artifacts",
          code: "artifact_reference_not_attached",
          location: messageLocation(thread.id, message.id),
          message: `Message body references \`${artifact}\` without artifact metadata.`,
          suggestion: "Attach the artifact through `message_post.artifacts` or remove the textual reference.",
        }));
      }
    }

    for (const artifact of thread.artifactFiles) {
      if (linkedArtifacts.has(artifact)) continue;
      findings.push(finding({
        severity: "warning",
        scope: "artifacts",
        code: "artifact_file_orphaned",
        location: threadArtifactLocation(thread.id, artifact),
        message: `Artifact \`${artifact}\` is stored on disk but no message links it.`,
        suggestion: "Attach it to the relevant message or remove the orphan file after review.",
      }));
    }
  }

  return findings;
}

async function auditMessages(_context: AuditContext): Promise<WorkspaceAuditFinding[]> {
  return [];
}

function removeMarkdownCode(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]+`/g, "");
}

function messageReferences(body: string): string[] {
  return [...removeMarkdownCode(body).matchAll(/marc:\/\/[^\s)]+/g)].map((match) => match[0].replace(/[.,;:!?]+$/, ""));
}

async function auditReferences(context: AuditContext): Promise<WorkspaceAuditFinding[]> {
  const findings: WorkspaceAuditFinding[] = [];
  const agentIds = new Set(context.agents.map((agent) => agent.id));

  for (const thread of context.threads) {
    for (const message of thread.messages.filter((item) => messageMatchesOptions(item, context))) {
      const references = messageReferences(message.body);

      for (const reference of references) {
        const parsed = parseMarcReference(reference);
        if (!parsed) {
          findings.push(finding({
            severity: "warning",
            scope: "references",
            code: "reference_invalid",
            location: messageLocation(thread.id, message.id),
            message: `Invalid mARC reference \`${reference}\`.`,
            suggestion: "Use canonical `marc://` references for agents, threads, messages, and artifacts.",
          }));
          continue;
        }
        if (parsed.type === "agent" && !agentIds.has(parsed.agentId)) {
          findings.push(finding({
            severity: "warning",
            scope: "references",
            code: "reference_agent_missing",
            location: messageLocation(thread.id, message.id),
            message: `Reference points to missing agent \`${parsed.agentId}\`.`,
            suggestion: "Register the agent or update the reference to an existing `marc://@agent-id`.",
          }));
        }
        if (parsed.type === "thread" && !context.threadIds.has(parsed.threadId)) {
          findings.push(finding({
            severity: "warning",
            scope: "references",
            code: "reference_thread_missing",
            location: messageLocation(thread.id, message.id),
            message: `Reference points to missing thread \`${parsed.threadId}\`.`,
            suggestion: "Update the reference to an existing `marc://$thread-id`.",
          }));
        }
        if (parsed.type === "message" && !context.messageIds.has(parsed.messageId)) {
          findings.push(finding({
            severity: "warning",
            scope: "references",
            code: "reference_message_missing",
            location: messageLocation(thread.id, message.id),
            message: `Reference points to missing message \`${parsed.messageId}\`.`,
            suggestion: "Update the reference to an existing message.",
          }));
        }
      }
    }
  }

  return findings;
}

async function auditAgents(context: AuditContext): Promise<WorkspaceAuditFinding[]> {
  const findings: WorkspaceAuditFinding[] = [];

  for (const agent of context.agents) {
    const id = agentField(agent.markdown, "ID");
    const role = agentField(agent.markdown, "Role");
    const model = agentField(agent.markdown, "Model");
    const description = agentField(agent.markdown, "Description");
    const location = `marc://@${agent.id}`;

    for (const [fieldName, value] of Object.entries({ ID: id, Role: role, Model: model, Description: description })) {
      if (value) continue;
      findings.push(finding({
        severity: "warning",
        scope: "agents",
        code: "agent_metadata_missing",
        location,
        message: `Agent profile is missing ${fieldName}.`,
        suggestion: "Refresh the profile with `agent_register` or fix the metadata block.",
      }));
    }
    if (id && id !== agent.id) {
      findings.push(finding({
        severity: "warning",
        scope: "agents",
        code: "agent_id_mismatch",
        location,
        message: `Agent profile ID \`${id}\` does not match file id \`${agent.id}\`.`,
        suggestion: "Align the `ID` field with the profile file name.",
      }));
    }
    if (description && description.length < 12) {
      findings.push(finding({
        severity: "suggestion",
        scope: "agents",
        code: "agent_description_weak",
        location,
        message: "Agent profile description is too weak to orient other agents.",
        suggestion: "Use a short operational description of what this agent does.",
      }));
    }
  }

  return findings;
}

const SCOPE_AUDITS: Record<Exclude<WorkspaceAuditScope, "all" | "preflight">, ScopeAudit> = {
  rules: auditRules,
  messages: auditMessages,
  agents: auditAgents,
  references: auditReferences,
  artifacts: auditArtifacts,
};

async function auditPreflight(_context: AuditContext): Promise<WorkspaceAuditFinding[]> {
  return [];
}

function findingKey(findingItem: WorkspaceAuditFinding): string {
  return [
    findingItem.severity,
    findingItem.scope,
    findingItem.code,
    findingItem.location,
    findingItem.message,
  ].join("\u0000");
}

function dedupeFindings(findings: WorkspaceAuditFinding[]): WorkspaceAuditFinding[] {
  const seen = new Set<string>();
  const deduped: WorkspaceAuditFinding[] = [];

  for (const findingItem of findings) {
    const key = findingKey(findingItem);
    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(findingItem);
  }

  return deduped;
}

function selectedScopes(scope: WorkspaceAuditScope): Array<Exclude<WorkspaceAuditScope, "all">> {
  if (scope === "all") return AUDIT_SCOPES;
  return [scope];
}

function filterFindings(
  findings: WorkspaceAuditFinding[],
  severity: WorkspaceAuditSeverity,
  maxFindings: number,
): WorkspaceAuditFinding[] {
  const severityFiltered = severity === "all" ? findings : findings.filter((findingItem) => findingItem.severity === severity);
  return severityFiltered.slice(0, maxFindings);
}

function summarizeFindings(
  scopes: Array<Exclude<WorkspaceAuditScope, "all">>,
  findings: WorkspaceAuditFinding[],
): WorkspaceAuditResult["summary"] {
  return {
    scopes,
    totalFindings: findings.length,
    critical: findings.filter((findingItem) => findingItem.severity === "critical").length,
    warning: findings.filter((findingItem) => findingItem.severity === "warning").length,
    suggestion: findings.filter((findingItem) => findingItem.severity === "suggestion").length,
  };
}

export async function auditWorkspace(
  workspaceRoot: string,
  options: WorkspaceAuditOptions = {},
): Promise<WorkspaceAuditResult> {
  const normalizedOptions = normalizeOptions(options);
  const marcPath = marcDir(workspaceRoot);
  const references = await loadAuditReferences(marcPath);
  const context: AuditContext = {
    workspaceRoot,
    marcPath,
    options: normalizedOptions,
    threads: await loadThreads(marcPath, normalizedOptions.threadId),
    threadIds: references.threadIds,
    messageIds: references.messageIds,
    agents: await loadAgents(marcPath),
    rules: await readTextIfExists(safeJoin(marcPath, "RULES.md")),
  };
  const scopes = selectedScopes(normalizedOptions.scope);
  const findings: WorkspaceAuditFinding[] = [];

  for (const scope of scopes) {
    if (scope === "preflight") {
      findings.push(...await auditPreflight(context));
      continue;
    }
    findings.push(...await SCOPE_AUDITS[scope](context));
  }

  const filteredFindings = filterFindings(dedupeFindings(findings), normalizedOptions.severity, normalizedOptions.maxFindings);
  return {
    ok: filteredFindings.every((findingItem) => findingItem.severity !== "critical"),
    summary: summarizeFindings(scopes, filteredFindings),
    findings: filteredFindings,
  };
}

export const workspaceAuditSeverities = FINDING_SEVERITIES;
