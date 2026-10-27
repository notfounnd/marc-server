import assert from "node:assert/strict";
import test from "node:test";
import {
  containsQuote,
  validateDataset,
  type EvalCase,
  type ValidationRule
} from "../scripts/memory-eval/dataset.js";

const SOURCE_PATH = "threads/thread-a/artifacts/notes.md";
const SOURCE_TEXT = [
  "# Notes",
  "",
  "The **retry budget** for the bank connector is [three attempts](https://example.test) with exponential backoff.",
  ""
].join("\n");
const LONG_PATH = "threads/thread-a/artifacts/long.md";

/** Forty-one distinct words, so that every prefix of 1 to 41 words is a literal quote of the file. */
function wordsOf(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}

const CORPUS = new Map([["thread-a", "unrelated summary text"]]);
const SOURCES = new Map([
  [SOURCE_PATH, SOURCE_TEXT],
  [LONG_PATH, wordsOf(41)]
]);

function caseOf(overrides: Partial<EvalCase>): EvalCase {
  return {
    id: "case-evidence",
    family: "family-a",
    style: "direct",
    query: "zebra lantern protocol",
    queryMode: "auto",
    judgments: { "thread-a": 3 },
    origin: "test",
    ...overrides
  };
}

function rulesOf(evalCase: EvalCase): ValidationRule[] {
  const dataset = {
    schemaVersion: 1 as const,
    corpus: "marc" as const,
    cases: [evalCase]
  };
  return validateDataset(dataset, CORPUS, SOURCES).issues.map(
    (issue) => issue.rule
  );
}

test("containsQuote reads both texts through the index text, with whitespace and case joined", () => {
  assert.equal(
    containsQuote(
      SOURCE_TEXT,
      "retry budget for the bank connector is three attempts"
    ),
    true
  );
  assert.equal(
    containsQuote(SOURCE_TEXT, "RETRY   budget\nfor the bank connector"),
    true
  );
});

test("containsQuote refuses a quote that is not in the text", () => {
  assert.equal(containsQuote(SOURCE_TEXT, "linear backoff only"), false);
});

test("a layer or adaptive-trap case without evidence is rejected; a direct case is not", () => {
  assert.ok(rulesOf(caseOf({ style: "layer" })).includes("missing-evidence"));
  assert.ok(
    rulesOf(caseOf({ style: "adaptive-trap" })).includes("missing-evidence")
  );
  assert.equal(
    rulesOf(caseOf({ style: "direct" })).includes("missing-evidence"),
    false
  );
});

test("a quote of 4 or 41 words is refused; 5 and 40 words are accepted", () => {
  const verdicts = [4, 5, 40, 41].map((count) => ({
    count,
    refused: rulesOf(
      caseOf({
        style: "layer",
        evidence: [{ sourcePath: LONG_PATH, quote: wordsOf(count) }]
      })
    ).includes("quote-length")
  }));
  assert.deepEqual(
    verdicts.map(({ count, refused }) => [count, refused]),
    [
      [4, true],
      [5, false],
      [40, false],
      [41, true]
    ]
  );
});

test("a quote that is not in its source is reported, and a missing source file is reported", () => {
  const absent = caseOf({
    style: "layer",
    evidence: [{ sourcePath: SOURCE_PATH, quote: "linear backoff only" }]
  });
  const missing = caseOf({
    style: "layer",
    evidence: [
      {
        sourcePath: "threads/thread-a/artifacts/other.md",
        quote: "retry budget"
      }
    ]
  });
  assert.ok(rulesOf(absent).includes("quote-not-in-source"));
  assert.ok(rulesOf(missing).includes("evidence-source-missing"));
});

test("a layer case whose quote is inside its source has no evidence issue", () => {
  const complete = caseOf({
    style: "layer",
    evidence: [
      {
        sourcePath: SOURCE_PATH,
        quote: "retry budget for the bank connector is three attempts"
      }
    ]
  });
  const evidenceRules: ValidationRule[] = [
    "missing-evidence",
    "quote-length",
    "evidence-source-missing",
    "quote-not-in-source"
  ];
  assert.deepEqual(
    rulesOf(complete).filter((rule) => evidenceRules.includes(rule)),
    []
  );
});
