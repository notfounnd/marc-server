import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  validateDataset,
  type EvalDataset,
  type PinnedCorpus
} from "../scripts/memory-eval/dataset.js";
import { CORPORA, validationCorpus } from "../scripts/memory-eval/cli.js";

test("the ledgerline-en cases validate against their pinned corpus and fixture sources, as the validate command does", async () => {
  const datasetPath = fileURLToPath(
    new URL(
      "../scripts/memory-eval/datasets/ledgerline-en.json",
      import.meta.url
    )
  );
  const pinnedPath = fileURLToPath(
    new URL(
      "../scripts/memory-eval/datasets/ledgerline-en.corpus.json",
      import.meta.url
    )
  );
  const dataset = JSON.parse(
    await fs.readFile(datasetPath, "utf8")
  ) as EvalDataset;
  const pinned = JSON.parse(
    await fs.readFile(pinnedPath, "utf8")
  ) as PinnedCorpus;
  // The same validation corpus and sources as the validate command, so that the test cannot diverge from it.
  const ledgerline = CORPORA.get("ledgerline-en");
  assert.ok(ledgerline !== undefined);
  const {
    corpus,
    issues: pinnedIssues,
    sources
  } = await validationCorpus(ledgerline);
  assert.equal(dataset.cases.length, 79);
  assert.equal(corpus.size, pinned.threadIds.length);
  assert.deepEqual(pinnedIssues, []);
  assert.deepEqual(validateDataset(dataset, corpus, sources).issues, []);
});
