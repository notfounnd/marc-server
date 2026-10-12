import type { ExistingSummary } from "./thread-summary-paths.js";

export type ParsedSummary = {
  closedAt: string;
  body: string;
};

export type ParsedSummaryResult =
  | { ok: true; summary: ParsedSummary }
  | { ok: false };

export function renderSummary(
  title: string,
  reference: string,
  body: string,
  closedAt: string
): string {
  return [
    `# ${title}`,
    "",
    `Thread: ${reference}`,
    "",
    `Closed: \`${closedAt}\``,
    "",
    "---",
    "",
    body,
    ""
  ].join("\n");
}

export function parseExistingSummary(
  existing: ExistingSummary,
  threadId: string
): ParsedSummaryResult {
  const lines = existing.markdown.replace(/\r\n?/g, "\n").split("\n");
  const boundary = findSummaryBodyStart(lines);
  const headerLines = lines.slice(0, boundary.headerEnd);
  const threadLines = headerLines.filter((line) => /^Thread:\s*/.test(line));
  if (threadLines.length > 1) return { ok: false };
  const rawReference = threadLines[0]?.replace(/^Thread:\s*/, "").trim();
  if (rawReference && !matchesThreadReference(rawReference, threadId)) {
    return { ok: false };
  }
  if (threadLines.length === 1 && !rawReference) return { ok: false };
  const closedLines = headerLines.filter((line) => /^Closed:\s*/.test(line));
  if (closedLines.length > 1) return { ok: false };
  const hasClosedValue = closedLines.length === 1;
  const closedValue = closedLines[0]?.replace(/^Closed:\s*/, "").trim();
  const closedAt = hasClosedValue
    ? parseUtcIsoDate(unwrapInlineCode(closedValue ?? ""))
    : existing.mtime.toISOString();
  if (!closedAt) return { ok: false };
  return {
    ok: true,
    summary: {
      closedAt,
      body: normalizeSummaryBody(lines.slice(boundary.bodyStart).join("\n"))
    }
  };
}

export function parseChatTitle(markdown: string): string | undefined {
  const firstLine = markdown.split(/\r?\n/, 1)[0] ?? "";
  return /^#\s+(.+)$/.exec(firstLine)?.[1]?.trim() || undefined;
}

export function parseChatThreadId(markdown: string): string | undefined {
  const header = markdown.split(/\r?\n/).slice(0, 5).join("\n");
  const value = /^Thread:\s+(.+)$/m.exec(header)?.[1]?.trim();
  if (!value) return undefined;
  const thread = unwrapInlineCode(value);
  const reference = /^marc:\/\/\$([^\s`]+)$/.exec(thread)?.[1];
  return reference ?? thread;
}

function findSummaryBodyStart(lines: string[]): {
  bodyStart: number;
  headerEnd: number;
} {
  const hasHeading = /^#\s+.+$/.test(lines[0] ?? "");
  let index = hasHeading ? 1 : 0;
  let sawMetadata = false;
  while (index < lines.length && !lines[index]!.trim()) index += 1;
  while (index < lines.length) {
    if ((hasHeading || sawMetadata) && lines[index]!.trim() === "---") {
      return { bodyStart: index + 1, headerEnd: index };
    }
    if (!/^(?:Thread|Closed):\s*/.test(lines[index]!)) break;
    sawMetadata = true;
    index += 1;
    while (index < lines.length && !lines[index]!.trim()) index += 1;
  }
  return { bodyStart: index, headerEnd: index };
}

function matchesThreadReference(value: string, threadId: string): boolean {
  const reference = unwrapInlineCode(value.trim());
  return [threadId, `$${threadId}`, `marc://$${threadId}`].includes(reference);
}

function parseUtcIsoDate(value: string): string | undefined {
  const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,3}))?Z$/.exec(
    value
  );
  if (!match) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const canonical = date.toISOString();
  if (canonical.slice(0, 19) !== match[1]) return undefined;
  const expectedMilliseconds = Number((match[2] ?? "").padEnd(3, "0"));
  if (Number(canonical.slice(20, 23)) !== expectedMilliseconds)
    return undefined;
  return value;
}

function unwrapInlineCode(value: string): string {
  return /^`.*`$/.test(value) ? value.slice(1, -1) : value;
}

export function normalizeSummaryBody(body: string): string {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && lines[0]!.trim() === "") lines.shift();
  while (lines.length && lines.at(-1)!.trim() === "") lines.pop();
  return lines.join("\n");
}
