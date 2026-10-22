import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCrossCorpus,
  assertInputsPresent,
  requirementsOf,
  usesFoldCalibrations,
  type InputPaths,
  type ReplayInputs,
  type VariantRequirements
} from "../scripts/memory-eval/replay-inputs.js";
import type { FitResult } from "../scripts/memory-eval/fit-model.js";
import type { CalibrationSet } from "../scripts/memory-eval/calibration.js";

/** A fit and calibrations stand-in: the module checks only that they are present. */
const PRESENT_FIT = {} as FitResult;
const PRESENT_CALIBRATIONS = {} as CalibrationSet;

const PATHS: InputPaths = {
  fit: "fit.json",
  calibrations: "calibrate-marc.json",
  judge: (name) => `judge-${name}.json`
};

const REQUIREMENT_CASES: ReadonlyArray<{
  variants: string[];
  expected: VariantRequirements;
}> = [
  {
    variants: ["M0", "D0"],
    expected: { fit: false, calibrations: false, judges: [] }
  },
  {
    variants: ["H1_CALIBRATED"],
    expected: { fit: true, calibrations: false, judges: [] }
  },
  {
    variants: ["H2_N1", "H2_N2"],
    expected: { fit: true, calibrations: true, judges: [] }
  },
  {
    variants: ["H7_JUDGE_QWEN_FALLBACK", "H7_JUDGE_KEV"],
    expected: { fit: true, calibrations: false, judges: ["qwen", "kev"] }
  }
];

REQUIREMENT_CASES.forEach(({ variants, expected }) => {
  test(`the requirements of ${variants.join(", ")} are the inputs they read`, () => {
    assert.deepEqual(requirementsOf(variants), expected);
  });
});

const MISSING_CASES: ReadonlyArray<{
  name: string;
  requirements: VariantRequirements;
  inputs: ReplayInputs;
  message: RegExp;
}> = [
  {
    name: "the fit",
    requirements: { fit: true, calibrations: false, judges: [] },
    inputs: {},
    message: /needs the fit, but fit\.json is missing/
  },
  {
    name: "the calibrations",
    requirements: { fit: true, calibrations: true, judges: [] },
    inputs: { fit: PRESENT_FIT },
    message: /needs the calibrations, but calibrate-marc\.json is missing/
  },
  {
    name: "the qwen judge scores",
    requirements: { fit: true, calibrations: false, judges: ["qwen"] },
    inputs: { fit: PRESENT_FIT },
    message: /needs the qwen judge scores, but judge-qwen\.json is missing/
  }
];

MISSING_CASES.forEach(({ name, requirements, inputs, message }) => {
  test(`a missing input names its file: ${name}`, () => {
    assert.throws(
      () => assertInputsPresent(requirements, inputs, PATHS),
      message
    );
  });
});

test("every required input present passes the check", () => {
  const inputs: ReplayInputs = {
    fit: PRESENT_FIT,
    calibrations: PRESENT_CALIBRATIONS,
    judgeTables: { qwen: new Map() }
  };
  assert.doesNotThrow(() =>
    assertInputsPresent(
      { fit: true, calibrations: true, judges: ["qwen"] },
      inputs,
      PATHS
    )
  );
});

/** --model on the model's own corpus: refused. */
const REFUSED_PAIRS: ReadonlyArray<readonly [capture: string, model: string]> =
  [["marc", "marc"]];

/** --model on another corpus: allowed, the cross-corpus validation. */
const ALLOWED_PAIRS: ReadonlyArray<readonly [capture: string, model: string]> =
  [["ledgerline-en", "marc"]];

REFUSED_PAIRS.forEach(([capture, model]) => {
  test(`--model ${model} on ${capture} is refused`, () => {
    assert.throws(
      () => assertCrossCorpus(capture, model),
      /cross-corpus validation only/
    );
  });
});

ALLOWED_PAIRS.forEach(([capture, model]) => {
  test(`--model ${model} on ${capture} is allowed`, () => {
    assert.doesNotThrow(() => assertCrossCorpus(capture, model));
  });
});

/** Only marc without --model reads the per-fold calibrations of H2. */
const FOLD_CALIBRATION_CASES: ReadonlyArray<
  readonly [string, string | undefined, boolean]
> = [
  ["marc", undefined, true],
  ["marc", "ledgerline-en/faad42c0a104", false],
  ["ledgerline-en", undefined, false],
  ["ledgerline-en", "marc/8af296ddeca8", false]
];

FOLD_CALIBRATION_CASES.forEach(([corpus, model, expected]) => {
  test(`fold calibrations for ${corpus} with model ${model ?? "none"}: ${expected}`, () => {
    assert.equal(usesFoldCalibrations(corpus, model), expected);
  });
});
