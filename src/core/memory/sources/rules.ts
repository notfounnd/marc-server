import type { WorkspaceInfo } from "../../types.js";
import { safeJoin } from "../../paths.js";
import { sectionChunks } from "./chunks.js";
import { MEMORY_SOURCE_AUTHORITIES, type MemorySource } from "./contract.js";
import {
  readRegularFile,
  rootRelativePath,
  sha256Hex,
  sourceHash
} from "./files.js";
import { sectionsOrOverview } from "./sections.js";

const RULES_FILE = "RULES.md";
const RULES_TITLE = "Workspace rules";
const RULES_LEVELS = [2, 3];

// The workspace rules file. Absent rules yield no source.
export async function readRulesSources(
  info: WorkspaceInfo
): Promise<MemorySource[]> {
  const rules = await readRegularFile(
    info.rootPath,
    safeJoin(info.marcPath, RULES_FILE)
  );
  if (!rules) return [];
  const markdown = rules.bytes.toString("utf8");
  const sourcePath = rootRelativePath(info, rules.path);
  return [
    {
      sourceType: "rules",
      threadId: "@rules",
      title: RULES_TITLE,
      summaryPath: rules.path,
      relativeSummaryPath: sourcePath,
      reference: sourcePath,
      markdown,
      sourcePath,
      sourceSha256: sha256Hex(rules.bytes),
      sha256: sourceHash(markdown, RULES_TITLE),
      mtimeMs: rules.mtimeMs,
      authority: MEMORY_SOURCE_AUTHORITIES.rules,
      chunks: sectionChunks(
        "@rules:source",
        sectionsOrOverview(markdown, RULES_LEVELS)
      )
    }
  ];
}
