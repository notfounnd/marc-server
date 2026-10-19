import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import {
  buildReport,
  DECISION_METRICS,
  renderMarkdown,
  REPORT_VARIANTS,
  reportFileNames,
  type Report
} from "../scripts/memory-eval/report.js";
import { replayCapture } from "../scripts/memory-eval/replay.js";
import { PRODUCTION_RECALL_ID } from "../scripts/memory-eval/variants.js";
import {
  createFakes,
  fixtureThreadsRoot,
  measureFixtureLatency,
  readCaptureFile,
  runCapture,
  tempDirectory
} from "./memory-eval-capture-fixtures.js";
import { judgedDataset } from "./memory-eval-judged-fixtures.js";

async function reportFor(t: TestContext) {
  const threadsRoot = await fixtureThreadsRoot(t);
  const outputRoot = await tempDirectory(t);
  const fakes = createFakes();
  const captured = await runCapture({ threadsRoot, outputRoot, fakes });
  const latency = await measureFixtureLatency({
    threadsRoot,
    outputRoot,
    fakes
  });
  const capture = await readCaptureFile(captured.result.captureDir);
  const replay = await replayCapture({
    capture,
    dataset: judgedDataset,
    variantIds: [...REPORT_VARIANTS, PRODUCTION_RECALL_ID]
  });
  return {
    capture,
    report: await buildReport({
      capture,
      dataset: judgedDataset,
      replay,
      latency
    })
  };
}

test("report carries the identification, the equivalence and complete verdicts", async (t: TestContext) => {
  const { capture, report } = await reportFor(t);

  assert.equal(report.captureId, capture.captureId);
  assert.equal(report.corpusDigest, capture.corpusDigest);
  assert.equal(report.queryFingerprint, capture.fingerprint.queryFingerprint);
  assert.equal(report.equivalence.status, "passed");
  assert.equal(report.variants.M0?.status, "complete");
  assert.equal(report.variants.D0?.status, "complete");
  assert.equal(report.variants.ORACLE_ADMISSION?.status, "complete");
  assert.equal(report.corpusSize.threads, 3);
  assert.ok(report.latency);
  assert.equal(report.latency.samples, 9);
});

test("a report without latency says so and takes its own file names", async (t: TestContext) => {
  const threadsRoot = await fixtureThreadsRoot(t);
  const captured = await runCapture({
    threadsRoot,
    outputRoot: await tempDirectory(t),
    fakes: createFakes()
  });
  const capture = await readCaptureFile(captured.result.captureDir);
  const replay = await replayCapture({
    capture,
    dataset: judgedDataset,
    variantIds: [...REPORT_VARIANTS, PRODUCTION_RECALL_ID]
  });
  const report = await buildReport({ capture, dataset: judgedDataset, replay });
  const markdown = renderMarkdown(report);

  assert.equal(report.latency, null);
  assert.match(markdown, /^Latency: not measured$/m);
  assert.doesNotMatch(markdown, /Measured at/);
  assert.deepEqual(reportFileNames(true), {
    json: "report-no-latency.json",
    markdown: "report-no-latency.md"
  });
  assert.deepEqual(reportFileNames(false), {
    json: "report.json",
    markdown: "report.md"
  });
});

test("report counts one attribution row per grade 3 thread of a positive case", async (t: TestContext) => {
  const { report } = await reportFor(t);

  const total = Object.values(report.attribution.counts).reduce(
    (sum, count) => sum + count,
    0
  );
  assert.equal(report.attribution.rows.length, 3);
  assert.equal(total, 3);
  const oracle = report.attribution.oracleTop1Total;
  assert.ok(oracle !== null && oracle >= 0 && oracle <= 1);
});

test("the markdown names the capture and the corpus digest", async (t: TestContext) => {
  const { capture, report } = await reportFor(t);

  const markdown = renderMarkdown(report);
  assert.ok(markdown.includes(capture.captureId));
  assert.ok(markdown.includes(capture.corpusDigest));
  assert.ok(markdown.includes("## Comparisons against M0"));
  assert.ok(markdown.includes("## M0 vs PRODUCTION_RECALL"));
  assert.equal(report.productionRecall.rows.length, DECISION_METRICS.length);
});

test("the markdown shows each provider's model and version, and the McNemar cell of each row", async (t: TestContext) => {
  const { report } = await reportFor(t);
  const declared: Report = {
    ...report,
    providers: {
      embedding: {
        ...report.providers.embedding,
        model: "declared-embedding",
        version: "declared-1"
      },
      reranker: {
        ...report.providers.reranker,
        model: "declared-reranker",
        version: "declared-2"
      },
      interpreter: {
        ...report.providers.interpreter,
        model: "declared-interpreter",
        version: "declared-3"
      }
    },
    comparisons: [
      {
        candidate: "D0",
        rows: [
          {
            scope: "total",
            metric: "top1Target",
            baseline: 0.67,
            candidate: 0.94,
            difference: 0.27,
            lower: 0.2,
            upper: 0.34,
            margin: 0.05,
            term: "melhora",
            nonInferior: true,
            mcnemar: { b: 1, c: 9, p: 0.0214 }
          },
          {
            scope: "total",
            metric: "mrr",
            baseline: 0.5,
            candidate: 0.5,
            difference: 0,
            lower: -0.01,
            upper: 0.01,
            margin: 0.03,
            term: "não inferior",
            nonInferior: true
          }
        ]
      }
    ]
  };

  const markdown = renderMarkdown(declared);
  assert.ok(
    markdown.includes("| embedding | declared-embedding (version declared-1) |")
  );
  assert.ok(
    markdown.includes("| reranker | declared-reranker (version declared-2) |")
  );
  assert.ok(
    markdown.includes(
      "| interpreter | declared-interpreter (version declared-3) |"
    )
  );
  assert.ok(markdown.includes("McNemar (b/c, p)"));
  assert.ok(markdown.includes("| 1/9, 2.14e-2 |"));
  const mrrLine = markdown
    .split("\n")
    .find((line) => line.includes("| total | mrr |"));
  assert.equal(mrrLine?.endsWith("| — |"), true);
});
