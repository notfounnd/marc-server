import fs from "node:fs/promises";
import path from "node:path";
import { addArtifactToMessage } from "./markdown.js";
import { safeJoin } from "./paths.js";
import type { ChatMessage, WorkspaceInfo } from "./types.js";

export async function attachArtifactInWorkspace(
  info: WorkspaceInfo,
  threadId: string,
  fileName: string,
  content: string
): Promise<string> {
  const artifactPath = safeJoin(
    info.marcPath,
    "threads",
    threadId,
    "artifacts",
    fileName
  );
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, content);
  return path
    .relative(safeJoin(info.marcPath, "threads", threadId), artifactPath)
    .replace(/\\/g, "/");
}

export async function attachArtifactToMessageInWorkspace(
  info: WorkspaceInfo,
  threadId: string,
  messageId: string,
  fileName: string,
  content: string
): Promise<string> {
  const normalizedFileName = normalizeMarkdownArtifactFileName(fileName);
  const relativeArtifactPath = `artifacts/${normalizedFileName}`;
  const chatPath = safeJoin(info.marcPath, "threads", threadId, "CHAT.md");
  const markdown = await fs.readFile(chatPath, "utf8");
  const nextMarkdown = addArtifactToMessage(
    markdown,
    messageId,
    relativeArtifactPath
  );

  await attachArtifactInWorkspace(info, threadId, normalizedFileName, content);
  await fs.writeFile(chatPath, nextMarkdown);
  return relativeArtifactPath;
}

export async function readMessageArtifactInWorkspace(
  info: WorkspaceInfo,
  threadId: string,
  messageId: string,
  artifactFile: string,
  messages: ChatMessage[]
): Promise<{ artifact: string; content: string }> {
  const normalizedFile = artifactFile.trim().replaceAll("\\", "/");
  if (!normalizedFile || normalizedFile.includes("/")) {
    throw new Error("Artifact file name must not include folders.");
  }

  const artifact = `artifacts/${normalizedFile}`;
  const message = messages.find((item) => item.id === messageId);
  if (!message) {
    throw new Error(`Message not found: ${messageId}`);
  }
  if (!message.artifacts.includes(artifact)) {
    throw new Error(`Artifact not linked to message: ${artifact}`);
  }

  return {
    artifact,
    content: await fs.readFile(
      safeJoin(info.marcPath, "threads", threadId, artifact),
      "utf8"
    )
  };
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
