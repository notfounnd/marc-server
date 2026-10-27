import assert from "node:assert/strict";
import test from "node:test";
import type { FunnelCaseInput } from "../src/core/memory/funnel-run.js";
import type { CatalogRow } from "../src/core/memory/funnel-groups.js";
import type {
  MemorySearchChannels,
  MemorySearchHit,
  MemoryVectorRow
} from "../src/core/memory/types.js";
import { scopeRecordIdsOf } from "../scripts/memory-eval/capture-scope.js";
import { runFunnelVariant } from "../scripts/memory-eval/funnel-variants.js";
import { caseInput, catalogOfMembers } from "./memory-funnel-fixtures.js";
import { record } from "./memory-layers-fixtures.js";

type Row = {
  recordId: string;
  threadId: string;
  kind: "identity" | "passage";
  layer: 0 | 1 | 2;
  vector: readonly number[];
  score: number;
};

function row(input: Row): MemoryVectorRow {
  const base = record(input.threadId, input.kind, {
    recordId: input.recordId,
    layer: input.layer
  });
  return { ...base, vector: [...input.vector] } as MemoryVectorRow;
}

function hit(input: Row): MemorySearchHit {
  return { record: row(input), score: input.score };
}

function channelsOf(hits: {
  identities?: Row[];
  passages?: Row[];
}): MemorySearchChannels {
  return {
    identities: (hits.identities ?? []).map(hit),
    passages: (hits.passages ?? []).map(hit),
    lexical: []
  };
}

test("the scope of depth 0 holds a finalist's passages that the channels do not reach", () => {
  const a = { threadId: "a", layer: 0 as const, vector: [1, 0], score: 0.9 };
  const aIdentity: Row = { ...a, recordId: "a-identity", kind: "identity" };
  const aHit: Row = { ...a, recordId: "a-hit", kind: "passage" };
  const aOutside: Row = {
    ...a,
    recordId: "a-outside",
    kind: "passage",
    vector: [0.2, 0.8]
  };
  const newGroups: Row[] = Array.from({ length: 31 }, (_, index) => ({
    threadId: `g${index}`,
    recordId: `g${index}-passage`,
    kind: "passage" as const,
    layer: 2 as const,
    vector: [1, 0],
    score: 0.99
  }));
  const rows = [aIdentity, aHit, aOutside, ...newGroups].map(row);
  const channelsByDepth = {
    0: channelsOf({ identities: [aIdentity], passages: [aHit] }),
    1: channelsOf({ identities: [aIdentity], passages: [aHit] }),
    2: channelsOf({ passages: newGroups })
  };
  const scope = scopeRecordIdsOf({
    channelsByDepth,
    rows,
    knownGroupIds: new Set<string>(),
    evidenceGroupIds: new Set<string>(),
    kMax: 30
  });
  assert.ok(
    scope.includes("a-outside"),
    "a finalist of depth 0 keeps its own layer-0 passages"
  );
  assert.ok(scope.includes("a-identity"));
});

test("ALL_PASSAGES selects passages the channels do not hold, from the catalog up to the depth", async () => {
  const outside = {
    recordId: "t1-outside",
    kind: "passage" as const,
    layer: 1 as const,
    vector: [1, 0],
    score: 0.95
  };
  const catalog = catalogOfMembers();
  catalog.set("t1", [...(catalog.get("t1") ?? []), outside]);
  const scores = new Map(caseInput().scores);
  scores.set("t1-outside", outside.score);
  const result = runFunnelVariant(
    "ALL_PASSAGES_D1",
    caseInput({ catalog, scores })
  );
  const t1 = result.admitted.find((item) => item.groupId === "t1");
  assert.ok(t1?.chosenPassages.includes("t1-outside"));
});

