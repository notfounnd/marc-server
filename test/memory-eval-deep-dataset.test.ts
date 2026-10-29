import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import type { MemorySourceType } from "../src/core/memory/sources/contract.js";
import {
  fingerprintOf,
  queryFingerprintCases,
  sha256Json
} from "../scripts/memory-eval/capture-fingerprint.js";
import {
  validateDataset,
  type EvalCase,
  type EvalDataset,
  type ValidationRule
} from "../scripts/memory-eval/dataset.js";
import {
  cellKeyOf,
  gradeOfCell,
  mergeJudgments,
  serializeDataset
} from "../scripts/memory-eval/judgments.js";
import {
  OTHER_SOURCE_TEXT,
  OTHER_SUMMARY,
  passageIdOf,
  SCOPE_PASSAGES,
  SCOPE_QUOTE,
  SCOPE_SOURCE_TEXT,
  SCOPE_SUMMARY,
  SCOPE_THREAD,
  scopedCase
} from "./memory-eval-deep-fixtures.js";

const CORPUS = new Map([[SCOPE_THREAD, "closed summary"]]);
const SOURCES = new Map([
  [SCOPE_SUMMARY, SCOPE_SOURCE_TEXT],
  [OTHER_SUMMARY, OTHER_SOURCE_TEXT]
]);
const FIXTURE = new URL(
  "./fixtures/memory-eval/capture-ids-e3.json",
  import.meta.url
);
const DATASETS = new URL("../scripts/memory-eval/datasets/", import.meta.url);
const P1 = passageIdOf(SCOPE_PASSAGES[0]!);
const P2 = passageIdOf(SCOPE_PASSAGES[1]!);

type Stored = {
  corpus: string;
  captureId: string;
  components: Parameters<typeof fingerprintOf>[0];
  fingerprint: string;
};

function issuesOf(cases: EvalCase[]): ValidationRule[] {
  const dataset: EvalDataset = { schemaVersion: 1, corpus: "marc-deep", cases };
  return validateDataset(dataset, CORPUS, SOURCES).issues.map(
    (issue) => issue.rule
  );
}

test("a valid deep case, with passage keys in the workspace form, has no issue", () => {
  assert.deepEqual(
    issuesOf([scopedCase({ passageJudgments: { [P1]: 2, [P2]: 0 } })]),
    []
  );
});

test("the deep rules reject each malformed scope, grade, key and source, one by one", () => {
  const cases: Array<[ValidationRule, EvalCase]> = [
    [
      "scope-only-deep",
      scopedCase({ style: "direct", evidence: undefined, judgments: {} })
    ],
    [
      "scope-thread-not-closed",
      scopedCase({ scope: { threadId: "thread-open-dddd4444" } })
    ],
    [
      "scope-source-types-invalid",
      scopedCase({ scope: { threadId: SCOPE_THREAD, sourceTypes: ["rules"] } })
    ],
    [
      "scope-source-types-invalid",
      scopedCase({ scope: { sourceTypes: ["video" as MemorySourceType] } })
    ],
    ["scope-source-types-invalid", scopedCase({ scope: { sourceTypes: [] } })],
    [
      "deep-evidence-outside-scope",
      scopedCase({
        evidence: [
          {
            sourcePath: OTHER_SUMMARY,
            quote: "texto sem relacao com a rotacao"
          }
        ]
      })
    ],
    [
      "passage-grade-out-of-range",
      scopedCase({
        passageJudgments: { [P1]: 4 } as unknown as Record<string, 0>
      })
    ],
    [
      "passage-judgment-key-invalid",
      scopedCase({ passageJudgments: { "not-a-passage": 1 } })
    ],
    [
      "passage-judgment-unknown-source",
      scopedCase({
        passageJudgments: {
          "threads/thread-missing/SUMMARY.md#00000000000000c1": 1
        }
      })
    ],
    ["missing-evidence", scopedCase({ evidence: undefined })]
  ];
  const reported = cases.map(([rule, evalCase]) => ({
    rule,
    found: issuesOf([evalCase]).includes(rule)
  }));
  assert.deepEqual(
    reported.filter((item) => !item.found),
    []
  );
});

test("a deep case is exempt from the missing grade 3 rule, and the scope sourceTypes are allowed without a thread", () => {
  const withoutThread = scopedCase({ scope: { sourceTypes: ["chat"] } });
  assert.deepEqual(issuesOf([withoutThread]), []);
});

test("a case without scope keeps the query fingerprint it had, and a scope joins it", () => {
  const plain = queryFingerprintCases([
    scopedCase({ scope: undefined })
  ])[0] as Record<string, unknown>;
  const scoped = queryFingerprintCases([scopedCase()])[0] as Record<
    string,
    unknown
  >;
  assert.equal("scope" in plain, false);
  assert.equal("scope" in scoped, true);
});

