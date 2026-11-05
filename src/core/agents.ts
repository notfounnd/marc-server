import fs from "node:fs/promises";
import { slugify } from "./ids.js";
import { safeJoin } from "./paths.js";
import {
  agentWriteResource,
  withWorkspaceWriteLock,
  writeFileAtomically
} from "./write-coordination.js";
import type {
  AgentListOptions,
  AgentProfile,
  AgentProfileSummary,
  AgentRegistrationResult,
  WorkspaceInfo
} from "./types.js";

const DESCRIPTION_MAX_LENGTH = 160;

export async function registerAgentInWorkspace(
  info: WorkspaceInfo,
  profile: AgentProfile
): Promise<AgentRegistrationResult> {
  const agentId = slugify(profile.id);
  return withWorkspaceWriteLock(
    info.marcPath,
    agentWriteResource(agentId),
    async () => {
      const agentPath = safeJoin(info.marcPath, "agents", `${agentId}.md`);
      const alreadyExists = await exists(agentPath);
      const current = await readTextIfExists(agentPath);
      const client = profile.client ?? clientLineOf(current);
      const rendered = renderAgentProfile(agentId, profile, client);
      const body = `${rendered}${agentProfileManualContext(current)}`;
      const updated = body !== current;

      if (updated) {
        await writeFileAtomically(agentPath, body);
      }

      return {
        id: agentId,
        status: !alreadyExists ? "created" : updated ? "updated" : "unchanged",
        created: !alreadyExists,
        alreadyExists,
        updated: alreadyExists && updated
      };
    }
  );
}

export async function listAgentProfilesInWorkspace(
  info: WorkspaceInfo,
  options: AgentListOptions = {}
): Promise<AgentProfileSummary[]> {
  const agentsRoot = safeJoin(info.marcPath, "agents");
  const entries = await fs.readdir(agentsRoot, { withFileTypes: true });
  const agents = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const id = entry.name.replace(/\.md$/, "");
    const markdown = await fs.readFile(
      safeJoin(agentsRoot, entry.name),
      "utf8"
    );
    agents.push(summarizeAgentProfile(id, markdown, options));
  }

  return agents.sort((a, b) => a.id.localeCompare(b.id));
}

export async function readAgentProfileInWorkspace(
  info: WorkspaceInfo,
  agentId: string
): Promise<string> {
  return fs.readFile(
    safeJoin(info.marcPath, "agents", `${slugify(agentId)}.md`),
    "utf8"
  );
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
  return (await exists(filePath)) ? fs.readFile(filePath, "utf8") : "";
}

function normalizeProfileToken(
  value: string,
  options: { preserveDot?: boolean } = {}
): string {
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
  return (value.split(/\r?\n/, 1)[0] ?? "")
    .trim()
    .slice(0, DESCRIPTION_MAX_LENGTH);
}

function agentProfileField(
  markdown: string,
  field: string
): string | undefined {
  return markdown.match(new RegExp(`^${field}:\\s+(.+)$`, "m"))?.[1]?.trim();
}

function renderAgentProfile(
  agentId: string,
  profile: AgentProfile,
  client: string | undefined
): string {
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
    ...clientLine(client),
    `Description: ${description}`,
    ""
  ].join("\n");
}

/** The optional `Client:` line. Absent when neither the input nor the file names a client. */
function clientLine(client: string | undefined): string[] {
  if (client === undefined) return [];
  return [`Client: ${client}`];
}

/** The header is everything before the Description line, so a `Client:` line in the manual context is never read. */
function headerOf(markdown: string): string {
  const descriptionMatch = /^Description:\s+.*$/m.exec(markdown);
  if (!descriptionMatch) return markdown;
  return markdown.slice(0, descriptionMatch.index);
}

/** The raw `Client:` value of a profile header, as the file holds it. */
export function clientLineOf(markdown: string): string | undefined {
  return agentProfileField(headerOf(markdown), "Client");
}

function agentProfileManualContext(markdown: string): string {
  const descriptionMatch = /^Description:\s+.*$/m.exec(markdown);
  if (!descriptionMatch) return "";

  const lineEnd = descriptionMatch.index + descriptionMatch[0].length;
  const rest = markdown.slice(lineEnd);
  if (!rest.trim()) return "";

  return rest.replace(/^(?:\r?\n)+/, "\n");
}

function summarizeAgentProfile(
  id: string,
  markdown: string,
  options: AgentListOptions = {}
): AgentProfileSummary {
  const summary: AgentProfileSummary = {
    id,
    role: agentProfileField(markdown, "Role"),
    model: agentProfileField(markdown, "Model"),
    description: agentProfileField(markdown, "Description")
  };

  const client = clientLineOf(markdown);
  if (client !== undefined) {
    summary.client = client;
  }

  if (options.includeMarkdown) {
    summary.markdown = markdown;
  }

  return summary;
}
