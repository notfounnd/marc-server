import assert from "node:assert/strict";
import test from "node:test";
import type { CapturedRecord } from "../scripts/memory-eval/capture-types.js";
import {
  pendingCasesOf,
  renderDeepWorksheet,
  worksheetTemplateOf
} from "../scripts/memory-eval/deep-worksheet.js";
import type {
  DeepCaseRuns,
  VariantRun
} from "../scripts/memory-eval/deep-variants.js";
import {
  allPassages,
  caseRunsOf,
  capturedRecordOf,
  okRun,
  passageIdOf,
  scopedCase,
  SCOPE_PASSAGES
} from "./memory-eval-deep-fixtures.js";

const [S1, S2, S3, S4] = SCOPE_PASSAGES.map((item) => passageIdOf(item));
const O1 = passageIdOf(allPassages()[4]!);

/** Records keyed by passageId, as the deep run keys them. */
function passageRecords(): Map<string, CapturedRecord> {
  return new Map(
    allPassages().map(
      (item) => [passageIdOf(item), capturedRecordOf(item)] as const
    )
  );
}

function runsWithBudget(): DeepCaseRuns["runs"] {
  return {
    DEEP: okRun("DEEP", [
      [S4, 0.9999],
      [S1, 0.2]
    ]),
    DEEP_ALL: okRun("DEEP_ALL", [
      [S4, 0.9999],
      [S2, 0.9],
      [S3, 0.5]
    ]),
    DEEP_COSINE: okRun("DEEP_COSINE", [
      [S1, undefined],
      [S4, undefined],
      [S2, undefined]
    ]),
    DEEP_BUDGET: okRun("DEEP_BUDGET", [[O1, 0.99]])
  };
}

test("the worksheet is the union of the first five of each variant, ungraded, in passageId order", () => {
  const evalCase = scopedCase({ passageJudgments: { [S1]: 2 } });
  const cases = pendingCasesOf(
    [caseRunsOf(evalCase, runsWithBudget())],
    passageRecords()
  );
  assert.deepEqual(
    cases[0]?.passages.map((passage) => passage.passageId),
    [S2, S3, S4, O1].sort()
  );
});

test("DEEP_BUDGET contributes its first five only when it was run", () => {
  const runs: DeepCaseRuns["runs"] = {
    ...runsWithBudget(),
    DEEP_BUDGET: undefined
  };
  const cases = pendingCasesOf(
    [caseRunsOf(scopedCase(), runs)],
    passageRecords()
  );
  assert.equal(
    cases[0]?.passages.some((passage) => passage.passageId === O1),
    false
  );
});

test("the rendered worksheet is blind: no score, no variant name and no position of a passage", () => {
  const cases = pendingCasesOf(
    [caseRunsOf(scopedCase(), runsWithBudget())],
    passageRecords()
  );
  const markdown = renderDeepWorksheet(cases);
  assert.equal(markdown.includes("DEEP"), false);
  assert.equal(/score|posi[cç][aã]o|variante|rank/i.test(markdown), false);
  assert.equal(markdown.includes("trecho dois sobre o daemon"), true);
});

test("the worksheet carries each pending passage in full, with its source and section", () => {
  const cases = pendingCasesOf(
    [caseRunsOf(scopedCase(), runsWithBudget())],
    passageRecords()
  );
  const markdown = renderDeepWorksheet(cases);
  const second = cases[0]?.passages.find((passage) => passage.passageId === S2);
  assert.equal(second?.sourcePath.startsWith("threads/"), true);
  assert.equal(markdown.includes(`### ${S2}`), true);
  assert.equal(
    markdown.includes(`Fonte: ${second?.sourcePath ?? ""}, seção: Decisao`),
    true
  );
  assert.equal(markdown.includes("trecho dois sobre o daemon"), true);
});

test("the template holds one null per pending passage, under its passage key", () => {
  const cases = pendingCasesOf(
    [caseRunsOf(scopedCase(), runsWithBudget())],
    passageRecords()
  );
  const template = worksheetTemplateOf(cases);
  const keys = Object.keys(template[scopedCase().id] ?? {});
  assert.deepEqual(
    keys,
    [S1, S2, S3, S4, O1].sort().map((id) => `passage:${id}`)
  );
  assert.equal(
    Object.values(template[scopedCase().id] ?? {}).every(
      (value) => value === null
    ),
    true
  );
});

test("a case with every passage graded leaves the worksheet empty", () => {
  const graded = scopedCase({
    passageJudgments: { [S1]: 0, [S2]: 0, [S3]: 0, [S4]: 0, [O1]: 0 }
  });
  const cases = pendingCasesOf(
    [caseRunsOf(graded, runsWithBudget())],
    passageRecords()
  );
  assert.equal(
    renderDeepWorksheet(cases).includes("Nenhum trecho pendente."),
    true
  );
  assert.deepEqual(worksheetTemplateOf(cases), {});
});

test("an incomplete variant contributes no passage to the worksheet", () => {
  const runs: DeepCaseRuns["runs"] = {
    ...runsWithBudget(),
    DEEP_ALL: {
      variant: "DEEP_ALL",
      status: "incomplete",
      reason: "missing-pair"
    } as VariantRun
  };
  const cases = pendingCasesOf(
    [caseRunsOf(scopedCase(), runs)],
    passageRecords()
  );
  assert.equal(
    cases[0]?.passages.some((passage) => passage.passageId === S3),
    false
  );
});
