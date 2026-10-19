import { fencedLineFlags } from "./fences.js";
import { markdownToIndexText } from "./markdown-text.js";

export type MarkdownSection = {
  title: string;
  text: string;
  lineStart: number;
  lineEnd: number;
};

type RawSection = {
  title: string;
  lineStart: number;
  lineEnd: number;
  lines: string[];
};

const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;
const OVERVIEW_TITLE = "Overview";

// Lines are 1-based. A trailing newline does not create an extra line.
export function sourceLines(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "")
    return lines.slice(0, -1);
  return lines;
}

// Splits on headings whose level is listed in `levels`. Text before the first
// such heading is discarded. A heading with an empty title stays body text, and
// so does any heading inside a fenced block.
export function parseMarkdownSections(
  markdown: string,
  levels: readonly number[]
): MarkdownSection[] {
  const sections: RawSection[] = [];
  let current: RawSection | undefined;
  const lines = sourceLines(markdown);
  const fenced = fencedLineFlags(lines);

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const title = sectionHeading(line, fenced[index] === true, levels);
    if (title) {
      current = {
        title,
        lineStart: lineNumber,
        lineEnd: lineNumber,
        lines: []
      };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    current.lines.push(line);
    current.lineEnd = lineNumber;
  }

  return sections.map((section) => ({
    title: section.title,
    text: markdownToIndexText(section.lines.join("\n")),
    lineStart: section.lineStart,
    lineEnd: section.lineEnd
  }));
}

// Sections when any heading matches; otherwise one Overview section covering
// the whole file, unless the file has no indexable text.
export function sectionsOrOverview(
  markdown: string,
  levels: readonly number[]
): MarkdownSection[] {
  const sections = parseMarkdownSections(markdown, levels);
  if (sections.length) return sections;
  const text = markdownToIndexText(markdown);
  if (!text) return [];
  return [
    {
      title: OVERVIEW_TITLE,
      text,
      lineStart: 1,
      lineEnd: sourceLines(markdown).length
    }
  ];
}

function headingTitle(
  line: string,
  levels: readonly number[]
): string | undefined {
  const match = HEADING_PATTERN.exec(line);
  if (!match) return undefined;
  if (!levels.includes(match[1].length)) return undefined;
  return match[2].trim() || undefined;
}

function sectionHeading(
  line: string,
  isFenced: boolean,
  levels: readonly number[]
): string | undefined {
  if (isFenced) return undefined;
  return headingTitle(line, levels);
}
