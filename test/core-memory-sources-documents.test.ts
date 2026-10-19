import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readDocumentSources } from "../src/core/memory/sources/document.js";
import type {
  WorkspaceDocumentSource,
  WorkspaceInfo,
  WorkspaceSettings
} from "../src/core/types.js";
import { tempWorkspace } from "./memory-test-helpers.js";

type DocumentScenario = {
  name: string;
  setup: (info: WorkspaceInfo, outside: WorkspaceInfo) => Promise<void>;
  entry: WorkspaceDocumentSource;
  expected: string[];
};

const READER_SCENARIOS: DocumentScenario[] = [
  {
    name: "a missing path yields no source",
    setup: async () => {},
    entry: { path: "missing.md", authority: "reference" },
    expected: []
  },
  {
    name: "a file without the .md extension yields no source",
    setup: (info) => writeAt(info, "notes.txt", "# Notes"),
    entry: { path: "notes.txt", authority: "reference" },
    expected: []
  },
  {
    name: "a markdown file yields one source",
    setup: (info) => writeAt(info, "docs/guide.md", "# Guide"),
    entry: { path: "docs/guide.md", authority: "reference" },
    expected: ["docs/guide.md"]
  },
  {
    name: "a symlinked root yields no source",
    setup: (info, outside) => linkDirectory(info, outside, "linked"),
    entry: { path: "linked", authority: "reference" },
    expected: []
  },
  {
    name: "a file reached through a linked ancestor yields no source",
    setup: (info, outside) => linkDirectory(info, outside, "linked"),
    entry: { path: "linked/leak.md", authority: "reference" },
    expected: []
  },
  {
    name: "a directory reached through a linked ancestor yields no source",
    setup: (info, outside) =>
      linkDirectoryWithFile(info, outside, "linked", "sub/x.md"),
    entry: { path: "linked/sub", authority: "reference" },
    expected: []
  },
  {
    name: "a directory reads only markdown files at any depth up to four",
    setup: async (info) => {
      await writeAt(info, "docs/a.md", "# A");
      await writeAt(info, "docs/b.txt", "text");
      await writeAt(info, "docs/sub/c.md", "# C");
    },
    entry: { path: "docs", authority: "reference" },
    expected: ["docs/a.md", "docs/sub/c.md"]
  },
  {
    name: "a file four segments below the source root is included",
    setup: (info) => writeAt(info, "docs/l1/l2/l3/d.md", "# D"),
    entry: { path: "docs", authority: "reference" },
    expected: ["docs/l1/l2/l3/d.md"]
  },
  {
    name: "a file five segments below the source root is excluded",
    setup: async (info) => {
      await writeAt(info, "docs/l1/l2/l3/l4/e.md", "# E");
      await writeAt(info, "docs/a.md", "# A");
    },
    entry: { path: "docs", authority: "reference" },
    expected: ["docs/a.md"]
  },
  {
    name: "a junction inside the source is not followed",
    setup: async (info, outside) => {
      await writeAt(info, "docs/a.md", "# A");
      await linkDirectory(info, outside, "docs/linked");
    },
    entry: { path: "docs", authority: "reference" },
    expected: ["docs/a.md"]
  },
  {
    name: "the .marc directory inside a source is skipped",
    setup: async (info) => {
      await writeAt(info, "docs/a.md", "# A");
      await writeAt(info, "docs/.marc/x.md", "# X");
    },
    entry: { path: "docs", authority: "reference" },
    expected: ["docs/a.md"]
  },
  {
    name: "a path that escapes the workspace yields no source",
    setup: async () => {},
    entry: { path: "../outside.md", authority: "normative" },
    expected: []
  }
];

const AUTHORITY_SCENARIOS: Array<{
  authority: WorkspaceDocumentSource["authority"];
  expected: string;
}> = [
  { authority: "normative", expected: "rule" },
  { authority: "reference", expected: "document" }
];

for (const scenario of READER_SCENARIOS) {
  test(`document reader: ${scenario.name}`, async () => {
    const info = await tempWorkspace();
    const outside = await tempWorkspace();
    await scenario.setup(info, outside);

    const sources = await readDocumentSources(
      info,
      settingsFor([scenario.entry])
    );

    assert.deepEqual(
      sources.map((source) => source.sourcePath).sort(),
      [...scenario.expected].sort()
    );
  });
}

