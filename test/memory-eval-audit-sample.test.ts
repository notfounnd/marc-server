import assert from "node:assert/strict";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  AUDIT_SEED,
  auditSampleOf,
  medianOf,
  mulberry32,
  readOrCreateAuditManifest,
  sampleWithoutReplacement,
  verifyAuditManifest,
  type AuditCase
} from "../scripts/memory-eval/audit-sample.js";
import type { CaseInput } from "../scripts/memory-eval/metrics.js";
import { pendingPairs } from "../scripts/memory-eval/metrics.js";
import { tempDirectory } from "./memory-eval-capture-fixtures.js";

function auditCase(
  caseId: string,
  universe: string[],
  externals: string[]
): AuditCase {
  return { caseId, universe, externals };
}

const CASES: AuditCase[] = [
  auditCase("B2", ["u1", "u2"], ["e3", "e1", "e2", "e4"]),
  auditCase("A1", ["u1"], ["e5"]),
  auditCase("C3", ["u9"], [])
];

test("the generator gives the same sequence for the same seed, inside [0, 1)", () => {
  const first = mulberry32(AUDIT_SEED);
  const second = mulberry32(AUDIT_SEED);
  const sequenceOne = [first(), first(), first(), first(), first()];
  const sequenceTwo = [second(), second(), second(), second(), second()];
  assert.deepEqual(sequenceOne, sequenceTwo);
  assert.ok(sequenceOne.every((value) => value >= 0 && value < 1));
});

test("the draw takes distinct candidates, the same for any order of the input", () => {
  const sample = sampleWithoutReplacement(
    ["e3", "e1", "e2", "e4"],
    2,
    mulberry32(AUDIT_SEED)
  );
  const shuffled = sampleWithoutReplacement(
    ["e2", "e4", "e1", "e3"],
    2,
    mulberry32(AUDIT_SEED)
  );
  assert.equal(sample.length, 2);
  assert.equal(new Set(sample).size, 2);
  assert.deepEqual(sample, shuffled);
});

test("with fewer candidates than the count, the draw takes all of them; with none, it takes none", () => {
  assert.deepEqual(
    sampleWithoutReplacement(["e5"], 2, mulberry32(AUDIT_SEED)),
    ["e5"]
  );
  assert.deepEqual(sampleWithoutReplacement([], 2, mulberry32(AUDIT_SEED)), []);
});

test("the manifest is the same for the same cases, and each case samples only its own externals", () => {
  const first = auditSampleOf({
    seed: AUDIT_SEED,
    corpus: "marc",
    captureId: "c",
    cases: CASES
  });
  const second = auditSampleOf({
    seed: AUDIT_SEED,
    corpus: "marc",
    captureId: "c",
    cases: CASES
  });
  assert.deepEqual(first, second);
  for (const record of first.cases) {
    const source = CASES.find((item) => item.caseId === record.caseId);
    assert.ok(source !== undefined);
    assert.equal(record.sampled.length, Math.min(2, source.externals.length));
    assert.ok(
      record.sampled.every((groupId) => source.externals.includes(groupId))
    );
  }
});

test("the manifest refuses a universe that changed after it was drawn", () => {
  const manifest = auditSampleOf({
    seed: AUDIT_SEED,
    corpus: "marc",
    captureId: "c",
    cases: CASES
  });
  verifyAuditManifest(manifest, CASES);
  const changed = CASES.map((item) =>
    item.caseId === "A1" ? auditCase("A1", ["u1", "u7"], ["e5"]) : item
  );
  assert.throws(
    () => verifyAuditManifest(manifest, changed),
    /universe of case A1 changed/
  );
});

test("a stored manifest is read again, not drawn again, and a changed universe refuses it", async (t: TestContext) => {
  const file = path.join(await tempDirectory(t), "audit-sample.json");
  const input = {
    file,
    seed: AUDIT_SEED,
    corpus: "marc",
    captureId: "c",
    cases: CASES
  };
  const created = await readOrCreateAuditManifest(input);
  const reused = await readOrCreateAuditManifest(input);
  assert.deepEqual(reused, created);
  const changed = CASES.map((item) =>
    item.caseId === "A1" ? auditCase("A1", ["u1", "u7"], ["e5"]) : item
  );
  await assert.rejects(
    readOrCreateAuditManifest({ ...input, cases: changed }),
    /universe of case A1 changed/
  );
});

test("a sampled pair with no grade leaves no variant incomplete: no variant reaches it", () => {
  // The sampled group `e5` is in the audit, not in the results of any variant of the case.
  const item: CaseInput = {
    caseId: "A1",
    family: "family",
    style: "implicit",
    judgments: { u1: 2 },
    results: [{ threadId: "u1", score: 0.9, admitted: true }],
    judgedDepth: 2,
    gradesByLayer: { 0: { u1: 2 }, 1: {}, 2: {} },
    presentLayers: new Map()
  };
  assert.deepEqual(pendingPairs([item], true), []);
  assert.equal(item.incomplete, undefined);
});

test("the median of the external counts, and null for no cases", () => {
  assert.equal(medianOf([1, 3, 2]), 2);
  assert.equal(medianOf([1, 2, 3, 4]), 2.5);
  assert.equal(medianOf([]), null);
});
