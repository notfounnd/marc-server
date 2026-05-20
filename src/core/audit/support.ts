import fs from "node:fs/promises";
import { parseMessages } from "../markdown.js";
import { marcDir, safeJoin } from "../paths.js";
import type {
  ChatMessage,
  WorkspaceAuditFinding,
  WorkspaceAuditOptions,
  WorkspaceAuditScope,
  WorkspaceAuditSeverity
} from "../types.js";

const DEFAULT_MAX_FINDINGS = 50;

export const auditScopeNames: Array<Exclude<WorkspaceAuditScope, "all">> = [
  "rules",
  "messages",
  "agents",
  "references",
  "artifacts",
  "preflight"
];

export const auditSeverities = ["critical", "warning", "suggestion"] as const;

export type AuditOptions = Required<
  Pick<WorkspaceAuditOptions, "scope" | "severity" | "maxFindings">
> &
  Pick<WorkspaceAuditOptions, "threadId" | "messageId">;

export type AuditContext = {
  workspaceRoot: string;
  marcPath: string;
  options: AuditOptions;
  threads: AuditThread[];
  threadIds: Set<string>;
  messageIds: Set<string>;
  agents: AuditAgent[];
  rules: string;
};

export type AuditThread = {
  id: string;
  path: string;
  messages: ChatMessage[];
  artifactFiles: Set<string>;
};

export type AuditAgent = {
  id: string;
  markdown: string;
};

type AuditReferences = {
  threadIds: Set<string>;
  messageIds: Set<string>;
};

export function normalizeOptions(options: WorkspaceAuditOptions): AuditOptions {
  return {
    scope: options.scope ?? "all",
    severity: options.severity ?? "all",
    maxFindings: Math.max(
      1,
      Math.min(100, Math.floor(options.maxFindings ?? DEFAULT_MAX_FINDINGS))
    ),
    threadId: options.threadId,
    messageId: options.messageId
  };
}

export async function readTextIfExists(filePath: string): Promise<string> {
  const fileExists = await exists(filePath);
  if (!fileExists) return "";
  return fs.readFile(filePath, "utf8");
}

export async function loadAuditContext(
  workspaceRoot: string,
  options: AuditOptions
): Promise<AuditContext> {
  const marcPath = marcDir(workspaceRoot);
  const references = await loadAuditReferences(marcPath);
  return {
    workspaceRoot,
    marcPath,
    options,
    threads: await loadThreads(marcPath, options.threadId),
    threadIds: references.threadIds,
    messageIds: references.messageIds,
    agents: await loadAgents(marcPath),
    rules: await readTextIfExists(safeJoin(marcPath, "RULES.md"))
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

async function listMarkdownFiles(root: string): Promise<string[]> {
  const rootExists = await exists(root);
  if (!rootExists) return [];

  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
}

async function loadThreads(
  marcPath: string,
  threadId?: string
): Promise<AuditThread[]> {
  const threadsRoot = safeJoin(marcPath, "threads");
  const threadsRootExists = await exists(threadsRoot);
  if (!threadsRootExists) return [];

  const entries = await fs.readdir(threadsRoot, { withFileTypes: true });
  const threadEntries = entries.filter((entry) => entry.isDirectory());
  const filteredEntries = threadId
    ? threadEntries.filter((entry) => entry.name === threadId)
    : threadEntries;
  const threads: AuditThread[] = [];

  for (const entry of filteredEntries) {
    const threadPath = safeJoin(threadsRoot, entry.name);
    const markdown = await readTextIfExists(safeJoin(threadPath, "CHAT.md"));
    const artifactNames = await listMarkdownFiles(
      safeJoin(threadPath, "artifacts")
    );
    threads.push({
      id: entry.name,
      path: threadPath,
      messages: parseMessages(markdown),
      artifactFiles: new Set(artifactNames.map((name) => `artifacts/${name}`))
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
  for (const entry of entries.filter((item) => item.isDirectory())) {
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
      markdown: await fs.readFile(safeJoin(agentsRoot, fileName), "utf8")
    });
  }

  return agents;
}

export function finding(
  findingInput: WorkspaceAuditFinding
): WorkspaceAuditFinding {
  return findingInput;
}

export function messageLocation(threadId: string, messageId: string): string {
  return `marc://$${threadId}/#${messageId}`;
}

export function threadArtifactLocation(
  threadId: string,
  artifact: string
): string {
  return `marc://$${threadId}/!${artifact.replace(/^artifacts\//, "")}`;
}

export function agentField(
  markdown: string,
  field: string
): string | undefined {
  return markdown
    .match(new RegExp(`^${field}:\\s+(.+)$`, "m"))?.[1]
    ?.replace(/^`|`$/g, "")
    .trim();
}

export function messageMatchesOptions(
  message: ChatMessage,
  context: AuditContext
): boolean {
  if (!context.options.messageId) return true;
  return message.id === context.options.messageId;
}

export function findingKey(findingItem: WorkspaceAuditFinding): string {
  return [
    findingItem.severity,
    findingItem.scope,
    findingItem.code,
    findingItem.location,
    findingItem.message
  ].join("|");
}

export function dedupeFindings(
  findings: WorkspaceAuditFinding[]
): WorkspaceAuditFinding[] {
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

export function filterFindings(
  findings: WorkspaceAuditFinding[],
  severity: WorkspaceAuditSeverity,
  maxFindings: number
): WorkspaceAuditFinding[] {
  const severityFiltered =
    severity === "all"
      ? findings
      : findings.filter((findingItem) => findingItem.severity === severity);
  return severityFiltered.slice(0, maxFindings);
}

export function summarizeFindings(
  scopes: Array<Exclude<WorkspaceAuditScope, "all">>,
  findings: WorkspaceAuditFinding[]
): {
  scopes: Array<Exclude<WorkspaceAuditScope, "all">>;
  totalFindings: number;
  critical: number;
  warning: number;
  suggestion: number;
} {
  return {
    scopes,
    totalFindings: findings.length,
    critical: findings.filter(
      (findingItem) => findingItem.severity === "critical"
    ).length,
    warning: findings.filter(
      (findingItem) => findingItem.severity === "warning"
    ).length,
    suggestion: findings.filter(
      (findingItem) => findingItem.severity === "suggestion"
    ).length
  };
}
