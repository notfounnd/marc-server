import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { assignFolds, FOLD_COUNT } from "../scripts/memory-eval/folds.js";
import {
  decisionTerm,
  mcnemarExact,
  mulberry32,
  pairedBootstrap,
  quadraticKappa,
  STATISTICS_SEED,
  type FamilySums
} from "../scripts/memory-eval/statistics.js";

test("mulberry32 is deterministic for the same seed and stays in [0, 1)", () => {
  const first = mulberry32(STATISTICS_SEED);
  const second = mulberry32(STATISTICS_SEED);
  const values = Array.from({ length: 100 }, () => first());
  assert.deepEqual(
    values,
    Array.from({ length: 100 }, () => second())
  );
  assert.ok(values.every((value) => value >= 0 && value < 1));
});

test("paired bootstrap of constant differences gives that difference", () => {
  const always: FamilySums[] = [
    {
      family: "a",
      candidateNum: 1,
      candidateDen: 1,
      baselineNum: 0,
      baselineDen: 1
    },
    {
      family: "b",
      candidateNum: 2,
      candidateDen: 2,
      baselineNum: 0,
      baselineDen: 2
    }
  ];
  assert.deepEqual(pairedBootstrap(always), { lower: 1, upper: 1 });

  const same: FamilySums[] = [
    {
      family: "a",
      candidateNum: 1,
      candidateDen: 2,
      baselineNum: 1,
      baselineDen: 2
    },
    {
      family: "b",
      candidateNum: 0,
      candidateDen: 2,
      baselineNum: 0,
      baselineDen: 2
    }
  ];
  assert.deepEqual(pairedBootstrap(same), { lower: 0, upper: 0 });
});

test("paired bootstrap is stable with the fixed seed and has no families without data", () => {
  const families: FamilySums[] = [
    {
      family: "a",
      candidateNum: 3,
      candidateDen: 4,
      baselineNum: 2,
      baselineDen: 4
    },
    {
      family: "b",
      candidateNum: 1,
      candidateDen: 4,
      baselineNum: 3,
      baselineDen: 4
    },
    {
      family: "c",
      candidateNum: 2,
      candidateDen: 4,
      baselineNum: 2,
      baselineDen: 4
    }
  ];
  const first = pairedBootstrap(families);
  assert.deepEqual(pairedBootstrap(families), first);
  assert.ok(first !== undefined && first.lower <= first.upper);
  assert.equal(pairedBootstrap([]), undefined);
});

test("exact McNemar matches the binomial tables", () => {
  // b = 1, c = 6: 2 * (C(7,0) + C(7,1)) / 2^7 = 16 / 128.
  assert.equal(mcnemarExact(1, 6), 0.125);
  assert.equal(mcnemarExact(0, 0), 1);
  // b = c = 3: the two-sided value is capped at 1.
  assert.equal(mcnemarExact(3, 3), 1);
});

test("quadratic kappa matches the hand-computed matrices", () => {
  // Observed (0,0) 2, (1,1) 2, (0,1) 1, (1,0) 1: kappa = 1 - (2/9) / (1/3) = 1/3.
  const partial = quadraticKappa([
    [0, 0],
    [0, 0],
    [1, 1],
    [1, 1],
    [0, 1],
    [1, 0]
  ]);
  assert.ok(partial !== null && Math.abs(partial - 1 / 3) < 1e-12);

  // Agreement at chance level: (0,0), (0,1), (1,0), (1,1) gives kappa 0.
  const chance = quadraticKappa([
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1]
  ]);
  assert.ok(chance !== null && Math.abs(chance) < 1e-12);

  // Perfect agreement gives kappa 1.
  assert.equal(
    quadraticKappa([
      [0, 0],
      [1, 1],
      [2, 2]
    ]),
    1
  );
  assert.equal(quadraticKappa([]), null);
});

test("decision vocabulary: improvement, worsening, non-inferiority and inconclusive", () => {
  assert.deepEqual(decisionTerm({ lower: 0.01, upper: 0.2 }, 0.05), {
    term: "melhora",
    nonInferior: true
  });
  assert.deepEqual(decisionTerm({ lower: -0.2, upper: -0.01 }, 0.05), {
    term: "piora",
    nonInferior: false
  });
  assert.deepEqual(decisionTerm({ lower: -0.02, upper: 0.3 }, 0.05), {
    term: "não inferior",
    nonInferior: true
  });
  // Inconclusive is never non-inferior, even when the margin is wide.
  assert.deepEqual(decisionTerm({ lower: -0.1, upper: 0.2 }, 0.05), {
    term: "inconclusivo",
    nonInferior: false
  });
});

test("folds are deterministic, follow the digest order and differ in size by at most one", () => {
  const families = Array.from(
    { length: 12 },
    (_, index) => `family-${String(index + 1).padStart(2, "0")}`
  );
  const assignment = assignFolds(families);
  assert.deepEqual(
    [...assignFolds(families).entries()],
    [...assignment.entries()]
  );

  const expected = [...families]
    .sort((left, right) => digestOf(left).localeCompare(digestOf(right)))
    .map((family, index) => [family, index % FOLD_COUNT]);
  assert.deepEqual([...assignment.entries()], expected);

  const sizes = Array.from(
    { length: FOLD_COUNT },
    (_, fold) =>
      [...assignment.values()].filter((value) => value === fold).length
  );
  assert.equal(
    sizes.reduce((total, size) => total + size, 0),
    12
  );
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
});

function digestOf(family: string): string {
  return createHash("sha256")
    .update(`${STATISTICS_SEED}:${family}`)
    .digest("hex");
}
