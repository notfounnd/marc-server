import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  captureMemoryEval,
  type CaptureOptions
} from "../scripts/memory-eval/capture.js";
import type { EvalCase, EvalDataset } from "../scripts/memory-eval/dataset.js";
import {
  deepReportOf,
  loadDeepInputs,
  runDeepCases,
  runDeepReport,
  writeDeepReport,
  type DeepReport
} from "../scripts/memory-eval/deep-run.js";
import { writeDeepWorksheet } from "../scripts/memory-eval/deep-worksheet.js";
import { serializeDataset } from "../scripts/memory-eval/judgments.js";
import {
  createFakes,
  FIXTURE_THREAD_IDS,
  fixtureThreadsRoot,
  REPOSITORY_ROOT,
  tempDirectory,
  THREAD_TOKEN
} from "./memory-eval-capture-fixtures.js";

const QUOTE = "Rotacionar o token do daemon periodicamente com seguranca";
const SUMMARY = `threads/${THREAD_TOKEN}/SUMMARY.md`;
const BUDGET = 2;

/** Two deep cases over the fixture corpus: one unscoped, one scoped to the thread that holds the quote. */
function deepDataset(): EvalDataset {
  const unscoped: EvalCase = {
    id: "E-unscoped",
    family: "token",
    style: "deep",
    query: "rotacionar token do daemon",
    queryMode: "auto",
    judgments: {},
    evidence: [{ sourcePath: SUMMARY, quote: QUOTE }],
    origin: "fixture"
  };
  const scoped: EvalCase = {
    ...unscoped,
    id: "E-scoped",
    scope: { threadId: THREAD_TOKEN }
  };
  return { schemaVersion: 1, corpus: "marc-deep", cases: [unscoped, scoped] };
}

/** Each pending passage of the template receives grade 2, so every case has a relevant passage in its first five. */
function judgedDataset(
  dataset: EvalDataset,
  template: Record<string, Record<string, null>>
): EvalDataset {
  return {
    ...dataset,
    cases: dataset.cases.map((evalCase) => ({
      ...evalCase,
      passageJudgments: Object.fromEntries(
        Object.keys(template[evalCase.id] ?? {}).map(
          (key) => [key.slice("passage:".length), 2] as const
        )
      )
    }))
  };
}

test("a deep run over a capture: the worksheet grades the pending passages, and the report is then complete", async (t) => {
  const outputRoot = await tempDirectory(t);
  const dataset = deepDataset();
  const fakes = createFakes();
  const captured = await captureMemoryEval({
    dataset,
    source: {
      threadsRoot: await fixtureThreadsRoot(t),
      threadIds: FIXTURE_THREAD_IDS
    },
    outputRoot,
    repositoryRoot: REPOSITORY_ROOT,
    createProviders: () => fakes.providers,
    resume: false,
    log: () => undefined,
    syntheticQueries: false,
    kMax: 0
  } satisfies CaptureOptions);
  const captureDir = captured.captureDir;
  const datasetPath = path.join(outputRoot, "marc-deep.json");
  await fs.writeFile(datasetPath, serializeDataset(dataset));

  const inputs = await loadDeepInputs({ datasetPath, captureDir });
  const before: DeepReport = await runDeepReport(inputs, BUDGET);
  assert.equal(before.protocol.protocolIncomplete, true);
  assert.equal(
    before.protocol.reasons.some((reason) =>
      reason.includes("deep cases are 2")
    ),
    true
  );
  assert.equal(before.gate.applied, false);
  assert.equal(
    before.cases.every((item) => item.incomplete),
    true
  );

  const pending = await writeDeepWorksheet({
    inputs,
    captureDir,
    deepBudget: BUDGET
  });
  assert.ok(pending > 0);
  const worksheet = await fs.readFile(
    path.join(captureDir, "deep-worksheet.md"),
    "utf8"
  );
  assert.equal(worksheet.includes("DEEP"), false);
  const template = JSON.parse(
    await fs.readFile(
      path.join(captureDir, "deep-worksheet-template.json"),
      "utf8"
    )
  ) as Record<string, Record<string, null>>;
  await fs.writeFile(
    datasetPath,
    serializeDataset(judgedDataset(dataset, template))
  );

  const after = await runDeepReport(
    await loadDeepInputs({ datasetPath, captureDir }),
    BUDGET
  );
  assert.equal(
    after.cases.some((item) => item.incomplete),
    false
  );
  assert.equal(after.summary.success.DEEP, 2);
  assert.equal(after.summary.scopeConformAdopted, true);
  assert.equal(after.adoptedVariant, "DEEP_BUDGET");
  assert.equal(after.gate.successAdopted, 2);
  assert.equal(
    after.cases.every((item) => item.variants.DEEP_BUDGET?.status === "ok"),
    true
  );

  const capture = JSON.parse(
    await fs.readFile(path.join(captureDir, "capture.json"), "utf8")
  ) as {
    records: Array<{ kind: string; threadId: string }>;
  };
  const threadPassages = capture.records.filter(
    (record) => record.kind === "passage" && record.threadId === THREAD_TOKEN
  );
  const scopedCase = after.cases.find((item) => item.id === "E-scoped");
  assert.equal(scopedCase?.scopePassages, threadPassages.length);

  const [jsonPath, markdownPath] = await writeDeepReport(captureDir, after);
  assert.equal(
    JSON.parse(await fs.readFile(jsonPath!, "utf8")).captureId,
    captured.captureId
  );
  assert.equal(
    (await fs.readFile(markdownPath!, "utf8")).includes("## Gate"),
    true
  );
});

test("runDeepReport is deepReportOf over runDeepCases on the same capture", async (t) => {
  const outputRoot = await tempDirectory(t);
  const dataset = deepDataset();
  const fakes = createFakes();
  const captured = await captureMemoryEval({
    dataset,
    source: {
      threadsRoot: await fixtureThreadsRoot(t),
      threadIds: FIXTURE_THREAD_IDS
    },
    outputRoot,
    repositoryRoot: REPOSITORY_ROOT,
    createProviders: () => fakes.providers,
    resume: false,
    log: () => undefined,
    syntheticQueries: false,
    kMax: 0
  } satisfies CaptureOptions);
  const datasetPath = path.join(outputRoot, "marc-deep.json");
  await fs.writeFile(datasetPath, serializeDataset(dataset));
  const inputs = await loadDeepInputs({
    datasetPath,
    captureDir: captured.captureDir
  });
  const delegated = await runDeepReport(inputs, BUDGET);
  const direct = deepReportOf(
    await runDeepCases(inputs, BUDGET),
    inputs.evidence,
    BUDGET,
    inputs.capture.captureId
  );
  assert.deepEqual(delegated, direct);
  assert.equal(delegated.adoptedVariant, "DEEP_BUDGET");
});
