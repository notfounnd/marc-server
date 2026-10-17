import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { computeCaptureFingerprint } from "../scripts/memory-eval/capture.js";
import {
  corpusContentDigest,
  withTemporaryWorkspace
} from "../scripts/memory-eval/corpus.js";
import {
  buildValidationCorpus,
  type PinnedCorpus
} from "../scripts/memory-eval/dataset.js";
import {
  dataset,
  FIXTURE_THREAD_IDS,
  fixtureThreadsRoot,
  REPOSITORY_ROOT,
  tempDirectory,
  THREAD_TOKEN
} from "./memory-eval-capture-fixtures.js";

const UNPINNED_THREAD = "thread-unpinned-dddd4444";

async function addClosedThread(
  threadsRoot: string,
  threadId: string
): Promise<void> {
  const directory = path.join(threadsRoot, threadId);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "SUMMARY.md"),
    `# Resumo - Fora do corpus\n\nThread: marc://$${threadId}\n\nClosed: \`2026-10-03T10:00:00.000Z\`\n`
  );
}

async function captureIdFor(threadsRoot: string): Promise<string> {
  const digest = await corpusContentDigest({
    threadsRoot,
    threadIds: FIXTURE_THREAD_IDS
  });
  const fingerprint = await computeCaptureFingerprint(
    dataset,
    REPOSITORY_ROOT,
    digest
  );
  return fingerprint.captureId;
}

test("copies only the pinned thread folders and RULES.md into the temporary workspace", async (t: TestContext) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  await addClosedThread(threadsRoot, UNPINNED_THREAD);
  const rulesPath = path.join(await tempDirectory(t), "RULES.md");
  await fs.writeFile(rulesPath, "# Rules\n");

  await withTemporaryWorkspace(
    { threadsRoot, threadIds: FIXTURE_THREAD_IDS, rulesPath },
    async (info) => {
      const copied = await fs.readdir(path.join(info.marcPath, "threads"));
      assert.deepEqual([...copied].sort(), [...FIXTURE_THREAD_IDS].sort());
      assert.equal(
        await fs.readFile(path.join(info.marcPath, "RULES.md"), "utf8"),
        "# Rules\n"
      );
    }
  );
});

test("closing an unpinned thread keeps the digest and the captureId", async (t: TestContext) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const digestBefore = await corpusContentDigest({
    threadsRoot,
    threadIds: FIXTURE_THREAD_IDS
  });
  const captureIdBefore = await captureIdFor(threadsRoot);

  await addClosedThread(threadsRoot, UNPINNED_THREAD);

  const digestAfter = await corpusContentDigest({
    threadsRoot,
    threadIds: FIXTURE_THREAD_IDS
  });
  assert.equal(digestAfter, digestBefore);
  assert.equal(await captureIdFor(threadsRoot), captureIdBefore);
});

test("a change in a pinned thread file changes the digest and the captureId", async (t: TestContext) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const digestBefore = await corpusContentDigest({
    threadsRoot,
    threadIds: FIXTURE_THREAD_IDS
  });
  const captureIdBefore = await captureIdFor(threadsRoot);

  await fs.appendFile(
    path.join(threadsRoot, THREAD_TOKEN, "SUMMARY.md"),
    "\nRevisado depois do fechamento.\n"
  );

  const digestAfter = await corpusContentDigest({
    threadsRoot,
    threadIds: FIXTURE_THREAD_IDS
  });
  assert.notEqual(digestAfter, digestBefore);
  assert.notEqual(await captureIdFor(threadsRoot), captureIdBefore);
});

test("reports a pinned thread that is missing or not closed and leaves it out of the corpus", () => {
  const pinned: PinnedCorpus = {
    schemaVersion: 1,
    corpus: "marc",
    threadIds: [THREAD_TOKEN, "thread-missing-zzzz0000"]
  };
  const closed = new Map([[THREAD_TOKEN, "# Resumo - Token\n"]]);

  const { corpus, issues } = buildValidationCorpus(pinned, closed);

  assert.deepEqual([...corpus.keys()], [THREAD_TOKEN]);
  assert.deepEqual(issues, [
    {
      rule: "pinned-thread-missing",
      caseId: "corpus",
      detail: "pinned thread thread-missing-zzzz0000 is missing or not closed"
    }
  ]);
});
