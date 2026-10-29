/** Group ids of the non-thread sources. A thread group is its thread id. */
export const RULES_GROUP = "@rules";
export const RULES_PATH = "RULES.md";
export const DOCUMENT_GROUP_PREFIX = "@document/";

/** Passage ids of the E1 segmentation: `<sourcePath>#<16 lowercase hex of passageSha256>`. */
export const PASSAGE_ID_PATTERN = /^(.+)#[0-9a-f]{16}$/;

/** Records keep the workspace path of their source; corpus paths start inside `.marc`. */
const MARC_PREFIX = ".marc/";

/** The group that owns a corpus file: its thread, `@rules`, or `@document/<path>`. */
export function groupIdOfSource(sourcePath: string): string {
  if (sourcePath === RULES_PATH) return RULES_GROUP;
  const parts = sourcePath.split("/");
  if (parts[0] === "threads" && parts.length > 2) return parts[1];
  return `${DOCUMENT_GROUP_PREFIX}${sourcePath}`;
}

/** The corpus path of a workspace path: `.marc/threads/...` becomes `threads/...`. */
export function corpusPathOf(sourcePath: string): string {
  if (!sourcePath.startsWith(MARC_PREFIX)) return sourcePath;
  return sourcePath.slice(MARC_PREFIX.length);
}
