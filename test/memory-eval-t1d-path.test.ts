import assert from "node:assert/strict";
import test from "node:test";
import type { FunnelCaseInput } from "../src/core/memory/funnel-run.js";
import { runFunnel } from "../src/core/memory/funnel-run.js";
import { semanticHitsForChannels } from "../src/core/memory/hybrid-ranking.js";
import { buildMemoryQueryCandidates } from "../src/core/memory/query-interpretation.js";
import {
  rankSemanticMemoryCandidates,
  semanticRerankingDocument
} from "../src/core/memory/semantic-ranking.js";
import type {
  MemorySearchChannels,
  MemorySearchHit,
  MemoryVectorRecord,
  MemoryVectorRow,
  RerankingProvider
} from "../src/core/memory/types.js";
import { interpretationRowsOf } from "../scripts/memory-eval/capture-plan.js";
import type { CaptureContext } from "../scripts/memory-eval/capture-types.js";
import {
  funnelConfigOf,
  runFunnelVariant
} from "../scripts/memory-eval/funnel-variants.js";
import { record } from "./memory-layers-fixtures.js";

/** A layer-0 or layer-1 row with a text, as the index holds it: the same text feeds the vocabulary. */
function textRow(
  recordId: string,
  text: string,
  layer: 0 | 1
): MemoryVectorRow {
  const base = record("t", "passage", {
    recordId,
    layer,
    title: text,
    sectionTitle: text,
    text
  });
  return { ...base, vector: [1, 0] } as MemoryVectorRow;
}

test("the interpretation of planCase never reads a term that exists only in layer 1", async () => {
  const rows = [
    textRow("r0", "workspace settings", 0),
    textRow("r1", "toggle switch", 1)
  ];
  const store = {
    readRows: async (
      _info: unknown,
      _generation: unknown,
      options: { layers: number[] }
    ) => rows.filter((row) => options.layers.includes(row.layer))
  };
  const context = {
    info: {},
    generation: "gen",
    store
  } as unknown as CaptureContext;
  // planCase reads the rows through interpretationRowsOf and builds the candidates with the same function.
  const fromPlanCase = buildMemoryQueryCandidates(
    "toogle",
    await interpretationRowsOf(context)
  );
  assert.equal(fromPlanCase.variants.includes("toggle"), false);
  // Control: with every layer in the rows, the same misspelling does get the layer-1 term.
  const withEveryLayer = buildMemoryQueryCandidates("toogle", rows);
  assert.equal(withEveryLayer.variants.includes("toggle"), true);
});

/** Two groups of layer 0: `m` has the higher reranker score for its passage, and `h` the lower one. */
function twoGroups(): {
  channels: MemorySearchChannels;
  vectors: Map<string, number[]>;
  catalog: FunnelCaseInput["catalog"];
  scores: Map<string, number>;
} {
  const hit = (
    threadId: string,
    kind: "identity" | "passage",
    recordId: string,
    score: number
  ): MemorySearchHit => ({
    record: record(threadId, kind, { recordId, layer: 0 }),
    score
  });
  return {
    channels: {
      identities: [
        hit("m", "identity", "m-id", 0.7),
        hit("h", "identity", "h-id", 0.8)
      ],
      passages: [
        hit("m", "passage", "m-p", 0.6),
        hit("h", "passage", "h-p", 0.9)
      ],
      lexical: []
    },
    vectors: new Map<string, number[]>([
      ["m-id", [1, 0]],
      ["m-p", [0.9, 0.1]],
      ["h-id", [0.8, 0.6]],
      ["h-p", [0.95, 0.05]]
    ]),
    catalog: new Map([
      [
        "m",
        [
          { recordId: "m-id", kind: "identity", layer: 0, vector: [1, 0] },
          { recordId: "m-p", kind: "passage", layer: 0, vector: [0.9, 0.1] }
        ]
      ],
      [
        "h",
        [
          { recordId: "h-id", kind: "identity", layer: 0, vector: [0.8, 0.6] },
          { recordId: "h-p", kind: "passage", layer: 0, vector: [0.95, 0.05] }
        ]
      ]
    ]),
    scores: new Map<string, number>([
      ["m-id", 0.3],
      ["h-id", 0.5],
      ["m-p", 0.95],
      ["h-p", 0.2]
    ])
  };
}

