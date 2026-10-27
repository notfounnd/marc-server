import assert from "node:assert/strict";
import test from "node:test";
import {
  effectiveJudgments,
  validateDataset,
  type EvalCase,
  type EvalDataset
} from "../scripts/memory-eval/dataset.js";
import {
  cellKeyOf,
  cellOf,
  mergeJudgments
} from "../scripts/memory-eval/judgments.js";

/** A case judged in layer 0 for `t-a` and `t-b`, and in layers 1 and 2 for other groups too. */
const LAYERED: EvalCase = {
  id: "case-layered",
  family: "family-a",
  style: "layer",
  query: "zebra lantern protocol",
  queryMode: "auto",
  judgments: { "t-a": 1, "t-b": 0 },
  layerJudgments: {
    1: { "t-a": 3, "@rules": 2 },
    2: { "t-c": 2, "t-a": 1 }
  },
  evidence: [
    { sourcePath: "RULES.md", quote: "every rule is written in plain words" }
  ],
  origin: "test"
};

/** A case in the format of the approved datasets: layer 0 judgments only. */
const LAYER_ZERO_ONLY: EvalCase = {
  id: "case-layer-zero",
  family: "family-a",
  style: "direct",
  query: "zebra lantern protocol",
  queryMode: "auto",
  judgments: { "t-a": 3, "t-b": 1 },
  origin: "test"
};

const CORPUS = new Map([
  ["t-a", "summary"],
  ["t-b", "summary"],
  ["t-c", "summary"]
]);

const SOURCES = new Map([
  ["RULES.md", "every rule is written in plain words"],
  ["docs/guide.md", "the guide"],
  ["threads/t-a/artifacts/notes.md", "notes of t-a"],
  ["threads/t-a/CHAT.md", "chat of t-a"],
  ["threads/t-b/CHAT.md", "chat of t-b"],
  ["threads/t-c/CHAT.md", "chat of t-c"]
]);

function datasetOf(evalCase: EvalCase): EvalDataset {
  return { schemaVersion: 1, corpus: "marc", cases: [evalCase] };
}

/** The groups of a layer whose judgment the validation rejects. */
function rejectedGroups(
  layer: 1 | 2,
  groups: Record<string, 0 | 1 | 2 | 3>
): string[] {
  const layerJudgments = Object.fromEntries([
    [layer, groups]
  ]) as EvalCase["layerJudgments"];
  const evalCase: EvalCase = {
    ...LAYERED,
    judgments: { "t-a": 3 },
    layerJudgments,
    evidence: []
  };
  return validateDataset(datasetOf(evalCase), CORPUS, SOURCES)
    .issues.filter((issue) => issue.rule === "layer-judgment-group-missing")
    .map((issue) => issue.detail.split(" ")[1] ?? "");
}

test("at depth 0 the effective grades are the layer 0 judgments, whatever the layers hold", () => {
  assert.deepEqual(effectiveJudgments(LAYERED, 0), { "t-a": 1, "t-b": 0 });
});

test("at depth 1 each group takes the highest grade of layer 0 and layer 1; layer 2 is not read", () => {
  assert.deepEqual(effectiveJudgments(LAYERED, 1), {
    "t-a": 3,
    "t-b": 0,
    "@rules": 2
  });
});

test("at depth 2 the highest grade of layers 0, 1 and 2 counts, and a group judged only in layer 2 appears", () => {
  assert.deepEqual(effectiveJudgments(LAYERED, 2), {
    "t-a": 3,
    "t-b": 0,
    "@rules": 2,
    "t-c": 2
  });
});

test("a group judged in no layer up to the depth is absent, never graded 0", () => {
  const depthOne = effectiveJudgments(LAYERED, 1);
  assert.equal("t-c" in depthOne, false);
});

test("a dataset in the old format is read the same way at every depth", () => {
  const depths = [0, 1, 2] as const;
  const readings = depths.map((depth) =>
    effectiveJudgments(LAYER_ZERO_ONLY, depth)
  );
  assert.deepEqual(readings, [
    LAYER_ZERO_ONLY.judgments,
    LAYER_ZERO_ONLY.judgments,
    LAYER_ZERO_ONLY.judgments
  ]);
});

test("@rules is accepted in layer 1 and rejected in layer 2, since RULES.md is a layer 1 source", () => {
  assert.deepEqual(rejectedGroups(1, { "@rules": 2 }), []);
  assert.deepEqual(rejectedGroups(2, { "@rules": 2 }), ["@rules"]);
});

test("a document group is accepted when its source is in the pinned corpus, and rejected otherwise", () => {
  assert.deepEqual(rejectedGroups(1, { "@document/docs/guide.md": 2 }), []);
  assert.deepEqual(rejectedGroups(1, { "@document/docs/missing.md": 2 }), [
    "@document/docs/missing.md"
  ]);
});

test("a thread group needs its artifacts in layer 1 and its CHAT.md in layer 2", () => {
  assert.deepEqual(rejectedGroups(1, { "t-a": 2, "t-b": 2 }), ["t-b"]);
  assert.deepEqual(rejectedGroups(2, { "t-a": 2, "t-b": 2, "t-c": 2 }), []);
});

test("a group that is not a closed thread of the corpus is rejected in both layers", () => {
  assert.deepEqual(rejectedGroups(1, { "t-zzz": 2 }), ["t-zzz"]);
  assert.deepEqual(rejectedGroups(2, { "t-zzz": 2 }), ["t-zzz"]);
});

test("a cell key round-trips: layer 0 is the bare group id, layers 1 and 2 carry their layer", () => {
  const rules = { groupId: "@document/docs/guide.md", layer: 1 as const };
  assert.equal(cellKeyOf(rules), "layer1:@document/docs/guide.md");
  assert.deepEqual(cellOf(cellKeyOf(rules)), rules);
  assert.deepEqual(cellOf("t-a"), { groupId: "t-a", layer: 0 });
});

test("a merge writes a layer 1 cell into layerJudgments and keeps layer 0 untouched", () => {
  const raters = { "case-layer-zero": { "layer1:@rules": 2 } };
  const outcome = mergeJudgments({
    dataset: datasetOf(LAYER_ZERO_ONLY),
    corpus: CORPUS,
    sources: SOURCES,
    raterA: raters,
    raterB: raters
  });
  assert.deepEqual(outcome.report.issues, []);
  assert.deepEqual(outcome.report.written, [
    { caseId: "case-layer-zero", threadId: "@rules", layer: 1, grade: 2 }
  ]);
  assert.deepEqual(outcome.merged.cases[0]?.layerJudgments, {
    1: { "@rules": 2 }
  });
  assert.deepEqual(
    outcome.merged.cases[0]?.judgments,
    LAYER_ZERO_ONLY.judgments
  );
});

test("a merge that names a layer group missing from the corpus lists the issue and writes nothing invalid", () => {
  const raters = { "case-layer-zero": { "layer2:t-zzz": 2 } };
  const outcome = mergeJudgments({
    dataset: datasetOf(LAYER_ZERO_ONLY),
    corpus: CORPUS,
    sources: SOURCES,
    raterA: raters,
    raterB: raters
  });
  assert.deepEqual(
    outcome.report.issues.map((issue) => issue.rule),
    ["layer-judgment-group-missing"]
  );
});
