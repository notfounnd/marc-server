import assert from "node:assert/strict";
import test from "node:test";
import type {
  CaptureFile,
  CapturedCase
} from "../scripts/memory-eval/capture-types.js";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import {
  channelListsOf,
  commonCasesOf,
  divergenceOf
} from "../scripts/memory-eval/compare-common.js";

function capturedCase(
  id: string,
  overrides: Partial<CapturedCase> = {}
): CapturedCase {
  return {
    id,
    queryMode: "auto",
    originalQuery: `query ${id}`,
    interpretation: {
      correctionApplied: false,
      effectiveQuery: `query ${id}`,
      mode: "auto",
      originalQuery: `query ${id}`
    },
    channels: {},
    ...overrides
  } as unknown as CapturedCase;
}

function captureOf(cases: CapturedCase[]): CaptureFile {
  return {
    captureId: "capture",
    corpus: "marc",
    cases
  } as unknown as CaptureFile;
}

function datasetOf(ids: string[]): EvalDataset {
  return { cases: ids.map((id) => ({ id })) } as unknown as EvalDataset;
}

test("common cases keep the dataset order and exclude each case that a capture lacks or changes", () => {
  const dataset = datasetOf(["a", "b", "c", "d", "e", "f"]);
  const baseline = captureOf([
    capturedCase("a"),
    capturedCase("b"),
    capturedCase("c", { originalQuery: "old wording" }),
    capturedCase("d", {
      incomplete: { reason: "evidence_missing" }
    } as Partial<CapturedCase>)
  ]);
  const candidate = captureOf([
    capturedCase("a"),
    capturedCase("b"),
    capturedCase("c"),
    capturedCase("d"),
    capturedCase("e", {
      incomplete: { reason: "evidence_missing" }
    } as Partial<CapturedCase>)
  ]);

  const set = commonCasesOf({ dataset, baseline, candidate });

  assert.deepEqual(set.common, ["a", "b"]);
  assert.deepEqual(set.excluded.notInBaseline, ["e", "f"]);
  assert.deepEqual(set.excluded.notInCandidate, []);
  assert.deepEqual(set.excluded.queryDiffers, ["c"]);
  assert.deepEqual(set.excluded.incompleteBaseline, ["d"]);
  assert.deepEqual(set.excluded.incompleteCandidate, []);
});

test("a case missing from the candidate capture is excluded as not in candidate", () => {
  const set = commonCasesOf({
    dataset: datasetOf(["a", "b"]),
    baseline: captureOf([capturedCase("a"), capturedCase("b")]),
    candidate: captureOf([capturedCase("a")])
  });

  assert.deepEqual(set.common, ["a"]);
  assert.deepEqual(set.excluded.notInCandidate, ["b"]);
});

test("channel lists read the channels under the effective query, lexical and vector apart", () => {
  const captured = capturedCase("a", {
    channels: {
      "query a": {
        identities: [{ recordId: "a:identity", score: 0.5 }],
        passages: [{ recordId: "a:passage", score: 0.25 }],
        lexical: [
          { field: "title", recordId: "a:title", score: 1, vectorScore: 0.1 }
        ]
      }
    }
  } as Partial<CapturedCase>);

  const lists = channelListsOf(captured);

  assert.deepEqual(lists.lexical, ["title:a:title:1.000000"]);
  assert.deepEqual(lists.vector, ["a:identity:0.500000", "a:passage:0.250000"]);
});

test("a divergence names the channel that differs, and an order-only difference keeps the same admitted set", () => {
  const baseline = capturedCase("a", {
    channels: {
      "query a": {
        identities: [],
        passages: [{ recordId: "a:passage", score: 0.25 }],
        lexical: [
          { field: "title", recordId: "a:title", score: 1, vectorScore: 0.1 }
        ]
      }
    }
  } as Partial<CapturedCase>);
  const candidate = capturedCase("a", {
    channels: {
      "query a": {
        identities: [],
        passages: [{ recordId: "a:passage", score: 0.25 }],
        lexical: [
          { field: "title", recordId: "a:title", score: 0.9, vectorScore: 0.1 }
        ]
      }
    }
  } as Partial<CapturedCase>);

  const divergence = divergenceOf({
    caseId: "a",
    baseline,
    candidate,
    baselineAdmitted: ["t1", "t2"],
    candidateAdmitted: ["t2", "t1"]
  });

  assert.equal(divergence.admittedDiffers, true);
  assert.equal(divergence.lexicalDiffers, true);
  assert.equal(divergence.vectorDiffers, false);
  assert.equal(divergence.channel, "lexical");
});
