import type { ChatMessage } from "./types.js";

const MESSAGE_START = "<!-- marc-message";
const MESSAGE_END = "<!-- /marc-message -->";

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

export function renderChatHeader(title: string, threadId: string, createdAt: string): string {
  return [
    `# ${title}`,
    "",
    `Thread: \`${threadId}\``,
    `Created: \`${createdAt}\``,
    "",
  ].join("\n");
}

export function renderMessage(message: ChatMessage): string {
  const meta = [
    MESSAGE_START,
    `id: ${escapeMeta(message.id)}`,
    `threadId: ${escapeMeta(message.threadId)}`,
    `timestamp: ${escapeMeta(message.timestamp)}`,
    `agentId: ${escapeMeta(message.agentId)}`,
    message.role ? `role: ${escapeMeta(message.role)}` : undefined,
    message.artifacts.length ? `artifacts: ${message.artifacts.map(escapeMeta).join(", ")}` : undefined,
    "-->",
  ].filter(Boolean);

  return [
    "",
    ...meta,
    "",
    message.body.trim(),
    "",
    MESSAGE_END,
    "",
  ].join("\n");
}

export function parseMessages(markdown: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const pattern = /<!-- marc-message([\s\S]*?)-->\s*([\s\S]*?)\s*<!-- \/marc-message -->/g;
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
      body: match[2].trim(),
      artifacts: meta.artifacts
        ? meta.artifacts.split(",").map((item) => item.trim()).filter(Boolean)
        : [],
    });
  }

  return messages;
}

export function addArtifactToMessage(markdown: string, messageId: string, artifact: string): string {
  let found = false;
  const pattern = /<!-- marc-message([\s\S]*?)-->\s*([\s\S]*?)\s*<!-- \/marc-message -->/g;

  const nextMarkdown = markdown.replace(pattern, (full, rawMeta: string, body: string) => {
    const meta = parseMeta(rawMeta);
    if (meta.id !== messageId) {
      return full;
    }

    found = true;
    const artifacts = meta.artifacts
      ? meta.artifacts.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
    if (!artifacts.includes(artifact)) {
      artifacts.push(artifact);
    }

    const metaLines = [
      MESSAGE_START,
      `id: ${escapeMeta(meta.id)}`,
      `threadId: ${escapeMeta(meta.threadId)}`,
      `timestamp: ${escapeMeta(meta.timestamp)}`,
      `agentId: ${escapeMeta(meta.agentId)}`,
      meta.role ? `role: ${escapeMeta(meta.role)}` : undefined,
      artifacts.length ? `artifacts: ${artifacts.map(escapeMeta).join(", ")}` : undefined,
      "-->",
    ].filter(Boolean);

    return [metaLines.join("\n"), "", body.trim(), "", MESSAGE_END].join("\n");
  });

  if (!found) {
    throw new Error(`Message not found: ${messageId}`);
  }

  return nextMarkdown;
}
