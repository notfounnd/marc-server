import fs from "node:fs/promises";
import path from "node:path";
import { newId, slugify, workspaceId } from "./ids.js";
import { MESSAGE_STYLE_GUIDE, validateMessageBody } from "./guards.js";
import { marcDir, resolveWorkspace, safeJoin } from "./paths.js";
import { addArtifactToMessage, parseMessages, renderChatHeader, renderMessage } from "./markdown.js";
import { BackgroundThreadIndexReconciler, JsonThreadIndexStore, ThreadIndexReconciler, threadIndexPath } from "./thread-index.js";
import type {
  AgentListOptions,
  AgentProfile,
  AgentProfileSummary,
  AgentRegistrationResult,
  ChatMessage,
  MessageInput,
  ThreadInfo,
  ThreadInfoResult,
  ThreadListOptions,
  ThreadReadOptions,
  ThreadReadResult,
  ThreadReadSinceResult,
  ThreadTailOptions,
  ThreadTailResult,
  WorkspaceInfo,
  WorkspaceRecommendationsUpdate,
  WorkspaceStatus,
} from "./types.js";

const backgroundThreadIndexes = new Map<string, BackgroundThreadIndexReconciler>();

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath: string): Promise<string> {
  return (await exists(filePath)) ? fs.readFile(filePath, "utf8") : "";
}

const DESCRIPTION_MAX_LENGTH = 160;

function normalizeProfileToken(value: string, options: { preserveDot?: boolean } = {}): string {
  const allowed = options.preserveDot ? /[^a-z0-9.]+/g : /[^a-z0-9]+/g;
  const token = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(allowed, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return token || "item";
}

function normalizeAgentDescription(value: string): string {
  return (value.split(/\r?\n/, 1)[0] ?? "").trim().slice(0, DESCRIPTION_MAX_LENGTH);
}

function agentProfileField(markdown: string, field: string): string | undefined {
  return markdown.match(new RegExp(`^${field}:\\s+(.+)$`, "m"))?.[1]?.trim();
}

function renderAgentProfile(agentId: string, profile: AgentProfile): string {
  const description = normalizeAgentDescription(profile.description);
  if (!description) {
    throw new Error("Agent description is required.");
  }

  return [
    `# ${agentId}`,
    "",
    `ID: \`${agentId}\``,
    `Role: ${normalizeProfileToken(profile.role)}`,
    `Model: ${normalizeProfileToken(profile.model, { preserveDot: true })}`,
    `Description: ${description}`,
    "",
  ].join("\n");
}

function agentProfileManualContext(markdown: string): string {
  const descriptionMatch = /^Description:\s+.*$/m.exec(markdown);
  if (!descriptionMatch) {
    return "";
  }

  const lineEnd = descriptionMatch.index + descriptionMatch[0].length;
  const rest = markdown.slice(lineEnd);
  if (!rest.trim()) {
    return "";
  }

  return rest.replace(/^(?:\r?\n)+/, "\n");
}

function summarizeAgentProfile(id: string, markdown: string, options: AgentListOptions = {}): AgentProfileSummary {
  const summary: AgentProfileSummary = {
    id,
    role: agentProfileField(markdown, "Role"),
    model: agentProfileField(markdown, "Model"),
    description: agentProfileField(markdown, "Description"),
  };

  if (options.includeMarkdown) {
    summary.markdown = markdown;
  }

  return summary;
}

async function ensureFileContent(filePath: string, content: string): Promise<boolean> {
  const current = await readTextIfExists(filePath);

  if (current !== content) {
    await fs.writeFile(filePath, content);
    return true;
  }

  return false;
}

function threadMessageStats(messages: ChatMessage[]): {
  messageCount: number;
  lastMessageId?: string;
  updatedAt?: string;
} {
  const lastMessage = messages.at(-1);
  return {
    messageCount: messages.length,
    lastMessageId: lastMessage?.id,
    updatedAt: lastMessage?.timestamp,
  };
}

function normalizeTailLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 10;
  return Math.min(50, Math.max(1, Math.floor(limit)));
}

const CUSTOM_RULES_HEADING = "## Custom Rules";
const CUSTOM_RULES_COMMENT =
  "<!-- Keep project-specific custom rules below this line. This section is preserved by workspace_update_recommendations. -->";
