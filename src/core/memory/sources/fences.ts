// The one definition of a fenced block. Section segmentation and index-text
// normalization both read it, so they agree on which lines are code.
//
// A fence opens with three or more backticks or tildes, indented up to three
// spaces. A backtick fence cannot have a backtick in its info string. It closes
// with the same character, in a run at least as long as the opening run, and
// nothing else on the line. A fence that never closes runs to the end of the
// text, as in CommonMark. A trailing carriage return is ignored.

export type FencedBlock = {
  openLine: number;
  closeLine: number | undefined;
  language: string;
};

type OpenFence = FencedBlock & { character: string; length: number };

const FENCE_OPENING = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSING = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const LANGUAGE = /^[ \t]*([^\s`]*)/;

// Zero-based line indexes. Lines must not include the newline character.
export function fencedBlocks(lines: readonly string[]): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  let open: OpenFence | undefined;
  for (const [index, line] of lines.entries()) {
    if (open === undefined) {
      open = openingFence(line, index);
      continue;
    }
    if (closesFence(open, line)) {
      blocks.push(blockOf(open, index));
      open = undefined;
    }
  }
  if (open !== undefined) blocks.push(blockOf(open, undefined));
  return blocks;
}

// Marks every line that belongs to a fenced block, delimiters included.
export function fencedLineFlags(lines: readonly string[]): boolean[] {
  const flags = lines.map(() => false);
  for (const block of fencedBlocks(lines)) {
    flags.fill(true, block.openLine, lastFencedLine(block, lines.length) + 1);
  }
  return flags;
}

// The body lines of a block, without its delimiters.
export function fencedBody(
  block: FencedBlock,
  lines: readonly string[]
): string[] {
  return lines.slice(block.openLine + 1, block.closeLine ?? lines.length);
}

// The last line of a block: its closing line, or the end of the text.
export function lastFencedLine(block: FencedBlock, lineCount: number): number {
  return block.closeLine ?? lineCount - 1;
}

function openingFence(line: string, openLine: number): OpenFence | undefined {
  const match = FENCE_OPENING.exec(withoutCarriageReturn(line));
  if (!match) return undefined;
  const run = match[1]!;
  const info = match[2]!;
  if (run.startsWith("`") && info.includes("`")) return undefined;
  return {
    openLine,
    closeLine: undefined,
    language: LANGUAGE.exec(info)?.[1] ?? "",
    character: run[0]!,
    length: run.length
  };
}

function closesFence(open: OpenFence, line: string): boolean {
  const match = FENCE_CLOSING.exec(withoutCarriageReturn(line));
  if (!match) return false;
  const run = match[1]!;
  return run[0] === open.character && run.length >= open.length;
}

function blockOf(open: OpenFence, closeLine: number | undefined): FencedBlock {
  return {
    openLine: open.openLine,
    closeLine,
    language: open.language
  };
}

function withoutCarriageReturn(line: string): string {
  return line.replace(/\r$/, "");
}
