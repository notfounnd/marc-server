import fs from "node:fs/promises";
import path from "node:path";
import { newId, slugify, workspaceId } from "./ids.js";
import { MESSAGE_STYLE_GUIDE, validateMessageBody } from "./guards.js";
import { marcDir, resolveWorkspace, safeJoin } from "./paths.js";
import { addArtifactToMessage, parseMessages, renderChatHeader, renderMessage } from "./markdown.js";
import { JsonThreadIndexStore, ThreadIndexReconciler, threadIndexPath } from "./thread-index.js";
import type {
  AgentProfile,
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
} from "./types.js";

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

async function ensureSectionLines(filePath: string, heading: string, lines: string[]): Promise<boolean> {
  const content = await readTextIfExists(filePath);
  const section = `${heading}\n\n${lines.join("\n")}\n`;
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionPattern = new RegExp(`(^|\\n)${escapedHeading}\\n[\\s\\S]*?(?=\\n#{1,6}\\s|$)`);

  const next = sectionPattern.test(content)
    ? content.replace(sectionPattern, (prefix) => `${prefix.startsWith("\n") ? "\n" : ""}${section}`)
    : `${content.trimEnd()}\n\n${section}`;

  if (next !== content) {
    await fs.writeFile(filePath, next);
    return true;
  }

  return false;
}

const CUSTOM_RULES_HEADING = "## Custom Rules";
const CUSTOM_RULES_COMMENT =
  "<!-- Keep project-specific custom rules below this line. This section is preserved by workspace_update_recommendations. -->";
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

async function ensureCustomRulesSection(filePath: string): Promise<boolean> {
  const content = await readTextIfExists(filePath);
  const escapedHeading = CUSTOM_RULES_HEADING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionPattern = new RegExp(`(^|\\n)${escapedHeading}\\n([\\s\\S]*?)(?=\\n#{1,6}\\s|$)`);
  const match = sectionPattern.exec(content);

  if (!match) {
    const next = `${content.trimEnd()}\n\n${CUSTOM_RULES_HEADING}\n\n${CUSTOM_RULES_COMMENT}\n`;
    await fs.writeFile(filePath, next);
    return true;
  }

  const body = match[2]
    .split(/\r?\n/)
    .filter((line) => line.trim() !== CUSTOM_RULES_COMMENT)
    .join("\n")
    .trim();
  const section = `${CUSTOM_RULES_HEADING}\n\n${CUSTOM_RULES_COMMENT}\n${body ? `${body}\n` : ""}`;
  const remainder = `${content.slice(0, match.index)}${content.slice(match.index + match[0].length)}`.trimEnd();
  const next = `${remainder}${remainder ? "\n\n" : ""}${section}`;

  if (next !== content) {
    await fs.writeFile(filePath, next);
    return true;
  }

  return false;
}

async function replaceTextInFile(filePath: string, replacements: Array<[from: string, to: string]>): Promise<boolean> {
  const content = await readTextIfExists(filePath);
  let next = content;

  for (const [from, to] of replacements) {
    next = next.replaceAll(from, to);
  }

  if (next !== content) {
    await fs.writeFile(filePath, next);
    return true;
  }

  return false;
}

