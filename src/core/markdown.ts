import type { ChatMessage } from "./types.js";

const MESSAGE_START = "<!-- marc-message";
const MESSAGE_END = "<!-- /marc-message -->";
const CYCLE_PATTERN = /^[1-9]\d*$/;

/** Header fields as raw strings, so a rebuild keeps values it cannot type. */
type HeaderFields = {
  id: string;
  threadId: string;
  timestamp: string;
  agentId: string;
  role?: string;
  stage?: string;
  cycle?: string;
  artifacts: string[];
};

function escapeMeta(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

function parseMeta(raw: string): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (match) {
      meta[match[1]] = match[2];
    }
  }
  return meta;
}

export function renderChatHeader(
  title: string,
  threadId: string,
  createdAt: string
): string {
  return [
    `# ${title}`,
    "",
    `Thread: \`${threadId}\``,
    `Created: \`${createdAt}\``,
    ""
  ].join("\n");
}

/** The one header layout every writer uses. Optional fields are omitted when absent. */
function headerLines(fields: HeaderFields): string[] {
  return [
    MESSAGE_START,
    `id: ${escapeMeta(fields.id)}`,
    `threadId: ${escapeMeta(fields.threadId)}`,
    `timestamp: ${escapeMeta(fields.timestamp)}`,
    `agentId: ${escapeMeta(fields.agentId)}`,
    fields.role ? `role: ${escapeMeta(fields.role)}` : undefined,
    fields.stage ? `stage: ${escapeMeta(fields.stage)}` : undefined,
    fields.cycle ? `cycle: ${escapeMeta(fields.cycle)}` : undefined,
    fields.artifacts.length
      ? `artifacts: ${fields.artifacts.map(escapeMeta).join(", ")}`
      : undefined,
    "-->"
  ].filter((line): line is string => Boolean(line));
}

export function renderMessage(message: ChatMessage): string {
  const meta = headerLines({
    id: message.id,
    threadId: message.threadId,
    timestamp: message.timestamp,
    agentId: message.agentId,
    role: message.role,
    stage: message.stage,
    cycle: message.cycle?.toString(),
    artifacts: message.artifacts
  });

  return ["", ...meta, "", message.body.trim(), "", MESSAGE_END, ""].join("\n");
}

/** Reads the optional block fields. A cycle that is not a positive integer is ignored. */
function optionalBlockFields(
  meta: Record<string, string>
): Pick<ChatMessage, "stage" | "cycle"> {
  return {
    ...(meta.stage ? { stage: meta.stage } : {}),
    ...(CYCLE_PATTERN.test(meta.cycle ?? "")
      ? { cycle: Number(meta.cycle) }
      : {})
  };
}

export function parseMessages(markdown: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const pattern =
    /<!-- marc-message([\s\S]*?)-->\s*([\s\S]*?)\s*<!-- \/marc-message -->/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    const meta = parseMeta(match[1]);
    if (!meta.id || !meta.threadId || !meta.timestamp || !meta.agentId) {
      continue;
    }

    messages.push({
      id: meta.id,
      threadId: meta.threadId,
      timestamp: meta.timestamp,
      agentId: meta.agentId,
      role: meta.role || undefined,
      ...optionalBlockFields(meta),
      body: match[2].trim(),
      artifacts: meta.artifacts
        ? meta.artifacts
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : []
    });
  }

  return messages;
}

export function addArtifactToMessage(
  markdown: string,
  messageId: string,
  artifact: string
): string {
  let found = false;
  const pattern =
    /<!-- marc-message([\s\S]*?)-->\s*([\s\S]*?)\s*<!-- \/marc-message -->/g;

  const nextMarkdown = markdown.replace(
    pattern,
    (full, rawMeta: string, body: string) => {
      const meta = parseMeta(rawMeta);
      if (meta.id !== messageId) {
        return full;
      }

      found = true;
      const artifacts = meta.artifacts
        ? meta.artifacts
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];
      if (!artifacts.includes(artifact)) {
        artifacts.push(artifact);
      }

      const lines = headerLines({
        id: meta.id,
        threadId: meta.threadId,
        timestamp: meta.timestamp,
        agentId: meta.agentId,
        role: meta.role,
        stage: meta.stage,
        cycle: meta.cycle,
        artifacts
      });

      return [lines.join("\n"), "", body.trim(), "", MESSAGE_END].join("\n");
    }
  );

  if (!found) {
    throw new Error(`Message not found: ${messageId}`);
  }

  return nextMarkdown;
}
