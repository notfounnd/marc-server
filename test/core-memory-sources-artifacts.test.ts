import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readArtifactSources } from "../src/core/memory/sources/artifact.js";
import { readRulesSources } from "../src/core/memory/sources/rules.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import { tempWorkspace, writeSummary } from "./memory-test-helpers.js";

test("artifact sources read top-level markdown of closed threads only", async () => {
  const info = await tempWorkspace();
  await writeSummary(
    info,
    "thread-art",
    closedSummary("thread-art", "Artifact thread")
  );
  await writeMarcFile(
    info,
    "threads/thread-art/artifacts/plan.md",
    "# Plan\n\n## Steps\n\nDo it."
  );
  await writeMarcFile(
    info,
    "threads/thread-art/artifacts/guide.md",
    "Plain guide text."
  );
  await writeMarcFile(
    info,
    "threads/thread-art/artifacts/notes.txt",
    "ignored"
  );
  await writeMarcFile(
    info,
    "threads/thread-art/artifacts/nested/deep.md",
    "# Deep\n## Hidden"
  );
  await writeMarcFile(
    info,
    "threads/thread-open-art/artifacts/open.md",
    "# Open"
  );

  const sources = await readArtifactSources(info);

  assert.deepEqual(sources.map((source) => source.sourcePath).sort(), [
    ".marc/threads/thread-art/artifacts/guide.md",
    ".marc/threads/thread-art/artifacts/plan.md"
  ]);
  const [guide, plan] = sources.sort((left, right) =>
    left.sourcePath.localeCompare(right.sourcePath)
  );
  assert.equal(guide?.title, "Artifact thread / guide.md");
  assert.equal(guide?.authority, "artifact");
  assert.equal(guide?.threadId, "thread-art");
  assert.equal(guide?.reference, "marc://$thread-art");
  assert.equal(guide?.relativeSummaryPath, "threads/thread-art/SUMMARY.md");
  assert.deepEqual(
    guide?.chunks.map((chunk) => [
      chunk.recordId,
      chunk.sectionTitle,
      chunk.artifactFileName,
      chunk.lineStart,
      chunk.lineEnd
    ]),
    [
      [
        "thread-art:artifact:guide.md:source:overview",
        "Overview",
        "guide.md",
        1,
        1
      ]
    ]
  );
  assert.deepEqual(
    plan?.chunks.map((chunk) => [
      chunk.recordId,
      chunk.lineStart,
      chunk.lineEnd,
      chunk.text
    ]),
    [["thread-art:artifact:plan.md:source:steps", 3, 5, "Do it."]]
  );
});

test("an artifacts directory that is a junction is not followed", async () => {
  const info = await tempWorkspace();
  const outside = await tempWorkspace();
  await writeSummary(
    info,
    "thread-link",
    closedSummary("thread-link", "Link thread")
  );
  await writeFileAt(path.join(outside.rootPath, "leak", "leak.md"), "# Leak");
  await fs.symlink(
    path.join(outside.rootPath, "leak"),
    path.join(info.marcPath, "threads", "thread-link", "artifacts"),
    "junction"
  );

  assert.deepEqual(await readArtifactSources(info), []);
});

test("rules source splits on second and third level headings with fixed identity", async () => {
  const info = await tempWorkspace();
  await writeMarcFile(
    info,
    "RULES.md",
    [
      "# Rules",
      "",
      "## Alpha",
      "",
      "alpha body",
      "",
      "### Beta",
      "",
      "beta body"
    ].join("\n")
  );

  const [rules] = await readRulesSources(info);

  assert.equal(rules?.sourceType, "rules");
  assert.equal(rules?.threadId, "@rules");
  assert.equal(rules?.title, "Workspace rules");
  assert.equal(rules?.authority, "rule");
  assert.equal(rules?.sourcePath, ".marc/RULES.md");
  assert.equal(rules?.relativeSummaryPath, ".marc/RULES.md");
  assert.equal(rules?.reference, ".marc/RULES.md");
  assert.equal(rules?.summaryPath, path.join(info.marcPath, "RULES.md"));
  assert.deepEqual(
    rules?.chunks.map((chunk) => [
      chunk.recordId,
      chunk.lineStart,
      chunk.lineEnd
    ]),
    [
      ["@rules:source:alpha", 3, 6],
      ["@rules:source:beta", 7, 9]
    ]
  );
});

test("missing RULES.md yields no rules source", async () => {
  const info = await tempWorkspace();

  assert.deepEqual(await readRulesSources(info), []);
});

function closedSummary(threadId: string, title: string): string {
  return [
    `# Summary - ${title}`,
    "",
    `Thread: \`${threadId}\``,
    "",
    "## Result",
    "",
    "Done."
  ].join("\n");
}

async function writeMarcFile(
  info: WorkspaceInfo,
  relativePath: string,
  content: string
): Promise<void> {
  await writeFileAt(
    path.join(info.marcPath, ...relativePath.split("/")),
    content
  );
}

async function writeFileAt(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}