test("ADAPTIVE, with its real config, stops at layer 0 on a high-band result; the M0 ceiling keeps the bands in order", () => {
  const groups = twoGroups();
  const result = runFunnel(
    {
      queryVector: [1, 0],
      channelsByDepth: {
        0: groups.channels,
        1: groups.channels,
        2: groups.channels
      },
      vectors: groups.vectors,
      catalog: groups.catalog,
      scores: groups.scores,
      ftsRecordIds: new Set<string>(),
      budget: 232,
      k: 12,
      mode: "cosine",
      cuts: { high: 0.99, medium: 0.5 }
    },
    funnelConfigOf("ADAPTIVE")
  );
  // The monotone ceiling of M0 (applyMonotonicConfidence, in the hybrid order) never raises an eligibility, so a
  // high band cannot follow a medium one: the first admitted result is the high one. The stop rule over the whole
  // list is tested on its own in memory-eval-t1d-guards.test.ts.
  assert.deepEqual(
    result.admitted.map((item) => item.band),
    ["high", "medium"]
  );
  assert.deepEqual(result.layersSearched, [0]);
  assert.equal(result.stopReason, "high-band");
});

test("the funnel eligibility equals the M0 eligibility for the three channel passages, with the same reranker score", async () => {
  const VECTOR_OF: Record<string, number[]> = {
    "eq-p1": [1, 0],
    "eq-p2": [0.9, 0.1],
    "eq-p3": [0.8, 0.2]
  };
  // Each passage gets its own text: the reranker stub is keyed by document, so equal texts would share one score.
  const passage = (
    recordId: string,
    score: number
  ): { record: MemoryVectorRecord; score: number; vector: number[] } => ({
    record: record("eq", "passage", {
      recordId,
      layer: 0,
      text: `eq passage ${recordId}`
    }),
    score,
    vector: VECTOR_OF[recordId] ?? []
  });
  const members = [
    passage("eq-p1", 0.9),
    passage("eq-p2", 0.6),
    passage("eq-p3", 0.4)
  ];
  const identity = {
    record: record("eq", "identity", { recordId: "eq-identity", layer: 0 }),
    score: 0.8
  };
  const channels: MemorySearchChannels = {
    identities: [identity],
    passages: members.map((item) => ({
      record: item.record,
      score: item.score
    })),
    lexical: []
  };
  const vectors = new Map<string, number[]>([
    ["eq-identity", [1, 0]],
    ...members.map((item) => [item.record.recordId, item.vector] as const)
  ]);
  const scoreByDocument = new Map(
    members.map((item) => [semanticRerankingDocument(item.record), item.score])
  );
  const reranker = {
    rerank: async (_query: string, documents: string[]) =>
      documents.map((document) => scoreByDocument.get(document) ?? 0)
  } as unknown as RerankingProvider;

  // M0: the candidate that semantic-ranking builds from the channel hits, scored by the reranker.
  const m0 = await rankSemanticMemoryCandidates(
    "query",
    semanticHitsForChannels(channels),
    reranker
  );
  const m0Eligibility = m0.find(
    (item) => item.evidence.record.threadId === "eq"
  )?.eligibility;

  // Funnel: the same three channel passages, selected by the budget rule (all three are the whole pool).
  const funnel = runFunnelVariant("FUNNEL_D0", {
    queryVector: [1, 0],
    channelsByDepth: { 0: channels, 1: channels, 2: channels },
    vectors,
    catalog: new Map([
      [
        "eq",
        [
          {
            recordId: "eq-identity",
            kind: "identity",
            layer: 0,
            vector: [1, 0]
          },
          ...members.map((item) => ({
            recordId: item.record.recordId,
            kind: "passage" as const,
            layer: 0 as const,
            vector: item.vector
          }))
        ]
      ]
    ]),
    scores: new Map([
      ["eq-identity", 0.8],
      ...members.map((item) => [item.record.recordId, item.score] as const)
    ]),
    ftsRecordIds: new Set<string>(),
    budget: 232,
    k: 12,
    mode: "cosine"
  });
  const admitted = funnel.admitted.find((item) => item.groupId === "eq");
  assert.ok(admitted !== undefined, "the funnel admits the group");
  assert.ok(m0Eligibility !== undefined, "M0 ranks the group");
  assert.equal(admitted.eligibility, m0Eligibility);
});