test("the stored E3 captures of marc and ledgerline-en recompute their captureIds from their components", async () => {
  const stored = JSON.parse(await fs.readFile(FIXTURE, "utf8")) as Stored[];
  const recomputed = stored.map((entry) => fingerprintOf(entry.components));
  assert.deepEqual(
    recomputed.map((item) => item.captureId),
    stored.map((entry) => entry.captureId)
  );
  assert.deepEqual(
    recomputed.map((item) => item.fingerprint),
    stored.map((entry) => entry.fingerprint)
  );
});

test("the datasets of marc and ledgerline-en, without scope, reproduce the stored query fingerprints", async () => {
  const stored = JSON.parse(await fs.readFile(FIXTURE, "utf8")) as Stored[];
  const marc = JSON.parse(
    await fs.readFile(new URL("marc.json", DATASETS), "utf8")
  ) as EvalDataset;
  const ledgerline = JSON.parse(
    await fs.readFile(new URL("ledgerline-en.json", DATASETS), "utf8")
  ) as EvalDataset;
  assert.equal(
    sha256Json(queryFingerprintCases(marc.cases)),
    stored[0]!.components.queryFingerprint
  );
  assert.equal(
    sha256Json(queryFingerprintCases(ledgerline.cases)),
    stored[1]!.components.queryFingerprint
  );
});

test("kMax joins the captureId only when it differs from the E3 default of 30", async () => {
  const [entry] = JSON.parse(await fs.readFile(FIXTURE, "utf8")) as Stored[];
  const components = entry!.components;
  assert.equal(
    fingerprintOf({ ...components, kMax: 30 }).captureId,
    entry!.captureId
  );
  assert.notEqual(
    fingerprintOf({ ...components, kMax: 0 }).captureId,
    entry!.captureId
  );
});

test("serializeDataset writes marc.json and ledgerline-en.json byte for byte as they are", async () => {
  const names = ["marc.json", "ledgerline-en.json"];
  const texts = await Promise.all(
    names.map((name) => fs.readFile(new URL(name, DATASETS), "utf8"))
  );
  const parsed = texts.map((text) =>
    serializeDataset(JSON.parse(text) as EvalDataset)
  );
  assert.deepEqual(parsed, texts);
});

test("the passage key round-trips, and a merge writes the passage grades that two raters agree on", () => {
  const dataset: EvalDataset = {
    schemaVersion: 1,
    corpus: "marc-deep",
    cases: [scopedCase()]
  };
  const id = scopedCase().id;
  const outcome = mergeJudgments({
    dataset,
    corpus: CORPUS,
    sources: SOURCES,
    raterA: {
      [id]: {
        [cellKeyOf({ passageId: P1 })]: 2,
        [cellKeyOf({ passageId: P2 })]: 3
      }
    },
    raterB: {
      [id]: {
        [cellKeyOf({ passageId: P1 })]: 2,
        [cellKeyOf({ passageId: P2 })]: 1
      }
    },
    consensus: { [id]: { [cellKeyOf({ passageId: P2 })]: 3 } },
    passageIds: new Set([P1, P2])
  });
  assert.equal(cellKeyOf({ passageId: P1 }), `passage:${P1}`);
  assert.deepEqual(outcome.merged.cases[0]?.passageJudgments, {
    [P1]: 2,
    [P2]: 3
  });
  assert.equal(gradeOfCell(outcome.merged.cases[0]!, { passageId: P2 }), 3);
  assert.equal(outcome.report.issues.length, 0);
  assert.equal(outcome.report.passages?.pairs, 2);
  assert.equal(outcome.report.passages?.written.length, 2);
  assert.equal(outcome.report.pairs, 0);
});

test("a merge refuses a passage key whose passage the capture does not hold", () => {
  const dataset: EvalDataset = {
    schemaVersion: 1,
    corpus: "marc-deep",
    cases: [scopedCase()]
  };
  const id = scopedCase().id;
  assert.throws(
    () =>
      mergeJudgments({
        dataset,
        corpus: CORPUS,
        sources: SOURCES,
        raterA: { [id]: { [cellKeyOf({ passageId: P1 })]: 2 } },
        raterB: { [id]: { [cellKeyOf({ passageId: P1 })]: 2 } },
        passageIds: new Set([P2])
      }),
    /is not in the capture/
  );
});

test("the scope quote is cited from the scope thread alone: the evidence of the case is unchanged by the scope", () => {
  const evidence = scopedCase().evidence ?? [];
  assert.deepEqual(
    evidence.map((item) => item.sourcePath),
    [SCOPE_SUMMARY]
  );
  assert.equal(evidence[0]?.quote, SCOPE_QUOTE);
});
