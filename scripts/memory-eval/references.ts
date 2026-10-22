import fs from "node:fs/promises";
import path from "node:path";
import { parseMarcReference } from "../../src/core/marc-references.js";

/** Thread, message and artifact references as they appear in raw Markdown. */
const REFERENCE_PATTERN =
  /marc:\/\/\$[A-Za-z0-9._-]+(?:\/#[A-Za-z0-9._-]+(?:\/![A-Za-z0-9._-]+)?)?/g;

/** Files of a thread that may cite other threads. Read raw: a slug's hyphens would become spaces after normalization. */
const REFERENCE_FILES = ["SUMMARY.md", "CHAT.md"] as const;

/** The thread ids cited in a raw Markdown text, in order of appearance. */
export function threadReferencesIn(markdown: string): string[] {
  const matches = markdown.match(REFERENCE_PATTERN) ?? [];
  return matches.flatMap((match) => {
    const threadId = threadIdOfReference(match.replace(/\.+$/, ""));
    if (threadId === undefined) return [];
    return [threadId];
  });
}

function threadIdOfReference(value: string): string | undefined {
  const reference = parseMarcReference(value);
  if (reference === undefined) return undefined;
  if (reference.type === "agent") return undefined;
  return reference.threadId;
}

/**
 * Directed references between the pinned threads: a pair [from, to] when a raw
 * SUMMARY.md or CHAT.md of `from` cites `to`. Self references and references to
 * threads outside the pinned set are left out. Sorted, without duplicates.
 */
export async function threadReferenceEdges(
  threadsRoot: string,
  threadIds: readonly string[]
): Promise<Array<[from: string, to: string]>> {
  const pinned = new Set(threadIds);
  const edges = await Promise.all(
    threadIds.map(async (threadId) => {
      const texts = await Promise.all(
        REFERENCE_FILES.map((name) =>
          readOptional(path.join(threadsRoot, threadId, name))
        )
      );
      return texts.flatMap((text) => {
        if (text === undefined) return [];
        return threadReferencesIn(text)
          .filter((target) => target !== threadId && pinned.has(target))
          .map((target): [string, string] => [threadId, target]);
      });
    })
  );
  return uniqueEdges(edges.flat());
}

async function readOptional(filePath: string): Promise<string | undefined> {
  return fs.readFile(filePath, "utf8").catch(() => undefined);
}

function uniqueEdges(edges: Array<[string, string]>): Array<[string, string]> {
  const keys = new Map(edges.map((edge) => [edge.join("\0"), edge] as const));
  return [...keys.entries()]
    .sort(([left], [right]) => (left < right ? -1 : Number(left > right)))
    .map(([, edge]) => edge);
}
