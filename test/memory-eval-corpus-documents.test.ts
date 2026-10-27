import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  configuredDocumentsOf,
  corpusContentDigest,
  corpusSourceTexts,
  type CorpusSource
} from "../scripts/memory-eval/corpus.js";

/** A pinned corpus with one thread, RULES.md and one configured document. */
async function corpusRoot(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "memory-eval-documents-")
  );
  await fs.mkdir(path.join(root, "threads", "t1"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.writeFile(
    path.join(root, "threads", "t1", "SUMMARY.md"),
    "# Summary\n"
  );
  await fs.writeFile(path.join(root, "RULES.md"), "# Rules\n");
  await fs.writeFile(path.join(root, "docs", "guide.md"), "# Guide\n");
  return root;
}

function sourceOf(
  root: string,
  documents?: CorpusSource["documents"]
): CorpusSource {
  return {
    threadsRoot: path.join(root, "threads"),
    threadIds: ["t1"],
    rulesPath: path.join(root, "RULES.md"),
    documents
  };
}

const GUIDE = {
  relativePath: "docs/guide.md",
  absolutePath: "",
  authority: "reference"
};

test("a configured document changes the digest; no document leaves the digest as it was", async () => {
  const root = await corpusRoot();
  const guide = { ...GUIDE, absolutePath: path.join(root, "docs", "guide.md") };
  const without = await corpusContentDigest(sourceOf(root));
  const withEmpty = await corpusContentDigest(sourceOf(root, []));
  const withGuide = await corpusContentDigest(sourceOf(root, [guide]));
  assert.equal(withEmpty, without);
  assert.notEqual(withGuide, without);
});

test("editing a configured document changes the digest", async () => {
  const root = await corpusRoot();
  const guide = { ...GUIDE, absolutePath: path.join(root, "docs", "guide.md") };
  const before = await corpusContentDigest(sourceOf(root, [guide]));
  await fs.writeFile(path.join(root, "docs", "guide.md"), "# Guide, revised\n");
  const after = await corpusContentDigest(sourceOf(root, [guide]));
  assert.notEqual(after, before);
});

test("the corpus texts are keyed by corpus path, documents included", async () => {
  const root = await corpusRoot();
  const guide = { ...GUIDE, absolutePath: path.join(root, "docs", "guide.md") };
  const texts = await corpusSourceTexts(sourceOf(root, [guide]));
  assert.equal(texts.get("docs/guide.md"), "# Guide\n");
  assert.equal(texts.get("RULES.md"), "# Rules\n");
  assert.equal(texts.get("threads/t1/SUMMARY.md"), "# Summary\n");
});

type DocumentEntry = { path: string; authority: string };

type DocumentsScenario = {
  name: string;
  entries: DocumentEntry[];
  expected: Array<[string, string]>;
};

/** Each scenario reads memory.documentSources of the workspace settings with the production reader. */
const DOCUMENTS_SCENARIOS: DocumentsScenario[] = [
  {
    name: "a file entry is read with its authority",
    entries: [{ path: "docs/guide.md", authority: "reference" }],
    expected: [["docs/guide.md", "reference"]]
  },
  {
    name: "a directory entry is expanded as the production reader does",
    entries: [{ path: "docs", authority: "reference" }],
    expected: [["docs/guide.md", "reference"]]
  },
  {
    name: "a normative entry keeps the normative name of the settings",
    entries: [{ path: "RULES.md", authority: "normative" }],
    expected: [["RULES.md", "normative"]]
  },
  {
    name: "a missing entry yields no document",
    entries: [{ path: "docs/missing.md", authority: "reference" }],
    expected: []
  }
];

async function writeSettings(
  root: string,
  entries: DocumentEntry[]
): Promise<void> {
  await fs.mkdir(path.join(root, ".marc"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".marc", "marc.config.json"),
    JSON.stringify({ memory: { documentSources: entries } })
  );
}

for (const scenario of DOCUMENTS_SCENARIOS) {
  test(`configured documents: ${scenario.name}`, async () => {
    const root = await corpusRoot();
    await writeSettings(root, scenario.entries);
    const documents = await configuredDocumentsOf({ repositoryRoot: root });
    assert.deepEqual(
      documents.map((item) => [item.relativePath, item.authority]),
      scenario.expected
    );
  });
}

test("reading configured documents creates no workspace folders in the repository", async () => {
  const root = await corpusRoot();
  await writeSettings(root, [
    { path: "docs/guide.md", authority: "reference" }
  ]);
  await configuredDocumentsOf({ repositoryRoot: root });
  await assert.rejects(fs.access(path.join(root, ".marc", "agents")));
});
