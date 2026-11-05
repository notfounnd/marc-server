/** One row of the operating system's process table: only the two identifiers the parent walk needs. */
export type ProcessRow = { pid: number; ppid: number };

/** The table as it was read: its rows, or the reason it could not be read. */
export type ProcessTableRead =
  | { status: "available"; rows: ProcessRow[] }
  | { status: "unavailable"; reason: string };

/** How many parents the waiter's identity check climbs. */
export const ANCESTOR_LEVELS = 8;

/**
 * Parses `pid ppid` lines. One malformed line makes the whole table unreadable: a partial table cannot
 * prove that an ancestor is missing, so it cannot prove an absence either.
 */
export function parseProcessRows(output: string): ProcessTableRead {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return unavailable("empty_output");
  const rows = lines.map(rowOfLine);
  if (rows.some((row) => row === undefined)) {
    return unavailable("invalid_output");
  }
  return { status: "available", rows: rows as ProcessRow[] };
}

/**
 * The parents of a pid, nearest first, up to `levels`. A missing link, a non-positive parent or a repeated
 * parent ends the chain, so a cycle in a damaged table cannot loop.
 */
export function ancestorsOf(
  rows: readonly ProcessRow[],
  pid: number,
  levels: number = ANCESTOR_LEVELS
): number[] {
  const parents = new Map(rows.map((row) => [row.pid, row.ppid]));
  return climb(parents, pid, levels, []);
}

export function hasPid(rows: readonly ProcessRow[], pid: number): boolean {
  return rows.some((row) => row.pid === pid);
}

function climb(
  parents: ReadonlyMap<number, number>,
  pid: number,
  levels: number,
  chain: number[]
): number[] {
  const parent = parents.get(pid);
  if (levels === 0 || parent === undefined) return chain;
  if (parent <= 0 || chain.includes(parent)) return chain;
  return climb(parents, parent, levels - 1, [...chain, parent]);
}

function rowOfLine(line: string): ProcessRow | undefined {
  const parts = line.split(/\s+/);
  if (parts.length !== 2) return undefined;
  const pid = Number(parts[0]);
  const ppid = Number(parts[1]);
  if (!Number.isInteger(pid) || !Number.isInteger(ppid)) return undefined;
  return { pid, ppid };
}

function unavailable(reason: string): ProcessTableRead {
  return { status: "unavailable", reason };
}