const CUSTOM_RULES_STRUCTURE_COMMENT =
  "<!-- Prefer ### or deeper headings to organize project-specific rules in this section. -->";
const LEGACY_REGISTERED_AGENTS_HEADING = "### Registered Agents (Marckers)";
const AGENTS_GUIDE = [
  "- Agents should register through `agent_register` before posting.",
  "- Use `agent_list` to discover registered agents.",
  "- Check bootstrap or `agent_list` before choosing a new agent ID when an existing profile may already fit.",
  "- Use `agent_read_profile` to inspect a specific agent profile.",
];
const CONTEXT_READING_GUIDE = [
  "- Store `lastMessageId` returned by `thread_read`, `thread_tail`, or `thread_info` when continuing a thread.",
  "- Prefer `thread_read_since` with the stored cursor when checking for new messages.",
  "- If `thread_read_since` returns `shouldReadFullThread: true`, tell the user the incremental cursor failed and call `thread_read`.",
];
const OPERATIONAL_CUSTOM_RULES_GUIDE = [
  "- Write critical project-specific rules as operational checklist items under `Custom Rules`.",
  "- Prefer `Trigger`, `Do instead`, `Evidence`, and `Severity` fields when a rule must guide agent behavior at a specific moment.",
  "- Use `Trigger` to state when the rule applies.",
  "- Use `Do instead` to state the concrete action expected from the agent.",
  "- Use `Evidence` to state what the agent must leave in a plan, comment, or artifact when the rule is critical.",
  "- Use `Severity` with `critical`, `warning`, or `suggestion`.",
];
const WORKSPACE_MAINTENANCE_GUIDE = [
  "- Run `workspace_update_recommendations` before starting work on a thread.",
];
const CONVERSATION_RULES_GUIDE = [
  "- Keep messages useful, readable, and complete; link artifacts when relevant.",
  "- Prefer creating a new thread for a new task.",
];
const BOOTSTRAP_INSTRUCTIONS = [
  "# mARC Instructions",
  "",
  "<!-- This file is generated and maintained by mARC. Do not edit or extend it. Put project-specific guidance in RULES.md under Custom Rules. -->",
  "",
  "## Bootstrap Protocol",
  "",
  "- For the first mARC action in a session or workspace, call `workspace_bootstrap` before any gated tool.",
  "- After a successful bootstrap, send `bootstrapConfirmed: true` when calling gated tools.",
  "- `workspace_bootstrap` refreshes recommendations, including this managed `INSTRUCTIONS.md` file, and reads `RULES.md` for the current workspace contract.",
  "- Read `RULES.md` as the workspace behavior contract before acting on mARC thread context.",
  "- If bootstrap context was lost after compaction, resume, or subagent delegation, call `workspace_bootstrap` again.",
  "",
].join("\n");
const WORKSPACE_SKILL_PATH = ".agents/skills/marc-ops/SKILL.md";
const WORKSPACE_SKILL = [
  "---",
  "name: marc-ops",
  "description: |",
  "  Operate inside a mARC-enabled repository. Activates EVERY session in this workspace.",
  "  Before any work, call workspace_bootstrap, read RULES.md, and apply Custom Rules,",
  "  artifact metadata, marc:// references, and workspace_audit checkpoints.",
  "when_to_use: |",
  "  Use at the start of every session in a mARC workspace, after reconnecting or context loss,",
  "  and before proposing, planning, editing, posting messages, attaching artifacts, validating,",
  "  concluding, or closing mARC work.",
  "---",
  "",
  "# mARC Ops",
  "",
  "Operate inside a mARC-enabled workspace with the local workspace contract in force.",
  "",
  "This skill does not replace `RULES.md`. It turns `RULES.md`, `Custom Rules`, thread context, artifacts, and audit feedback into an execution checklist at the moments where agents commonly lose quality.",
  "",
  "Apply it silently during normal work. Surface the checklist only when the user asked for a plan, when a critical rule requires evidence, or when you need to explain a blocker.",
  "",
  "## Always Active",
  "",
  "**This skill is active for every session in this mARC workspace.**",
  "",
  "Before proposing, planning, editing, posting, validating, or closing mARC work:",
  "",
  "1. Call `workspace_bootstrap`.",
  "2. Read `RULES.md`.",
  "3. Apply relevant `Custom Rules`.",
  "4. Use mARC artifact, reference, and audit discipline.",
  "",
  "## Context of Usage",
  "",
  "Apply this workflow in these situations. These are examples, not exact prompt matches. Equivalent or connected situations also count.",
  "",
  "- Always when starting a session in a mARC workspace.",
  "- Always when resuming after compaction, reconnect, rebuild, or daemon/MCP restart.",
  "- Always when `RULES.md`, the user request, and thread state appear to conflict.",
  "- Always when the user asks to validate, audit, close, register, comment in the thread, or continue where work stopped.",
  "- Always before reading or continuing a thread.",
  "- Always before proposing a plan, design, API, tool, or behavior change.",
  "- Always before editing mARC-related code or docs.",
  "- Always before posting a message in a thread.",
  "- Always before creating, attaching, or referencing an artifact.",
  "- Always before using `marc://` for a thread, message, agent, or artifact.",
  "- Always before running audit or interpreting findings.",
  "- Always before commenting on completion or validation.",
  "- Always before closing a thread.",
  "",
  "## Required Workflow",
  "",
  "1. Call `workspace_bootstrap` before any gated mARC tool.",
  "2. Read `RULES.md` from the bootstrap response and treat it as the workspace contract.",
  "3. Read the target thread before proposing or changing anything. Use `thread_read_since` when you have a valid cursor and fall back to `thread_read` when the cursor is missing.",
  "4. Convert applicable `Custom Rules` into a short working checklist before proposing, developing, concluding, or closing.",
  "5. Leave evidence when a critical rule asks for it. Evidence can be sources read, artifacts attached, validation commands, audit output, or explicit unresolved blockers.",
  "6. Attach artifacts before referencing them in `message_post`.",
  "7. Use canonical `marc://` references for mARC assets.",
  "8. Use `workspace_audit` at checkpoints where quality matters instead of running it continuously.",
  "",
  "## Working With Rules",
  "",
  "- `RULES.md` remains the source of truth for workspace behavior.",
  "- Treat `Trigger`, `Do instead`, `Evidence`, and `Severity` fields as executable instructions.",
  "- For free-form custom rules, extract the concrete action and apply it as a checklist item.",
  "- Preserve project-specific rules in `Custom Rules`. Do not move them into generated managed sections unless the user explicitly asks.",
  "- If rules conflict, follow the more specific project rule and state the conflict in the plan or thread comment.",
  "- If a required rule cannot be satisfied, stop at the smallest useful point and state the blocker before proceeding.",
  "",
  "## Preflight Checklist",
  "",
  "Before posting a plan, proposal, design, API/tool change, or completion note, check:",
  "",
  "- Sources: the relevant README, docs, ADRs, thread context, and local rules were read when the task depends on them.",
  "- Scope: the proposed work maps to the thread problem and does not add unrelated compatibility, automation, or hidden behavior.",
  "- Rules: critical `Custom Rules` have a visible action and evidence path.",
  "- Artifacts: every artifact mentioned in a message has been attached to that message metadata.",
  "- References: mARC assets use `marc://` links when they are referenced for navigation or review.",
  "- Validation: commands or audit scopes are selected to prove the change without wasting tokens.",
  "",
  "## Message And Artifact Discipline",
  "",
  "- Keep thread messages concise and action-oriented.",
  "- Put long plans, investigation notes, or detailed designs in artifacts.",
  "- Attach the artifact first, then reference the attached path in the message.",
  "- Do not say an artifact is attached when only a plain text path was written.",
  "- Prefer incremental thread comments that say what changed, what was validated, and what remains pending.",
  "",
  "## Audit Discipline",
  "",
  "Use `workspace_audit` on demand at meaningful checkpoints:",
  "",
  "- `scope: preflight` before starting development from a plan.",
  "- `scope: artifacts` before posting messages that cite artifacts.",
  "- `scope: references` when messages include `marc://` links or project asset references.",
  "- `scope: messages` before completion or closure summaries.",
  "- `scope: all` only when the user asks for a broad quality pass or the thread state is uncertain.",
  "",
  "Keep audit calls compact with `threadId`, `messageId`, `severity`, and `maxFindings` when possible.",
  "",
  "## Practical Rule",
  "",
  "mARC content is project memory. Optimize for future agents being able to reconstruct what happened from the thread, attached artifacts, references, and validation evidence without reading the entire chat.",
  "",
].join("\n");

