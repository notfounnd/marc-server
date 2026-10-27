import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  HISTORICAL_ORIGINS,
  findSharedWordRun,
  validateDataset,
  type CorpusIndex,
  type EvalCase,
  type EvalDataset,
  type PinnedCorpus,
  type RelevanceGrade,
  type ValidationRule
} from "../scripts/memory-eval/dataset.js";
import {
  CORPORA,
  runCli,
  validationCorpus
} from "../scripts/memory-eval/cli.js";

const ALPHA_SUMMARY =
  "Resumo: acao de sincronizacao rapida fica registrada aqui.";
const BETA_SUMMARY = "Resumo: outro assunto sem relacao com o caso de teste.";

const corpus: CorpusIndex = new Map([
  ["thread-alpha", ALPHA_SUMMARY],
  ["thread-beta", BETA_SUMMARY]
]);

const directCase: EvalCase = {
  id: "direct-beta",
  family: "thread-beta",
  style: "direct",
  query: "pergunta sem relacao",
  queryMode: "auto",
  judgments: { "thread-beta": 3 },
  origin: "fixture-new"
};

const negativeCase: EvalCase = {
  id: "negative-ok",
  family: "negative:negative-ok",
  style: "negative",
  query: "receita de bolo de chocolate",
  queryMode: "literal",
  judgments: {},
  origin: "fixture-new"
};

const overlapCase: EvalCase = {
  id: "overlap-new",
  family: "thread-alpha",
  style: "direct",
  query: "acao de sincronizacao rapida no ledger",
  queryMode: "auto",
  judgments: { "thread-alpha": 3 },
  origin: "fixture-outside-table"
};

function datasetOf(cases: EvalCase[]): EvalDataset {
  return { schemaVersion: 1, corpus: "marc", cases };
}

function rulesOf(cases: EvalCase[]): ValidationRule[] {
  return validateDataset(datasetOf(cases), corpus).issues.map(
    (issue) => issue.rule
  );
}

test("accepts a valid direct case and a valid negative case", () => {
  const result = validateDataset(datasetOf([directCase, negativeCase]), corpus);
  assert.deepEqual(result.issues, []);
});

test("rejects a duplicated id on every occurrence", () => {
  const duplicate = { ...directCase, query: "outra pergunta" };
  assert.deepEqual(rulesOf([directCase, duplicate]), [
    "duplicate-id",
    "duplicate-id"
  ]);
});

test("rejects a judgment on a thread that is not closed in the corpus", () => {
  const missingThread: EvalCase = {
    ...directCase,
    id: "missing-thread",
    judgments: { "thread-missing": 3 }
  };
  assert.deepEqual(rulesOf([missingThread]), ["judgment-thread-not-closed"]);
});

test("rejects a grade outside the 0 to 3 range", () => {
  const badGrade: EvalCase = {
    ...directCase,
    id: "bad-grade",
    judgments: {
      "thread-beta": 3,
      "thread-alpha": 4 as unknown as RelevanceGrade
    }
  };
  assert.deepEqual(rulesOf([badGrade]), ["grade-out-of-range"]);
});

test("rejects a non-negative case without a grade 3 thread", () => {
  const noTarget: EvalCase = {
    ...directCase,
    id: "no-target",
    judgments: { "thread-alpha": 2 }
  };
  assert.deepEqual(rulesOf([noTarget]), ["missing-target-judgment"]);
});

test("rejects a negative case with a judgment of grade 2 or higher", () => {
  const relevantNegative: EvalCase = {
    ...negativeCase,
    id: "negative-relevant",
    family: "negative:negative-relevant",
    judgments: { "thread-alpha": 2 }
  };
  assert.deepEqual(rulesOf([relevantNegative]), [
    "negative-with-relevant-judgment"
  ]);
});

test("rejects typo and overcorrection-control cases without expectedInterpretation", () => {
  const typoWithoutExpectation: EvalCase = {
    ...directCase,
    id: "typo-none",
    style: "typo",
    query: "pergunta sem relacoa"
  };
  const controlWithoutExpectation: EvalCase = {
    ...directCase,
    id: "control-none",
    style: "overcorrection-control"
  };
  assert.deepEqual(
    rulesOf([typoWithoutExpectation, controlWithoutExpectation]),
    ["missing-expected-interpretation", "missing-expected-interpretation"]
  );
});

test("accepts a typo case that declares its expectedInterpretation", () => {
  const typoWithExpectation: EvalCase = {
    ...directCase,
    id: "typo-ok",
    style: "typo",
    query: "pergunta sem relacoa",
    expectedInterpretation: { effectiveQuery: "pergunta sem relacao" }
  };
  assert.deepEqual(rulesOf([typoWithExpectation]), []);
});