async function ensureHeadingOrder(filePath: string, orderedHeadings: string[]): Promise<boolean> {
  const content = await readTextIfExists(filePath);
  const matches = [...content.matchAll(/^## .+$/gm)];
  if (matches.length === 0 || matches[0].index === undefined) return false;

  const preamble = content.slice(0, matches[0].index).trimEnd();
  const sections = new Map<string, string>();
  const unknownHeadings: string[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? content.length;
    const heading = match[0].trim();

    sections.set(heading, content.slice(start, end).trim());
    if (!orderedHeadings.includes(heading)) {
      unknownHeadings.push(heading);
    }
  }

  const customHeading = CUSTOM_RULES_HEADING;
  const knownBeforeCustom = orderedHeadings.filter((heading) => heading !== customHeading && sections.has(heading));
  const customSection = sections.has(customHeading) ? [customHeading] : [];
  const nextSections = [...knownBeforeCustom, ...unknownHeadings, ...customSection]
    .map((heading) => sections.get(heading))
    .filter((section): section is string => section !== undefined);
  const next = `${[preamble, ...nextSections].filter(Boolean).join("\n\n")}\n`;

  if (next !== content) {
    await fs.writeFile(filePath, next);
    return true;
  }

  return false;
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
    await fs.writeFile(
      rulesPath,
      [
        "# mARC Rules",
        "",
        "## Workspace Maintenance",
        "",
        "- Run `workspace_update_recommendations` before starting work on a thread.",
        "",
        "## Agents",
        "",
        "Agents should register through `agent_register` before posting.",
        "",
        "## Conversation Rules",
        "",
        "- Keep messages useful, readable, and complete; do not remove important context just to make them shorter.",
        "- Prefer bullets or short labeled sections when summarizing multiple points.",
        "- If a plan, review, log, or analysis is long, attach it as an artifact and post a summary.",
        "- Prefer creating a new thread for a new task.",
        "",
        CUSTOM_RULES_HEADING,
        CUSTOM_RULES_COMMENT,
        "",
      ].join("\n"),
    );
  }

  return info;
}

export async function updateWorkspaceRecommendations(workspaceRoot: string): Promise<WorkspaceRecommendationsUpdate> {
  const info = await initWorkspace(workspaceRoot);
  const updated: string[] = [];
  const alreadyCurrent: string[] = [];
  const contextReadingGuide = [
    "Store `lastMessageId` returned by `thread_read`, `thread_tail`, or `thread_info` when continuing a thread.",
    "Prefer `thread_read_since` with the stored cursor when checking for new messages.",
    "If `thread_read_since` returns `shouldReadFullThread: true`, tell the user the incremental cursor failed and call `thread_read`.",
  ];
  const workspaceMaintenanceGuide = [
    "Run `workspace_update_recommendations` before starting work on a thread.",
  ];

  const instructionsChanged = await ensureFileContent(safeJoin(info.marcPath, "INSTRUCTIONS.md"), BOOTSTRAP_INSTRUCTIONS);
  (instructionsChanged ? updated : alreadyCurrent).push("INSTRUCTIONS.md");

  const rulesPath = safeJoin(info.marcPath, "RULES.md");
  const rulesStyleChanged = await ensureSectionLines(rulesPath, "## Message Style", [
    ...MESSAGE_STYLE_GUIDE.map((line) => `- ${line}`),
  ]);
  const rulesContextChanged = await ensureSectionLines(rulesPath, "## Context Reading", [
    ...contextReadingGuide.map((line) => `- ${line}`),
  ]);
  const rulesMaintenanceChanged = await ensureSectionLines(rulesPath, "## Workspace Maintenance", [
    ...workspaceMaintenanceGuide.map((line) => `- ${line}`),
  ]);
  const rulesCustomChanged = await ensureCustomRulesSection(rulesPath);
  const rulesToolNameChanged = await replaceTextInFile(rulesPath, [
    ["Agents should register through `register_agent` before posting.", "Agents should register through `agent_register` before posting."],
    [
      "- Keep messages concise and link artifacts when relevant.",
      "- Keep messages useful, readable, and complete; link artifacts when relevant.",
    ],
    [
      "- Prefer short or medium messages. Use more sentences instead of one huge paragraph.",
      "- Prefer bullets or short labeled sections when summarizing multiple points.",
    ],
  ]);
  const rulesOrderChanged = await ensureHeadingOrder(rulesPath, [
    "## Workspace Maintenance",
    "## Agents",
    "## Conversation Rules",
    "## Message Style",
    "## Context Reading",
    CUSTOM_RULES_HEADING,
  ]);
  const rulesChanged =
    rulesStyleChanged ||
    rulesContextChanged ||
    rulesMaintenanceChanged ||
    rulesCustomChanged ||
    rulesToolNameChanged ||
    rulesOrderChanged;
  (rulesChanged ? updated : alreadyCurrent).push("RULES.md");

  return { updated, alreadyCurrent };
}

export async function registerAgent(workspaceRoot: string, profile: AgentProfile): Promise<string> {
  const info = await initWorkspace(workspaceRoot);
  const agentId = slugify(profile.id);
  const agentPath = safeJoin(info.marcPath, "agents", `${agentId}.md`);
  const body = [
    `# ${profile.displayName || agentId}`,
    "",
    `ID: \`${agentId}\``,
    profile.role ? `Role: ${profile.role}` : undefined,
    profile.model ? `Model: ${profile.model}` : undefined,
    "",
    profile.notes ?? "",
    "",
  ].filter((line) => line !== undefined).join("\n");

  await fs.writeFile(agentPath, body);

  const rulesPath = safeJoin(info.marcPath, "RULES.md");
  const rules = await readTextIfExists(rulesPath);
  const marker = `- [${agentId}](agents/${agentId}.md)`;
  if (!rules.includes(marker)) {
    await fs.appendFile(rulesPath, `${marker} - ${profile.displayName || agentId}\n`);
  }

  return agentId;
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

export async function listAgentProfiles(workspaceRoot: string): Promise<Array<{ id: string; markdown: string }>> {
  const info = await initWorkspace(workspaceRoot);
  const agentsRoot = safeJoin(info.marcPath, "agents");
  const entries = await fs.readdir(agentsRoot, { withFileTypes: true });
  const agents = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    agents.push({
      id: entry.name.replace(/\.md$/, ""),
      markdown: await fs.readFile(safeJoin(agentsRoot, entry.name), "utf8"),
    });
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
