import assert from "node:assert/strict";
import test from "node:test";
import type { FunnelRunResult } from "../src/core/memory/funnel-run.js";
import {
  FUNNEL_VARIANTS,
  FUNNEL_VARIANT_NAMES,
  deepestSearchedDepth,
  funnelConfigOf
} from "../scripts/memory-eval/funnel-variants.js";
import {
  judgedDepthOfVariant,
  rankingVariants,
  runFunnelRanking,
  type VariantInput
} from "../scripts/memory-eval/variants.js";
import { caseInput, channelsAt } from "./memory-funnel-fixtures.js";
import { FakeRerankingProvider } from "./memory-test-helpers.js";

test("the variant table declares one funnel variant per depth, plus the two adaptive ones", () => {
  assert.deepEqual(
    [...FUNNEL_VARIANT_NAMES],
    [
      "FUNNEL_D0",
      "FUNNEL_D1",
      "FUNNEL_D2",
      "ADAPTIVE",
      "ADAPTIVE_HM",
      "ALL_PASSAGES_D0",
      "ALL_PASSAGES_D1",
      "ALL_PASSAGES_D2",
      "ALL_CANDIDATES_D0",
      "ALL_CANDIDATES_D1",
      "ALL_CANDIDATES_D2"
    ]
  );
});

test("a per-depth funnel variant searches exactly its depth", () => {
  assert.deepEqual(funnelConfigOf("FUNNEL_D1").depths, [1]);
  assert.deepEqual(funnelConfigOf("ALL_PASSAGES_D2").depths, [2]);
});

test("ADAPTIVE searches depths 0, 1 and 2 and stops at a high band; ADAPTIVE_HM also at a medium one", () => {
  const adaptive = funnelConfigOf("ADAPTIVE");
  assert.deepEqual(adaptive.depths, [0, 1, 2]);
  assert.equal(adaptive.stopOn, "high");
  assert.equal(funnelConfigOf("ADAPTIVE_HM").stopOn, "high-or-medium");
});

test("ALL_PASSAGES and ALL_CANDIDATES are unbudgeted, and ALL_CANDIDATES makes every group a finalist", () => {
  assert.equal(FUNNEL_VARIANTS.ALL_PASSAGES_D0.config.budgeted, false);
  assert.equal(FUNNEL_VARIANTS.ALL_PASSAGES_D0.config.passages, "all");
  assert.equal(FUNNEL_VARIANTS.ALL_CANDIDATES_D0.config.budgeted, false);
  assert.equal(FUNNEL_VARIANTS.ALL_CANDIDATES_D0.config.finalists, "all");
  assert.equal(
    FUNNEL_VARIANTS.ALL_CANDIDATES_D0.config.passages,
    "consolidated"
  );
});

test("the FUNNEL_D0 variant returns the admitted groups with their funnel detail", async () => {
  const input: VariantInput = {
    query: "brutalism",
    channels: channelsAt(0),
    reranker: new FakeRerankingProvider(),
    judgments: {},
    production: { effectiveQuery: "brutalism", limit: 5, results: [] },
    funnel: caseInput(),
    funnelParams: { budget: 12, k: 2, mode: "cosine" }
  };
  const results = await rankingVariants.FUNNEL_D0?.(input);
  assert.ok(results !== undefined && results.length > 0);
  const [first] = results;
  assert.equal(first?.admitted, true);
  assert.deepEqual(first?.funnel?.layersSearched, [0]);
  assert.equal(first?.funnel?.stopReason, "single-step");
});

test("a funnel variant without the funnel inputs is refused with a clear error", async () => {
  const input: VariantInput = {
    query: "brutalism",
    channels: channelsAt(0),
    reranker: new FakeRerankingProvider(),
    judgments: {},
    production: { effectiveQuery: "brutalism", limit: 5, results: [] }
  };
  await assert.rejects(
    rankingVariants.FUNNEL_D0?.(input) ?? Promise.resolve([]),
    /funnel inputs/
  );
});

test("a funnel variant without its parameters is refused as missing-funnel-params, never defaulted", async () => {
  const input: VariantInput = {
    query: "brutalism",
    channels: channelsAt(0),
    reranker: new FakeRerankingProvider(),
    judgments: {},
    production: { effectiveQuery: "brutalism", limit: 5, results: [] },
    funnel: caseInput()
  };
  await assert.rejects(
    rankingVariants.FUNNEL_D0?.(input) ?? Promise.resolve([]),
    /has no parameters/
  );
});

test("ADAPTIVE needs the band cuts: without them it is refused, with them it reports the depth of its run", () => {
  const input: VariantInput = {
    query: "brutalism",
    channels: channelsAt(0),
    reranker: new FakeRerankingProvider(),
    judgments: {},
    production: { effectiveQuery: "brutalism", limit: 5, results: [] },
    funnel: caseInput(),
    funnelParams: { budget: 12, k: 2, mode: "cosine" }
  };
  assert.throws(() => runFunnelRanking("ADAPTIVE", input), /has no parameters/);
  // Every eligibility reaches a cut of -1, so the first step is a high-band top result: the run stops at layer 0.
  const withCuts = runFunnelRanking("ADAPTIVE", {
    ...input,
    funnelParams: {
      budget: 12,
      k: 2,
      mode: "cosine",
      cuts: { high: -1, medium: -1 }
    }
  });
  assert.equal(withCuts.judgedDepth, 0);
  assert.ok(withCuts.results.length > 0);
});

test("a depth variant is graded at its own depth, and M0 at layer 0", () => {
  assert.equal(judgedDepthOfVariant("DEPTH1"), 1);
  assert.equal(judgedDepthOfVariant("FUNNEL_D2"), 2);
  assert.equal(judgedDepthOfVariant("ALL_CANDIDATES_D0"), 0);
  assert.equal(judgedDepthOfVariant("M0"), 0);
});

test("an adaptive variant has no judged depth from its id: it comes from its own run", () => {
  assert.throws(
    () => judgedDepthOfVariant("ADAPTIVE"),
    /comes from its funnel run/
  );
});

test("an adaptive run is graded at the deepest layer it searched, not at the deepest layer of its table", () => {
  const stoppedAtZero = { layersSearched: [0] } as unknown as FunnelRunResult;
  const searchedAll = {
    layersSearched: [0, 1, 2]
  } as unknown as FunnelRunResult;
  assert.equal(deepestSearchedDepth(stoppedAtZero), 0);
  assert.equal(deepestSearchedDepth(searchedAll), 2);
});
