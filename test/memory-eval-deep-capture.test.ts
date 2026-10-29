import assert from "node:assert/strict";
import test from "node:test";
import type {
  MemorySearchChannels,
  MemoryVectorRecord,
  MemoryVectorRow
} from "../src/core/memory/types.js";
import type { EvidencePassage } from "../scripts/memory-eval/matrix-plan.js";
import { evidenceMatchesOf } from "../scripts/memory-eval/evidence-match.js";
import {
  evidenceGroupIdsOf,
  scopeEvidenceGroupIdsOf,
  scopeRecordIdsOf
} from "../scripts/memory-eval/capture-scope.js";
import type { EvalCase } from "../scripts/memory-eval/dataset.js";
import {
  allPassages,
  capturedRecordOf,
  OTHER_SUMMARY,
  OTHER_THREAD,
  passageIdOf,
  SCOPE_PASSAGES,
  SCOPE_QUOTE,
  SCOPE_SOURCE_TEXT,
  SCOPE_SUMMARY,
  SCOPE_THREAD,
  scopedCase
} from "./memory-eval-deep-fixtures.js";

const EMPTY_CHANNELS = {
  identities: [],
  passages: [],
  lexical: []
} as unknown as MemorySearchChannels;

function rowsOf(): MemoryVectorRow[] {
  return allPassages().map((item) => ({
    ...(capturedRecordOf(item) as unknown as MemoryVectorRecord),
    vector: item.vector
  }));
}

function scopeOf(
  evalCase: EvalCase,
  kMax: number,
  channelsByDepth = emptyDepths()
): string[] {
  return scopeRecordIdsOf({
    channelsByDepth,
    rows: rowsOf(),
    knownGroupIds: new Set(),
    evidenceGroupIds: scopeEvidenceGroupIdsOf(evalCase),
    kMax
  });
}

function emptyDepths() {
  return { 0: EMPTY_CHANNELS, 1: EMPTY_CHANNELS, 2: EMPTY_CHANNELS };
}

test("with kMax 0, the scope of a scoped case holds every passage of its scope thread and none of another thread", () => {
  const scope = scopeOf(scopedCase(), 0);
  const expected = SCOPE_PASSAGES.map((item) => item.recordId).sort();
  assert.deepEqual(scope, expected);
});

test("the depth-2 pool stays in the scope with kMax 0, even when it is a passage of another thread", () => {
  const poolHit = {
    record: capturedRecordOf(
      allPassages()[4]!
    ) as unknown as MemoryVectorRecord,
    score: 0.7
  };
  const depths = {
    ...emptyDepths(),
    2: {
      identities: [],
      passages: [poolHit],
      lexical: []
    } as unknown as MemorySearchChannels
  };
  const scope = scopeOf(
    scopedCase({ scope: undefined, evidence: undefined, style: "deep" }),
    0,
    depths
  );
  assert.deepEqual(scope, ["rec-o1"]);
});

test("the scope thread joins the scope groups only; the evidence groups and the quotes keep their own meaning", () => {
  const evalCase = scopedCase({
    scope: { threadId: OTHER_THREAD },
    evidence: [{ sourcePath: SCOPE_SUMMARY, quote: SCOPE_QUOTE }]
  });
  assert.deepEqual([...evidenceGroupIdsOf(evalCase)], [SCOPE_THREAD]);
  assert.deepEqual(
    [...scopeEvidenceGroupIdsOf(evalCase)].sort(),
    [OTHER_THREAD, SCOPE_THREAD].sort()
  );
});

test("the evidence matches of a case are the same whether or not its scope names another thread", () => {
  const passages: EvidencePassage[] = SCOPE_PASSAGES.map((item) => ({
    passageId: passageIdOf(item),
    sourcePath: SCOPE_SUMMARY,
    text: item.text
  }));
  const sourceTexts = new Map([
    [SCOPE_SUMMARY, SCOPE_SOURCE_TEXT],
    [OTHER_SUMMARY, "Texto sem relacao com a rotacao."]
  ]);
  const scoped = scopedCase({ scope: { threadId: OTHER_THREAD } });
  const unscoped = scopedCase({ scope: undefined });
  const withScope = evidenceMatchesOf({
    evidence: scoped.evidence ?? [],
    passages,
    sourceTexts
  });
  const withoutScope = evidenceMatchesOf({
    evidence: unscoped.evidence ?? [],
    passages,
    sourceTexts
  });
  assert.deepEqual(withScope, withoutScope);
  assert.equal(withScope[0]?.status, "evidence_unindexable");
  assert.deepEqual(withScope[0]?.passageIds, []);
});