test("rejects a query sharing four consecutive words with the grade 3 summary outside the historical origins", () => {
  assert.deepEqual(rulesOf([overlapCase]), ["query-overlaps-summary"]);
});

test("exempts every migrated historical origin from the overlap check", () => {
  const exemptCases = HISTORICAL_ORIGINS.map((origin) => ({
    ...overlapCase,
    id: `exempt-${origin}`,
    origin
  }));
  const issuesByCase = exemptCases.map(
    (evalCase) => validateDataset(datasetOf([evalCase]), corpus).issues
  );
  assert.deepEqual(
    issuesByCase,
    exemptCases.map(() => [])
  );
});

test("detects four shared consecutive words regardless of case and accents", () => {
  assert.equal(
    findSharedWordRun(
      "Ação de Sincronização RÁPIDA para o ledger",
      "resumo: acao de sincronizacao rapida fica aqui"
    ),
    "acao de sincronizacao rapida"
  );
});

test("ignores shared runs shorter than four words", () => {
  assert.equal(
    findSharedWordRun("acao de sincronizacao", ALPHA_SUMMARY),
    undefined
  );
});

const historicalIds = [
  "1D",
  "1I",
  "1P",
  "2D",
  "2I",
  "2P",
  "3D",
  "3I",
  "3P",
  "4D",
  "4I",
  "4P",
  "5D",
  "5I",
  "5P",
  "6D",
  "6I",
  "6P",
  "7D",
  "7I",
  "7P",
  "8D",
  "8I",
  "8P",
  "9D",
  "9I",
  "9P",
  "10D",
  "10I",
  "10P"
];
const qualityIds = idSequence("Q", 14);
const controlIds = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"];

const APPROVER_A1_ORIGIN = "approvers-a1-2026-10-15";

function idSequence(prefix: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`
  );
}

const approverA1Ids = [
  ...idSequence("A", 40),
  ...idSequence("N", 10),
  ...idSequence("T", 8),
  ...idSequence("O", 4)
];

test("loads the migrated and approver-written marc cases and validates them against the pinned corpus", async () => {
  const datasetPath = fileURLToPath(
    new URL("../scripts/memory-eval/datasets/marc.json", import.meta.url)
  );
  const pinnedPath = fileURLToPath(
    new URL("../scripts/memory-eval/datasets/marc.corpus.json", import.meta.url)
  );
  const dataset = JSON.parse(
    await fs.readFile(datasetPath, "utf8")
  ) as EvalDataset;
  const pinned = JSON.parse(
    await fs.readFile(pinnedPath, "utf8")
  ) as PinnedCorpus;
  // The validation corpus and its sources come from the same function as the validate command.
  const marc = CORPORA.get("marc");
  assert.ok(marc !== undefined);
  const {
    corpus,
    issues: pinnedIssues,
    sources
  } = await validationCorpus(marc);

  const historicalCaseIds = dataset.cases
    .filter((evalCase) =>
      (HISTORICAL_ORIGINS as readonly string[]).includes(evalCase.origin)
    )
    .map((evalCase) => evalCase.id);
  assert.deepEqual(historicalCaseIds, [
    ...historicalIds,
    ...qualityIds,
    ...controlIds
  ]);
  const approverCaseIds = dataset.cases
    .filter((evalCase) => evalCase.origin === APPROVER_A1_ORIGIN)
    .map((evalCase) => evalCase.id);
  assert.deepEqual(approverCaseIds, approverA1Ids);
  assert.equal(dataset.cases.length, 137);
  assert.equal(corpus.size, pinned.threadIds.length);
  assert.deepEqual(pinnedIssues, []);
  assert.deepEqual(validateDataset(dataset, corpus, sources).issues, []);
});

const dispatchScenarios: Array<{
  name: string;
  argv: string[];
  exitCode: number;
}> = [
  {
    name: "validate on the marc corpus exits with 0",
    argv: ["validate", "--corpus", "marc"],
    exitCode: 0
  },
  {
    name: "validate on an unknown corpus exits with 2",
    argv: ["validate", "--corpus", "unknown"],
    exitCode: 2
  },
  {
    name: "an unknown command exits with 2",
    argv: ["unknown"],
    exitCode: 2
  },
  {
    name: "no command prints usage and exits with 2",
    argv: [],
    exitCode: 2
  }
];

for (const scenario of dispatchScenarios) {
  test(`cli dispatch: ${scenario.name}`, async (t) => {
    t.mock.method(console, "log", () => undefined);
    t.mock.method(console, "error", () => undefined);
    assert.equal(await runCli(scenario.argv), scenario.exitCode);
  });
}
