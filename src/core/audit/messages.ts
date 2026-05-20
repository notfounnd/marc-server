import type { WorkspaceAuditFinding } from "../types.js";
import type { AuditContext } from "./support.js";

const FENCED_MARKDOWN_CODE_PATTERN = /```[\s\S]*?```/g;
const INLINE_MARKDOWN_CODE_PATTERN = /`([^`\n]+)`/g;
const MARC_REFERENCE_PATTERN = /marc:\/\/[^\s)]+/g;

export async function auditMessages(
  _context: AuditContext
): Promise<WorkspaceAuditFinding[]> {
  return [];
}

export function removeFencedMarkdownCode(content: string): string {
  return content.replace(FENCED_MARKDOWN_CODE_PATTERN, "");
}

export function removeMarkdownCode(content: string): string {
  return removeFencedMarkdownCode(content).replace(
    INLINE_MARKDOWN_CODE_PATTERN,
    ""
  );
}

function normalizeReference(reference: string): string {
  return reference.replace(/[.,;:!?`]+$/, "");
}

function referencesInText(content: string): string[] {
  return [...content.matchAll(MARC_REFERENCE_PATTERN)].map((match) =>
    normalizeReference(match[0])
  );
}

export function messageReferences(body: string): string[] {
  return referencesInText(removeMarkdownCode(body));
}

export function inlineCodeReferences(body: string): string[] {
  return [
    ...removeFencedMarkdownCode(body).matchAll(INLINE_MARKDOWN_CODE_PATTERN)
  ]
    .map((match) => referencesInText(match[1]))
    .flat();
}
