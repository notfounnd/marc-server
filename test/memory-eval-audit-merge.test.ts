import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import {
  AUDIT_SEED,
  auditCasesOf,
  auditSampleOf,
  preMergeDatasetOf,
  verifyAuditManifest,
  type AuditManifest,
  type MergeReportFile
} from "../scripts/memory-eval/audit-sample.js";
import type { CaptureFile } from "../scripts/memory-eval/capture-types.js";
import type {
  EvalDataset,
  RelevanceGrade
} from "../scripts/memory-eval/dataset.js";
import type { WorksheetRun } from "../scripts/memory-eval/judgments.js";
import {
  replayCapture,
  type ReplayResult
} from "../scripts/memory-eval/replay.js";
import { dataset } from "./memory-eval-capture-fixtures.js";
import { e3WorksheetCapture } from "./memory-eval-worksheet-fixtures.js";

const REFERENCE = ["DEPTH0", "DEPTH1", "DEPTH2"];
/** A group that the merge wrote into the judgments of case A1, with its report. */
const MERGED = "merged-group-aaaa1111";
/** A group judged after the freeze, that no merge report accounts for. */
const EXTRA = "extra-group-bbbb2222";
const GRADE: RelevanceGrade = 1;

test("a manifest frozen before a merge verifies after it, when the merge report accounts for the new cells", async (t: TestContext) => {
  const { manifest, capture, replay, runs } = await frozenManifestOf(t);
  const merged = withJudgment(dataset, "A1", MERGED, GRADE);
  const report = mergeReport([
    { caseId: "A1", threadId: MERGED, layer: 0, grade: GRADE }
  ]);

  const recomputed = auditCasesOf({
    capture,
    dataset: merged,
    report,
    replay,
    runs,
    reaches: new Map()
  });

  assert.doesNotThrow(() => verifyAuditManifest(manifest, recomputed));
  assert.equal(recomputed.length, manifest.cases.length);
});

test("a group judged after the freeze, with no record in the merge report, makes the verification refuse the manifest", async (t: TestContext) => {
  const { manifest, capture, replay, runs } = await frozenManifestOf(t);
  const judged = withJudgment(
    withJudgment(dataset, "A1", MERGED, GRADE),
    "A1",
    EXTRA,
    GRADE
  );
  const report = mergeReport([
    { caseId: "A1", threadId: MERGED, layer: 0, grade: GRADE }
  ]);

  const recomputed = auditCasesOf({
    capture,
    dataset: judged,
    report,
    replay,
    runs,
    reaches: new Map()
  });

  assert.throws(
    () => verifyAuditManifest(manifest, recomputed),
    /universe of case A1 changed/
  );
});

test("a merge report that is not a clean append cannot rebuild the judgments from before the merge", () => {
  const report: MergeReportFile = {
    written: [],
    alreadyPresent: 1,
    conflicts: []
  };
  assert.throws(() => preMergeDatasetOf(dataset, report), /not a clean append/);
});

/**
 * The manifest of the fixture, frozen before the merge: the universe of each case is read from the
 * judgments of before the merge, which is the fixture dataset itself.
 */
async function frozenManifestOf(t: TestContext): Promise<{
  manifest: AuditManifest;
  capture: CaptureFile;
  replay: ReplayResult;
  runs: WorksheetRun[];
}> {
  const { capture, vectors } = await e3WorksheetCapture(t);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: ["M0", "D0", ...REFERENCE],
    vectors
  });
  const runs: WorksheetRun[] = [{ replay, variants: REFERENCE }];
  const cases = auditCasesOf({
    capture,
    dataset,
    report: mergeReport([]),
    replay,
    runs,
    reaches: new Map()
  });
  return {
    manifest: auditSampleOf({
      seed: AUDIT_SEED,
      corpus: "marc",
      captureId: "fixture",
      cases
    }),
    capture,
    replay,
    runs
  };
}

function mergeReport(written: MergeReportFile["written"]): MergeReportFile {
  return { written, alreadyPresent: 0, conflicts: [] };
}

function withJudgment(
  source: EvalDataset,
  caseId: string,
  threadId: string,
  value: RelevanceGrade
): EvalDataset {
  return {
    ...source,
    cases: source.cases.map((evalCase) =>
      evalCase.id === caseId
        ? {
            ...evalCase,
            judgments: { ...evalCase.judgments, [threadId]: value }
          }
        : evalCase
    )
  };
}
