import assert from "node:assert/strict";
import test from "node:test";
import { stopAfter } from "../src/core/memory/funnel-run.js";
import type { FunnelAdmitted } from "../src/core/memory/funnel-admission.js";
import { interpretationRowsOf } from "../scripts/memory-eval/capture-plan.js";
import type {
  CaptureContext,
  CaptureFile
} from "../scripts/memory-eval/capture-types.js";
import { assertCatalogOf } from "../scripts/memory-eval/replay.js";

function admittedOf(band: "high" | "medium" | "low"): FunnelAdmitted {
  return {
    groupId: band,
    rankingScore: 0,
    hybridScore: 0,
    eligibility: 0,
    band,
    chosenPassages: []
  };
}

test("a stop rule looks at the whole admitted list: a high-band result after a medium one stops the search", () => {
  const mediumThenHigh = [admittedOf("medium"), admittedOf("high")];
  assert.equal(stopAfter("high", mediumThenHigh), "high-band");
  assert.equal(stopAfter("high-or-medium", mediumThenHigh), "high-band");
  assert.equal(
    stopAfter("high-or-medium", [admittedOf("medium"), admittedOf("low")]),
    "medium-band"
  );
  assert.equal(
    stopAfter("high", [admittedOf("medium"), admittedOf("low")]),
    undefined
  );
  assert.equal(stopAfter("none", mediumThenHigh), undefined);
});

test("an E3 capture without the passage catalog fails with the reason, and no fallback is taken", () => {
  const e3 = {
    captureId: "old",
    fingerprint: { captureChannels: "e3-v1" },
    vectors: { file: "vectors.f32", dimension: 3, recordIds: [] }
  } as unknown as CaptureFile;
  assert.throws(
    () => assertCatalogOf(e3),
    /without the passage catalog.*capture again/
  );
  const current = {
    ...e3,
    fingerprint: { captureChannels: "e3-v2" }
  } as unknown as CaptureFile;
  assert.doesNotThrow(() => assertCatalogOf(current));
  const e2 = {
    ...e3,
    vectors: undefined,
    fingerprint: { captureChannels: "e2-v1" }
  } as unknown as CaptureFile;
  assert.doesNotThrow(() => assertCatalogOf(e2));
});

test("the interpretation reads the layers of the core path only: a term that exists only in layer 1 is not read", async () => {
  const calls: Array<{ layers: number[] }> = [];
  const rows = [
    { recordId: "r0", layer: 0 },
    { recordId: "r1", layer: 1 }
  ];
  const context = {
    info: {},
    generation: "gen",
    rows,
    store: {
      readRows: async (
        _info: unknown,
        _generation: unknown,
        options: { layers: number[] }
      ) => {
        calls.push({ layers: options.layers });
        return rows.filter((item) => options.layers.includes(item.layer));
      }
    }
  } as unknown as CaptureContext;
  const read = await interpretationRowsOf(context);
  assert.deepEqual(calls, [{ layers: [0] }]);
  assert.deepEqual(
    read.map((item) => item.recordId),
    ["r0"]
  );
});