test("ALL_CANDIDATES asks the reranker for the identity of a group with no channel passage, as M0 does", () => {
  const identityOnly: Row = {
    threadId: "idonly",
    recordId: "idonly-identity",
    kind: "identity",
    layer: 0,
    vector: [1, 0],
    score: 0.8
  };
  const input: FunnelCaseInput = caseInput({
    channelsByDepth: {
      0: channelsOf({ identities: [identityOnly] }),
      1: channelsOf({ identities: [identityOnly] }),
      2: channelsOf({ identities: [identityOnly] })
    },
    catalog: new Map([
      [
        "idonly",
        [
          {
            recordId: "idonly-identity",
            kind: "identity",
            layer: 0,
            vector: [1, 0]
          } satisfies CatalogRow
        ]
      ]
    ]),
    scores: new Map([["idonly-identity", 0.8]]),
    vectors: new Map([["idonly-identity", [1, 0]]])
  });
  const result = runFunnelVariant("ALL_CANDIDATES_D0", input);
  assert.ok(result.steps[0]?.scored.includes("idonly-identity"));
});

test("the consolidated passages of ALL_CANDIDATES are the channel passages, not the catalog ones", () => {
  const catalog = catalogOfMembers();
  catalog.set("t1", [
    ...(catalog.get("t1") ?? []),
    {
      recordId: "t1-extra",
      kind: "passage",
      layer: 0,
      vector: [0.1, 0.9]
    } satisfies CatalogRow
  ]);
  const scores = new Map(caseInput().scores);
  scores.set("t1-extra", 0.1);
  const result = runFunnelVariant(
    "ALL_CANDIDATES_D0",
    caseInput({ catalog, scores })
  );
  const t1 = result.admitted.find((item) => item.groupId === "t1");
  assert.equal(t1?.chosenPassages.includes("t1-extra"), false);
});

test("the dense signals of a finalist come from its channel passages: a larger selection keeps the eligibility", () => {
  // Twelve channel passages, with dense ranks 1 to 12, and fourteen catalog passages outside the channels.
  // The cosines fall with the index, so the budget (P = 19) keeps the first 19 of the 26 passages and
  // ALL_PASSAGES keeps all 26. The best score is the same passage in both: pg-p0, with 0.9.
  const members: Row[] = Array.from(
    { length: 26 },
    (_, index): Row => ({
      recordId: `pg-p${index}`,
      threadId: "pg",
      kind: "passage",
      layer: 0,
      vector: [Math.cos(index * 0.1), Math.sin(index * 0.1)],
      score: 0.9 - index * 0.02
    })
  );
  const identity: Row = {
    recordId: "pg-identity",
    threadId: "pg",
    kind: "identity",
    layer: 0,
    vector: [1, 0],
    score: 0.5
  };
  const everyRow = [identity, ...members];
  const channels = channelsOf({
    identities: [identity],
    passages: members.slice(0, 12)
  });
  const catalog = new Map([
    [
      "pg",
      everyRow.map((item) => ({
        recordId: item.recordId,
        kind: item.kind,
        layer: item.layer,
        vector: item.vector
      }))
    ]
  ]);
  const vectors = new Map<string, readonly number[]>(
    everyRow.map((item) => [item.recordId, item.vector] as const)
  );
  const scores = new Map<string, number>(
    everyRow.map((item) => [item.recordId, item.score] as const)
  );
  const input = caseInput({
    channelsByDepth: { 0: channels, 1: channels, 2: channels },
    catalog,
    scores,
    vectors,
    queryVector: [1, 0],
    budget: 232,
    k: 12
  });
  const budgeted = runFunnelVariant("FUNNEL_D0", input);
  const wide = runFunnelVariant("ALL_PASSAGES_D0", input);
  const budgetedIds = budgeted.steps[0]?.scored ?? [];
  const wideIds = wide.steps[0]?.scored ?? [];
  assert.notDeepEqual(budgetedIds, wideIds);
  assert.ok(wideIds.length > budgetedIds.length);
  const budgetedGroup = budgeted.admitted.find((item) => item.groupId === "pg");
  const wideGroup = wide.admitted.find((item) => item.groupId === "pg");
  assert.ok(budgetedGroup !== undefined && wideGroup !== undefined);
  assert.equal(wideGroup.eligibility, budgetedGroup.eligibility);
});