function buildCustomRulesSection(body = ""): string {
  const normalizedBody = body.trim();
  return [
    CUSTOM_RULES_HEADING,
    "",
    CUSTOM_RULES_COMMENT,
    CUSTOM_RULES_STRUCTURE_COMMENT,
    ...(normalizedBody ? ["", normalizedBody] : []),
  ].join("\n");
}

function buildRulesContent(customBody = ""): string {
  return [
    "# mARC Rules",
    "",
    "## Workspace Maintenance",
    "",
    ...WORKSPACE_MAINTENANCE_GUIDE,
    "",
    "## Agents",
    "",
    ...AGENTS_GUIDE,
    "",
    "## Conversation Rules",
    "",
    ...CONVERSATION_RULES_GUIDE,
    "",
    "## Message Style",
    "",
    ...MESSAGE_STYLE_GUIDE.map((line) => `- ${line}`),
    "",
    "## Context Reading",
    "",
    ...CONTEXT_READING_GUIDE,
    "",
    "## Operational Custom Rules",
    "",
    ...OPERATIONAL_CUSTOM_RULES_GUIDE,
    "",
    buildCustomRulesSection(customBody),
    "",
  ].join("\n");
}

async function ensureCustomRulesSection(filePath: string): Promise<boolean> {
  const content = await readTextIfExists(filePath);
  const next = normalizeRulesContent(content);

  if (next !== content) {
    await fs.writeFile(filePath, next);
    return true;
  }

  return false;
}

