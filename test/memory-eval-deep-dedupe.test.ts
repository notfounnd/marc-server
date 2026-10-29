import assert from "node:assert/strict";
import test from "node:test";
import type { DepthPassage } from "../src/core/memory/deep-pool.js";
import { firstPerPassage } from "../src/core/memory/deep-output.js";
import {
  rankScopePassages,
  SCOPE_RERANK_BUDGET
} from "../src/core/memory/deep-scope.js";
import { semanticRerankingDocument } from "../src/core/memory/semantic-ranking.js";
import type {
  MemoryVectorRecord,
  MemoryVectorRow,
  RerankingProviderMetadata
} from "../src/core/memory/types.js";
import type { CapturedCase } from "../scripts/memory-eval/capture-types.js";
import { metricsOf } from "../scripts/memory-eval/deep-metrics.js";
import { pendingCasesOf } from "../scripts/memory-eval/deep-worksheet.js";
import {
  runDeepVariants,
  unscopedVariantsOf
} from "../scripts/memory-eval/deep-variants.js";
import {
  caseRunsOf,
  capturedRecordOf,
  okOf,
  pairKeyOf,
  passageIdOf,
  type PassageSpec,
  QUERY,
  scopedCase,
  SCOPE_THREAD,
  TableReranker
} from "./memory-eval-deep-fixtures.js";

/** One incidental passage that the capture holds five times, under five records, and one useful passage. */
const SOURCE = `.marc/threads/${SCOPE_THREAD}/SUMMARY.md`;
const DUP_HEX = "00000000000000d1";
const USEFUL_HEX = "00000000000000e1";

function spec(
  recordId: string,
  passageHex: string,
  angle: number,
  score: number,
  text: string
): PassageSpec {
  return {
    recordId,
    threadId: SCOPE_THREAD,
    sourcePath: SOURCE,
    passageHex,
    vector: [Math.cos(angle), Math.sin(angle)],
    score,
    text,
    sourceType: "summary"
  };
}

const DUPLICATES = [0, 1, 2, 3, 4].map((index) =>
  spec(
    `dup-${index}`,
    DUP_HEX,
    index * 0.01,
    0.99,
    "trecho incidental repetido na mesma fonte"
  )
);
const USEFUL = spec(
  "useful",
  USEFUL_HEX,
  0.3,
  0.5,
  "trecho util sobre a rotacao do token"
);
const DUP_ID = passageIdOf(DUPLICATES[0]!);
const USEFUL_ID = passageIdOf(USEFUL);

function docOf(item: PassageSpec): string {
  return semanticRerankingDocument(
    capturedRecordOf(item) as unknown as MemoryVectorRecord
  );
}

function rowsOf(items: PassageSpec[]): MemoryVectorRow[] {
  return items.map((item) => ({
    ...(capturedRecordOf(item) as unknown as MemoryVectorRecord),
    vector: item.vector
  }));
}

function captureOf(items: PassageSpec[]) {
  const captured = {
    id: "C-dedupe",
    interpretation: { effectiveQuery: QUERY },
    queryVectors: { [QUERY]: [1, 0] },
    rerankScores: Object.fromEntries(
      items.map((item) => [pairKeyOf(item), item.score] as const)
    )
  } as unknown as CapturedCase;
  return {
    captured,
    records: new Map(
      items.map((item) => [item.recordId, capturedRecordOf(item)] as const)
    ),
    vectors: new Map(
      items.map((item) => [item.recordId, item.vector] as const)
    ),
    rerankerMetadata: {} as RerankingProviderMetadata
  };
}

test("scoped: the top five is the core top five, a repeated passage keeps its first occurrence, and pairs are not reduced", async () => {
  const items = [...DUPLICATES, USEFUL];
  const fixture = captureOf(items);
  const evalCase = scopedCase({
    passageJudgments: { [DUP_ID]: 0, [USEFUL_ID]: 2 }
  });
  const runs = await runDeepVariants({ ...fixture, evalCase });
  const deep = okOf(runs.runs.DEEP);
  const core = await rankScopePassages({
    query: QUERY,
    queryVector: [1, 0],
    rows: rowsOf(items),
    reranker: new TableReranker(
      new Map(items.map((item) => [docOf(item), item.score] as const))
    ),
    budget: SCOPE_RERANK_BUDGET
  });
  const reference = firstPerPassage(
    core.ranked.map((item) => ({ passageId: item.row.passageId }))
  )
    .slice(0, 5)
    .map((item) => item.passageId);
  assert.deepEqual(reference, [DUP_ID, USEFUL_ID]);
  assert.deepEqual(
    deep.ranked.slice(0, 5).map((item) => item.passageId),
    reference
  );
  assert.equal(deep.pairs, items.length);
  assert.equal(deep.scopePassages, items.length);
  const metrics = metricsOf(deep, evalCase);
  assert.equal(metrics.success, true);
  assert.deepEqual(metrics.top5, [DUP_ID, USEFUL_ID]);
});

test("scoped: the worksheet lists each passage once, although the records repeat it", async () => {
  const items = [...DUPLICATES, USEFUL];
  const fixture = captureOf(items);
  const evalCase = scopedCase({ passageJudgments: {} });
  const runs = await runDeepVariants({ ...fixture, evalCase });
  const records = new Map(
    items.map((item) => [passageIdOf(item), capturedRecordOf(item)] as const)
  );
  const [pending] = pendingCasesOf([caseRunsOf(evalCase, runs.runs)], records);
  const ids = pending?.passages.map((passage) => passage.passageId) ?? [];
  assert.deepEqual(ids, [DUP_ID, USEFUL_ID].sort());
  assert.equal(new Set(ids).size, ids.length);
});

test("unscoped: the source types filter first, then the first occurrence; pairs are the documents scored", () => {
  const admitted = (items: PassageSpec[]): DepthPassage[] =>
    items.map(
      (item, index) =>
        ({
          record: capturedRecordOf(item) as unknown as MemoryVectorRecord,
          denseRank: index + 1,
          score: item.score,
          groupBand: "high"
        }) as unknown as DepthPassage
    );
  const vectors = new Map(
    [...DUPLICATES, USEFUL].map((item) => [item.recordId, item.vector] as const)
  );
  const runs = unscopedVariantsOf({
    admitted: admitted([...DUPLICATES, USEFUL]),
    pairs: 6,
    vectors,
    queryVector: [1, 0]
  });
  const deep = okOf(runs.DEEP);
  assert.deepEqual(
    deep.ranked.map((item) => item.passageId),
    [DUP_ID, USEFUL_ID]
  );
  assert.equal(deep.pairs, 6);
  assert.equal(deep.scopePassages, null);
  assert.deepEqual(
    okOf(runs.DEEP_COSINE).ranked.map((item) => item.passageId),
    [DUP_ID, USEFUL_ID]
  );
  const chatDuplicates = DUPLICATES.map((item) => ({
    ...item,
    sourceType: "chat" as const
  }));
  const filtered = unscopedVariantsOf({
    admitted: admitted([...chatDuplicates, USEFUL]),
    pairs: 6,
    vectors,
    queryVector: [1, 0],
    sourceTypes: ["summary"]
  });
  assert.deepEqual(
    okOf(filtered.DEEP).ranked.map((item) => item.passageId),
    [USEFUL_ID]
  );
});
