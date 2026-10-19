// Converts thread Markdown into the plain text that memory embeds and indexes.
// Rules run in the order listed. Each rule receives the output of the previous
// one, so fences run before inline code and line markers, images run before
// links, and emphasis runs after line markers are removed.

import {
  fencedBlocks,
  fencedBody,
  lastFencedLine,
  type FencedBlock
} from "./fences.js";

type Replacer = (match: string, ...groups: string[]) => string;
type IndexTextRule = (markdown: string) => string;

const KEPT_FENCE_LANGUAGES: ReadonlySet<string> = new Set([
  "",
  "text",
  "txt",
  "bash",
  "sh",
  "shell",
  "console"
]);

const INDEX_TEXT_RULES: readonly IndexTextRule[] = [
  // 1. HTML comments.
  replacePattern(/<!--[\s\S]*?-->/g, () => " "),
  // 2. Fenced blocks, as defined in fences.ts. Only declared prose or shell
  // languages keep their body. Delimiters never enter the text.
  replaceFencedBlocks,
  // 3. Inline code keeps its text.
  replacePattern(/`([^`\n]+)`/g, (_match, text) => text),
  // 4. Images keep their alt text.
  replacePattern(/!\[([^\]\n]*)\]\([^)\n]*\)/g, (_match, alt) => alt),
  // 5. Links keep their text and url; identical text and url collapse to one.
  replacePattern(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, linkText),
  // 6. Line markers: headings, quotes, list items, and task boxes.
  replacePattern(/^[ \t]*#{1,6}[ \t]+/gm, () => ""),
  replacePattern(/^[ \t]*(?:>[ \t]?)+/gm, () => ""),
  replacePattern(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, () => ""),
  replacePattern(/^[ \t]*\[[ xX]\][ \t]+/gm, () => ""),
  // 7. Emphasis, only when the marker is not glued to a letter or digit. The
  // negative backreference keeps runs such as "***" intact for rule 9.
  replacePattern(
    /(?<![\p{L}\p{N}])(\*\*|__|\*|_)(?=\S)(?!\1)(.+?)(?<=\S)\1(?![\p{L}\p{N}])/gu,
    (_match, _marker, content) => content
  ),
  // 8. Table separator rows are removed; cell pipes become spaces.
  replacePattern(/^(?=[ \t|:-]*\|)[ \t|:-]*-[ \t|:-]*$/gm, () => ""),
  replacePattern(/\|/g, () => " "),
  // 9. Horizontal rules made of three or more identical characters.
  replacePattern(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, () => ""),
  // 10. #, >, *, hyphens and underscores become spaces, as in E0 (E1 measurement).
  // Keeping them inside a passage changed the top thread order in case A25 and
  // pushed its eligibility below the threshold.
  replacePattern(/[#>*_-]+/g, () => " "),
  // 11. Collapse whitespace.
  replacePattern(/\s+/g, () => " ")
];

export function markdownToIndexText(markdown: string): string {
  const text = INDEX_TEXT_RULES.reduce(
    (current, rule) => rule(current),
    markdown
  );
  return text.trim();
}

function replacePattern(pattern: RegExp, replacer: Replacer): IndexTextRule {
  return (markdown) => markdown.replace(pattern, replacer);
}

// Rule 2. A fenced block becomes its body when its language is kept, and one
// space otherwise. Lines are split on "\n" only, so the fence definition in
// fences.ts sees carriage returns and handles them.
function replaceFencedBlocks(markdown: string): string {
  const lines = markdown.split("\n");
  const output: string[] = [];
  let cursor = 0;
  for (const block of fencedBlocks(lines)) {
    output.push(
      ...lines.slice(cursor, block.openLine),
      fencedText(block, lines)
    );
    cursor = lastFencedLine(block, lines.length) + 1;
  }
  output.push(...lines.slice(cursor));
  return output.join("\n");
}

function fencedText(block: FencedBlock, lines: readonly string[]): string {
  if (!KEPT_FENCE_LANGUAGES.has(block.language.toLowerCase())) return " ";
  return ` ${fencedBody(block, lines).join("\n")} `;
}

function linkText(_match: string, text: string, url: string): string {
  if (text === url) return text;
  return `${text} ${url}`;
}