function removeLegacyAgentInventory(content: string): string {
  const escapedHeading = LEGACY_REGISTERED_AGENTS_HEADING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return content
    .replace(new RegExp(`(^|\\n)${escapedHeading}\\n[\\s\\S]*?(?=\\n#{1,6}\\s|$)`, "g"), "$1")
    .replace(/\n{3,}/g, "\n\n");
}

function splitCustomRules(content: string): { managed: string; custom: string } {
  const match = /^## Custom Rules$/m.exec(content);
  if (!match || match.index === undefined) {
    return { managed: content, custom: "" };
  }

  return {
    managed: content.slice(0, match.index),
    custom: content.slice(match.index),
  };
}

function trimBlankLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim() === "") start += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;

  return lines.slice(start, end);
}

function customRulesBody(customSection: string): string {
  if (!customSection.trim()) return "";

  const lines = customSection.split(/\r?\n/);
  const bodyLines = lines
    .slice(lines[0].trim() === CUSTOM_RULES_HEADING ? 1 : 0)
    .filter((line) => line.trim() !== CUSTOM_RULES_COMMENT)
    .filter((line) => line.trim() !== CUSTOM_RULES_STRUCTURE_COMMENT);

  return trimBlankLines(bodyLines).join("\n");
}

function extractMisplacedCustomSubsections(managedContent: string): { managed: string; blocks: string[] } {
  const blocks: string[] = [];
  const managed = managedContent.replace(/(^|\n)(#{3,6} .+\n[\s\S]*?)(?=\n#{1,6}\s|$)/g, (_match, prefix: string, block: string) => {
    blocks.push(block.trim());
    return prefix;
  }).trimEnd();

  return { managed, blocks };
}