for (const scenario of AUTHORITY_SCENARIOS) {
  test(`document authority is ${scenario.expected} for ${scenario.authority} entries`, async () => {
    const info = await tempWorkspace();
    await writeAt(info, "docs/policy.md", "# Policy");

    const [source] = await readDocumentSources(
      info,
      settingsFor([{ path: "docs/policy.md", authority: scenario.authority }])
    );

    assert.equal(source?.authority, scenario.expected);
  });
}

test("document sources use the @document id, the heading title, and file-name fallback", async () => {
  const info = await tempWorkspace();
  await writeAt(
    info,
    "docs/titled.md",
    "intro\n# Real Title\n\n## Part\n\nbody"
  );
  await writeAt(info, "docs/plain.md", "no heading here");

  const sources = await readDocumentSources(
    info,
    settingsFor([
      { path: "docs/titled.md", authority: "reference" },
      { path: "docs/plain.md", authority: "reference" }
    ])
  );
  const titled = sources.find(
    (source) => source.sourcePath === "docs/titled.md"
  );
  const plain = sources.find((source) => source.sourcePath === "docs/plain.md");

  assert.equal(titled?.threadId, "@document/docs/titled.md");
  assert.equal(titled?.title, "Real Title");
  assert.equal(titled?.reference, "docs/titled.md");
  assert.equal(titled?.relativeSummaryPath, "docs/titled.md");
  assert.equal(
    titled?.summaryPath,
    path.join(info.rootPath, "docs", "titled.md")
  );
  assert.deepEqual(
    titled?.chunks.map((chunk) => [
      chunk.recordId,
      chunk.lineStart,
      chunk.lineEnd
    ]),
    [["@document/docs/titled.md:source:part", 4, 6]]
  );
  assert.equal(plain?.title, "plain.md");
});

test("a directory source keeps at most 200 files in lexicographic order", async () => {
  const info = await tempWorkspace();
  for (let index = 0; index < 205; index += 1) {
    await writeAt(info, `docs/f${String(index).padStart(3, "0")}.md`, "# F");
  }

  const sources = await readDocumentSources(
    info,
    settingsFor([{ path: "docs", authority: "reference" }])
  );
  const names = sources
    .map((source) => path.basename(source.sourcePath))
    .sort();

  assert.equal(sources.length, 200);
  assert.equal(names[0], "f000.md");
  assert.equal(names[199], "f199.md");
});

test("the same file listed twice yields one source with the first authority", async () => {
  const info = await tempWorkspace();
  await writeAt(info, "docs/shared.md", "# Shared");

  const sources = await readDocumentSources(
    info,
    settingsFor([
      { path: "docs/shared.md", authority: "normative" },
      { path: "docs/shared.md", authority: "reference" }
    ])
  );

  assert.equal(sources.length, 1);
  assert.equal(sources[0]?.authority, "rule");
});

function settingsFor(
  documentSources: WorkspaceDocumentSource[]
): WorkspaceSettings {
  return {
    memory: {
      autoRebuild: true,
      embeddingBatchSize: 4,
      searchRetryDepth: 0,
      documentSources
    }
  };
}

async function writeAt(
  info: WorkspaceInfo,
  relativePath: string,
  content: string
): Promise<void> {
  const filePath = path.join(info.rootPath, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function linkDirectoryWithFile(
  info: WorkspaceInfo,
  outside: WorkspaceInfo,
  relativeLink: string,
  fileRelativePath: string
): Promise<void> {
  const linkPath = path.join(info.rootPath, ...relativeLink.split("/"));
  const targetPath = path.join(outside.rootPath, "leak");
  const filePath = path.join(targetPath, ...fileRelativePath.split("/"));
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, "# Leak");
  await fs.mkdir(path.dirname(linkPath), { recursive: true });
  await fs.symlink(targetPath, linkPath, "junction");
}

async function linkDirectory(
  info: WorkspaceInfo,
  outside: WorkspaceInfo,
  relativeLink: string
): Promise<void> {
  const linkPath = path.join(info.rootPath, ...relativeLink.split("/"));
  const targetPath = path.join(outside.rootPath, "leak");
  await fs.mkdir(targetPath, { recursive: true });
  await fs.writeFile(path.join(targetPath, "leak.md"), "# Leak");
  await fs.mkdir(path.dirname(linkPath), { recursive: true });
  await fs.symlink(targetPath, linkPath, "junction");
}
