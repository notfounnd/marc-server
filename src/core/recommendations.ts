import fs from "node:fs/promises";
import path from "node:path";
import { MESSAGE_STYLE_GUIDE } from "./guards.js";
import { WORKSPACE_SKILL } from "./marc-ops-skill.js";
import { safeJoin } from "./paths.js";
import type { WorkspaceInfo, WorkspaceRecommendationsUpdate } from "./types.js";

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
  "- Use `agent_read_profile` to inspect a specific agent profile."
];
const CONTEXT_READING_GUIDE = [
  "- Store `lastMessageId` returned by `thread_read`, `thread_tail`, or `thread_info` when continuing a thread.",
  "- Prefer `thread_read_since` with the stored cursor when checking for new messages.",
  "- If the user provides a specific mARC source, read that source before broad workspace investigation.",
  "- If `thread_read_since` returns `shouldReadFullThread: true`, tell the user the incremental cursor failed and call `thread_read`.",
  "- Avoid repeating bootstrap as a ritual before each mARC action; reuse the current workspace contract while it remains known."
];
const OPERATIONAL_CUSTOM_RULES_GUIDE = [
  "- Write critical project-specific rules as operational checklist items under `Custom Rules`.",
  "- Prefer `Trigger`, `Do instead`, `Evidence`, and `Severity` fields when a rule must guide agent behavior at a specific moment.",
  "- Use `Trigger` to state when the rule applies.",
  "- Use `Do instead` to state the concrete action expected from the agent.",
  "- Use `Evidence` to state what the agent must leave in a plan, comment, or artifact when the rule is critical.",
  "- Use `Severity` with `critical`, `warning`, or `suggestion`."
];
const WORKSPACE_MAINTENANCE_GUIDE = [
  "- Run `workspace_update_recommendations` before starting work on a thread."
];
const CONVERSATION_RULES_GUIDE = [
  "- Keep messages useful, readable, and complete; link artifacts when relevant.",
  "- Prefer creating a new thread for a new task."
];
const WORKSPACE_SKILL_PATH = ".agents/skills/marc-ops/SKILL.md";

export const BOOTSTRAP_INSTRUCTIONS = [
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
  "- Reuse the current workspace contract while it remains known; do not repeat bootstrap as a ritual before each mARC action.",
  "- If bootstrap context was lost after compaction, resume, or subagent delegation, call `workspace_bootstrap` again.",
  ""
].join("\n");

export function buildRulesContent(customBody = ""): string {
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
    ""
  ].join("\n");
}

export async function applyWorkspaceRecommendations(
  info: WorkspaceInfo
): Promise<WorkspaceRecommendationsUpdate> {
  const updated: string[] = [];
  const alreadyCurrent: string[] = [];
  const instructionsChanged = await ensureFileContent(
    safeJoin(info.marcPath, "INSTRUCTIONS.md"),
    BOOTSTRAP_INSTRUCTIONS
  );
  (instructionsChanged ? updated : alreadyCurrent).push("INSTRUCTIONS.md");

  const rulesChanged = await ensureCustomRulesSection(
    safeJoin(info.marcPath, "RULES.md")
  );
  (rulesChanged ? updated : alreadyCurrent).push("RULES.md");

  const skillPath = safeJoin(info.rootPath, WORKSPACE_SKILL_PATH);
  await fs.mkdir(path.dirname(skillPath), { recursive: true });
  const skillChanged = await ensureFileContent(skillPath, WORKSPACE_SKILL);
  (skillChanged ? updated : alreadyCurrent).push(WORKSPACE_SKILL_PATH);

  return { updated, alreadyCurrent };
}

function buildCustomRulesSection(body = ""): string {
  const normalizedBody = body.trim();
  return [
    CUSTOM_RULES_HEADING,
    "",
    CUSTOM_RULES_COMMENT,
    CUSTOM_RULES_STRUCTURE_COMMENT,
    ...(normalizedBody ? ["", normalizedBody] : [])
  ].join("\n");
}

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function ensureFileContent(
  filePath: string,
  content: string
): Promise<boolean> {
  const current = await readTextIfExists(filePath);
  if (current === content) return false;
  await fs.writeFile(filePath, content);
  return true;
}

async function ensureCustomRulesSection(filePath: string): Promise<boolean> {
  const content = await readTextIfExists(filePath);
  const next = normalizeRulesContent(content);
  if (next === content) return false;
  await fs.writeFile(filePath, next);
  return true;
}

function removeLegacyAgentInventory(content: string): string {
  const escapedHeading = LEGACY_REGISTERED_AGENTS_HEADING.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
  return content
    .replace(
      new RegExp(
        `(^|\\n)${escapedHeading}\\n[\\s\\S]*?(?=\\n#{1,6}\\s|$)`,
        "g"
      ),
      "$1"
    )
    .replace(/\n{3,}/g, "\n\n");
}

function splitCustomRules(content: string): {
  managed: string;
  custom: string;
} {
  const match = /^## Custom Rules$/m.exec(content);
  if (!match || match.index === undefined)
    return { managed: content, custom: "" };

  return {
    managed: content.slice(0, match.index),
    custom: content.slice(match.index)
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

function extractMisplacedCustomSubsections(managedContent: string): {
  managed: string;
  blocks: string[];
} {
  const blocks: string[] = [];
  const managed = managedContent
    .replace(
      /(^|\n)(#{3,6} .+\n[\s\S]*?)(?=\n#{1,6}\s|$)/g,
      (_match, prefix: string, block: string) => {
        blocks.push(block.trim());
        return prefix;
      }
    )
    .trimEnd();

  return { managed, blocks };
}

function customSectionHeadings(body: string): Set<string> {
  return new Set(
    [...body.matchAll(/^#{3,6} .+$/gm)].map((match) => match[0].trim())
  );
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

  return buildRulesContent(
    [...migratedBlocks, body].filter(Boolean).join("\n\n")
  );
}