function customSectionHeadings(body: string): Set<string> {
  return new Set([...body.matchAll(/^#{3,6} .+$/gm)].map((match) => match[0].trim()));
}

function normalizeRulesContent(content: string): string {
  const withoutLegacyAgents = removeLegacyAgentInventory(content);
  const { managed, custom } = splitCustomRules(withoutLegacyAgents);
  const { blocks } = extractMisplacedCustomSubsections(managed);
  const body = customRulesBody(custom);
  const existingHeadings = customSectionHeadings(body);
  const migratedBlocks = blocks.filter((block) => {
    const heading = block.split(/\r?\n/, 1)[0]?.trim();
    return heading && !existingHeadings.has(heading);
  });

  return buildRulesContent([...migratedBlocks, body].filter(Boolean).join("\n\n"));
}

export async function getWorkspaceInfo(workspaceRootInput?: string): Promise<WorkspaceInfo> {
  const rootPath = resolveWorkspace(workspaceRootInput);
  const name = path.basename(rootPath);
  return {
    id: workspaceId(rootPath, name),
    name,
    rootPath,
    marcPath: marcDir(rootPath),
  };
}

export async function initWorkspace(workspaceRootInput?: string): Promise<WorkspaceInfo> {
  const info = await getWorkspaceInfo(workspaceRootInput);
  const dirs = [
    info.marcPath,
    safeJoin(info.marcPath, "agents"),
    safeJoin(info.marcPath, "threads"),
    safeJoin(info.marcPath, "cache"),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  const instructionsPath = safeJoin(info.marcPath, "INSTRUCTIONS.md");
  if (!(await exists(instructionsPath))) {
    await fs.writeFile(instructionsPath, BOOTSTRAP_INSTRUCTIONS);
  }

  const rulesPath = safeJoin(info.marcPath, "RULES.md");
  if (!(await exists(rulesPath))) {
    await fs.writeFile(rulesPath, buildRulesContent());
  }

  return info;
}

export async function updateWorkspaceRecommendations(workspaceRoot: string): Promise<WorkspaceRecommendationsUpdate> {
  const info = await initWorkspace(workspaceRoot);
  const updated: string[] = [];
  const alreadyCurrent: string[] = [];

  const instructionsChanged = await ensureFileContent(safeJoin(info.marcPath, "INSTRUCTIONS.md"), BOOTSTRAP_INSTRUCTIONS);
  (instructionsChanged ? updated : alreadyCurrent).push("INSTRUCTIONS.md");

  const rulesPath = safeJoin(info.marcPath, "RULES.md");
  const rulesChanged = await ensureCustomRulesSection(rulesPath);
  (rulesChanged ? updated : alreadyCurrent).push("RULES.md");

  const skillPath = safeJoin(info.rootPath, WORKSPACE_SKILL_PATH);
  await fs.mkdir(path.dirname(skillPath), { recursive: true });
  const skillChanged = await ensureFileContent(skillPath, WORKSPACE_SKILL);
  (skillChanged ? updated : alreadyCurrent).push(WORKSPACE_SKILL_PATH);

  return { updated, alreadyCurrent };
}

export async function registerAgent(workspaceRoot: string, profile: AgentProfile): Promise<AgentRegistrationResult> {
  const info = await initWorkspace(workspaceRoot);
  const agentId = slugify(profile.id);
  const agentPath = safeJoin(info.marcPath, "agents", `${agentId}.md`);
  const alreadyExists = await exists(agentPath);
  const current = await readTextIfExists(agentPath);
  const body = `${renderAgentProfile(agentId, profile)}${agentProfileManualContext(current)}`;
  const updated = body !== current;

  if (updated) {
    await fs.writeFile(agentPath, body);
  }

  return {
    id: agentId,
    status: !alreadyExists ? "created" : updated ? "updated" : "unchanged",
    created: !alreadyExists,
    alreadyExists,
    updated: alreadyExists && updated,
  };
}

export async function createThread(workspaceRoot: string, title: string): Promise<ThreadInfo> {
  const info = await initWorkspace(workspaceRoot);
  const createdAt = new Date().toISOString();
  const id = `${slugify(title)}-${newId("thread").slice(-8)}`;
  const threadPath = safeJoin(info.marcPath, "threads", id);
  await fs.mkdir(safeJoin(threadPath, "artifacts"), { recursive: true });
  await fs.writeFile(safeJoin(threadPath, "CHAT.md"), renderChatHeader(title, id, createdAt));

  return { id, title, path: threadPath, createdAt, status: "open" };
}

export async function listThreads(workspaceRoot: string, options: ThreadListOptions = {}): Promise<ThreadInfo[]> {
  const info = await initWorkspace(workspaceRoot);
  const threadsRoot = safeJoin(info.marcPath, "threads");
  const reconciler = new ThreadIndexReconciler(threadsRoot, new JsonThreadIndexStore(threadIndexPath(info.marcPath)));
  return reconciler.list(options);
}

async function backgroundThreadIndex(workspaceRoot: string): Promise<BackgroundThreadIndexReconciler> {
  const info = await initWorkspace(workspaceRoot);
  const indexPath = threadIndexPath(info.marcPath);
  const existing = backgroundThreadIndexes.get(indexPath);
  if (existing) return existing;

  const reconciler = new BackgroundThreadIndexReconciler(
    safeJoin(info.marcPath, "threads"),
    new JsonThreadIndexStore(indexPath),
  );
  backgroundThreadIndexes.set(indexPath, reconciler);
  return reconciler;
}

export async function listThreadsCached(workspaceRoot: string, options: ThreadListOptions = {}): Promise<ThreadInfo[]> {
  return (await backgroundThreadIndex(workspaceRoot)).list(options);
}

export async function rebuildThreadIndexInBackground(workspaceRoot: string): Promise<void> {
  await (await backgroundThreadIndex(workspaceRoot)).rebuild();
}

export async function readWorkspaceStatus(workspaceRoot: string): Promise<WorkspaceStatus> {
  const index = await backgroundThreadIndex(workspaceRoot);
  let threadIndex = await index.health();
  if (threadIndex.status === "unavailable" && !threadIndex.rebuilding) {
    await index.rebuild();
    threadIndex = await index.health();
  }

  return {
    ok: threadIndex.status !== "unavailable",
    modules: {
      threadIndex,
    },
  };
}

export async function appendMessage(
  workspaceRoot: string,
  threadId: string,
  input: MessageInput,
): Promise<ChatMessage> {
  const info = await initWorkspace(workspaceRoot);
  const guard = validateMessageBody(input.body);
  if (!guard.ok) {
    throw new Error(`${guard.reason} Message style: ${MESSAGE_STYLE_GUIDE.join(" ")}`);
  }

  const chatPath = safeJoin(info.marcPath, "threads", threadId, "CHAT.md");
  if (!(await exists(chatPath))) {
    throw new Error(`Thread not found: ${threadId}`);
  }

  const message: ChatMessage = {
    id: newId("msg"),
    threadId,
    timestamp: new Date().toISOString(),
    agentId: slugify(input.agentId),
    role: input.role,
    body: input.body,
    artifacts: input.artifacts ?? [],
  };
  await fs.appendFile(chatPath, renderMessage(message));
  return message;
}

export async function readThread(
  workspaceRoot: string,
  threadId: string,
  options: ThreadReadOptions = {},
): Promise<ThreadReadResult> {
  const info = await initWorkspace(workspaceRoot);
  const chatPath = safeJoin(info.marcPath, "threads", threadId, "CHAT.md");
  const markdown = await fs.readFile(chatPath, "utf8");
  const messages = parseMessages(markdown);
  const stats = threadMessageStats(messages);
  const includeMessages = options.includeMessages ?? true;
  const includeSummary = options.includeSummary ?? true;
  const summary = includeSummary ? await readTextIfExists(safeJoin(info.marcPath, "threads", threadId, "SUMMARY.md")) : "";

  return {
    ...(options.includeMarkdown ? { markdown } : {}),
    ...(includeMessages ? { messages } : {}),
    ...(summary ? { summary } : {}),
    ...stats,
  };
}

export async function readThreadSince(
  workspaceRoot: string,
  threadId: string,
  afterMessageId: string,
): Promise<ThreadReadSinceResult> {
  const info = await initWorkspace(workspaceRoot);
  const chatPath = safeJoin(info.marcPath, "threads", threadId, "CHAT.md");
  const markdown = await fs.readFile(chatPath, "utf8");
  const messages = parseMessages(markdown);
  const stats = threadMessageStats(messages);
  const cursorIndex = messages.findIndex((message) => message.id === afterMessageId);

  if (cursorIndex === -1) {
    return {
      ok: false,
      error: "cursor_not_found",
      shouldReadFullThread: true,
      afterMessageId,
      messages: [],
      ...stats,
    };
  }

  return {
    ok: true,
    afterMessageId,
    messages: messages.slice(cursorIndex + 1),
    ...stats,
  };
}

export async function readThreadInfo(workspaceRoot: string, threadId: string): Promise<ThreadInfoResult> {
  const info = await initWorkspace(workspaceRoot);
  const chatPath = safeJoin(info.marcPath, "threads", threadId, "CHAT.md");
  const markdown = await fs.readFile(chatPath, "utf8");
  const messages = parseMessages(markdown);
  const stats = threadMessageStats(messages);
  const threads = await listThreads(workspaceRoot, { status: "all" });
  const thread = threads.find((item) => item.id === threadId);
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`);
  }

  return {
    ...thread,
    ...stats,
    updatedAt: stats.updatedAt ?? thread.createdAt,
    summaryAvailable: Boolean(thread.summaryPath),
  };
}

export async function readThreadTail(
  workspaceRoot: string,
  threadId: string,
  options: ThreadTailOptions = {},
): Promise<ThreadTailResult> {
  const info = await initWorkspace(workspaceRoot);
  const chatPath = safeJoin(info.marcPath, "threads", threadId, "CHAT.md");
  const markdown = await fs.readFile(chatPath, "utf8");
  const messages = parseMessages(markdown);
  const stats = threadMessageStats(messages);
  const limit = normalizeTailLimit(options.limit);

  return {
    messages: messages.slice(-limit),
    ...stats,
    limit,
  };
}

export async function readRules(workspaceRoot: string): Promise<string> {
  const info = await initWorkspace(workspaceRoot);
  return fs.readFile(safeJoin(info.marcPath, "RULES.md"), "utf8");
}

export async function listAgentProfiles(
  workspaceRoot: string,
  options: AgentListOptions = {},
): Promise<AgentProfileSummary[]> {
  const info = await initWorkspace(workspaceRoot);
  const agentsRoot = safeJoin(info.marcPath, "agents");
  const entries = await fs.readdir(agentsRoot, { withFileTypes: true });
  const agents = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const id = entry.name.replace(/\.md$/, "");
    const markdown = await fs.readFile(safeJoin(agentsRoot, entry.name), "utf8");
    agents.push(summarizeAgentProfile(id, markdown, options));
  }

  return agents.sort((a, b) => a.id.localeCompare(b.id));
}

export async function readAgentProfile(workspaceRoot: string, agentId: string): Promise<string> {
  const info = await initWorkspace(workspaceRoot);
  return fs.readFile(safeJoin(info.marcPath, "agents", `${slugify(agentId)}.md`), "utf8");
}

export async function attachArtifact(
  workspaceRoot: string,
  threadId: string,
  fileName: string,
  content: string,
): Promise<string> {
  const info = await initWorkspace(workspaceRoot);
  const artifactPath = safeJoin(info.marcPath, "threads", threadId, "artifacts", fileName);
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, content);
  return path.relative(safeJoin(info.marcPath, "threads", threadId), artifactPath).replace(/\\/g, "/");
}

function normalizeMarkdownArtifactFileName(fileName: string): string {
  const raw = fileName.trim().replaceAll("\\", "/");
  if (!raw) {
    throw new Error("Markdown artifact file name is required.");
  }
  if (raw.includes("/")) {
    throw new Error("Markdown artifact file name must not include folders.");
  }

  const stem = raw.toLowerCase().endsWith(".md") ? raw.slice(0, -3) : raw;
  const safeStem = stem
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 80);

  return `${safeStem || "artifact"}.md`;
}

export async function attachArtifactToMessage(
  workspaceRoot: string,
  threadId: string,
  messageId: string,
  fileName: string,
  content: string,
): Promise<string> {
  const info = await initWorkspace(workspaceRoot);
  const normalizedFileName = normalizeMarkdownArtifactFileName(fileName);
  const relativeArtifactPath = `artifacts/${normalizedFileName}`;
  const chatPath = safeJoin(info.marcPath, "threads", threadId, "CHAT.md");
  const markdown = await fs.readFile(chatPath, "utf8");
  const nextMarkdown = addArtifactToMessage(markdown, messageId, relativeArtifactPath);

  await attachArtifact(workspaceRoot, threadId, normalizedFileName, content);
  await fs.writeFile(chatPath, nextMarkdown);
  return relativeArtifactPath;
}

export async function readMessageArtifact(
  workspaceRoot: string,
  threadId: string,
  messageId: string,
  artifactFile: string,
): Promise<{ artifact: string; content: string }> {
  const info = await initWorkspace(workspaceRoot);
  const normalizedFile = artifactFile.trim().replaceAll("\\", "/");
  if (!normalizedFile || normalizedFile.includes("/")) {
    throw new Error("Artifact file name must not include folders.");
  }

  const artifact = `artifacts/${normalizedFile}`;
  const thread = await readThread(workspaceRoot, threadId);
  const message = thread.messages?.find((item) => item.id === messageId);
  if (!message) {
    throw new Error(`Message not found: ${messageId}`);
  }
  if (!message.artifacts.includes(artifact)) {
    throw new Error(`Artifact not linked to message: ${artifact}`);
  }

  return {
    artifact,
    content: await fs.readFile(safeJoin(info.marcPath, "threads", threadId, artifact), "utf8"),
  };
}
