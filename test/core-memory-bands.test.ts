import test from "node:test";
import assert from "node:assert/strict";
import {
  MEMORY_BAND_CUTS,
  memoryBandOf
} from "../src/core/memory/scoring/bands.js";

/** One step below a cut, far above the double-precision spacing of the cut values. */
const BELOW = 1e-12;

/** Each eligibility, its declared band. Every cut is tested exactly and just below it. */
const BAND_CASES: ReadonlyArray<readonly [string, number, string]> = [
  ["the high cut", MEMORY_BAND_CUTS.high, "high"],
  ["just below the high cut", MEMORY_BAND_CUTS.high - BELOW, "medium"],
  ["the medium cut", MEMORY_BAND_CUTS.medium, "medium"],
  ["just below the medium cut", MEMORY_BAND_CUTS.medium - BELOW, "low"],
  ["the low cut", MEMORY_BAND_CUTS.low, "low"],
  ["just below the low cut", MEMORY_BAND_CUTS.low - BELOW, "low"],
  ["0.5, the M0 admission threshold", 0.5, "low"],
  ["a perfect eligibility", 1, "high"]
];

BAND_CASES.forEach(([label, eligibility, band]) => {
  test(`memoryBandOf gives ${band} for ${label}`, () => {
    assert.equal(memoryBandOf(eligibility), band);
  });
});
