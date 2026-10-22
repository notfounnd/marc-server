import type { CalibrationSet } from "./calibration.js";
import type { FitResult } from "./fit-model.js";
import type { JudgeTable } from "./fit.js";
import type { JudgeName } from "./judge-stage.js";

/**
 * The inputs that a replay reads besides the capture and the dataset. The CLI reads
 * them from the capture directory, and every command that replays variants uses this
 * module to say which input a variant needs and which file to produce when it is missing.
 */
export type ReplayInputs = {
  fit?: FitResult;
  calibrations?: CalibrationSet;
  /** The per-fold calibrations, read only when usesFoldCalibrations says so. */
  foldCalibrations?: readonly CalibrationSet[];
  judgeTables?: Partial<Record<JudgeName, JudgeTable>>;
};

/**
 * Whether H2 reads the calibrations of each external fold. Only marc without `--model`
 * does, so that each case is evaluated with the N2 reference of its own fold. Every
 * other replay, including a corpus evaluated with another model, reads the production set.
 */
export function usesFoldCalibrations(corpusName: string, modelArgument: string | undefined): boolean {
  return corpusName === "marc" && modelArgument === undefined;
}

/** What one variant reads: its fit, its calibrations, and the judge tables of its judge. */
export type VariantRequirements = { fit: boolean; calibrations: boolean; judges: JudgeName[] };

const H1_NEEDS: VariantRequirements = { fit: true, calibrations: false, judges: [] };
const H2_NEEDS: VariantRequirements = { fit: true, calibrations: true, judges: [] };
const QWEN_NEEDS: VariantRequirements = { fit: true, calibrations: false, judges: ["qwen"] };
const KEV_NEEDS: VariantRequirements = { fit: true, calibrations: false, judges: ["kev"] };
const NO_NEEDS: VariantRequirements = { fit: false, calibrations: false, judges: [] };

/** Requirements by variant id. A variant that is not listed reads none of the inputs. */
const REQUIREMENTS: Readonly<Record<string, VariantRequirements>> = {
  H1_CALIBRATED: H1_NEEDS,
  H1_FALLBACK: H1_NEEDS,
  H2_N1: H2_NEEDS,
  H2_N2: H2_NEEDS,
  H7_JUDGE_QWEN: QWEN_NEEDS,
  H7_JUDGE_QWEN_FALLBACK: QWEN_NEEDS,
  H7_JUDGE_KEV: KEV_NEEDS,
  H7_JUDGE_KEV_FALLBACK: KEV_NEEDS
};

/** The union of the requirements of a set of variants. */
export function requirementsOf(variantIds: readonly string[]): VariantRequirements {
  const needs = variantIds.map((id) => REQUIREMENTS[id] ?? NO_NEEDS);
  return {
    fit: needs.some((item) => item.fit),
    calibrations: needs.some((item) => item.calibrations),
    judges: [...new Set(needs.flatMap((item) => item.judges))]
  };
}

/** The files that hold each input, so that a missing input names the one to produce. */
export type InputPaths = {
  fit: string;
  calibrations: string;
  judge: (name: JudgeName) => string;
};

/**
 * Fails with the file to produce when a required input is missing. A replay never runs
 * a variant on a partial input: a missing input is an error, not a skipped variant.
 */
export function assertInputsPresent(
  requirements: VariantRequirements,
  inputs: ReplayInputs,
  paths: InputPaths
): void {
  if (requirements.fit && inputs.fit === undefined) {
    throw new Error(`The variant needs the fit, but ${paths.fit} is missing. Run memory:eval fit first.`);
  }
  if (requirements.calibrations && inputs.calibrations === undefined) {
    throw new Error(
      `The variant needs the calibrations, but ${paths.calibrations} is missing. Run memory:eval calibrate first.`
    );
  }
  for (const name of requirements.judges) {
    if (inputs.judgeTables?.[name] === undefined) {
      throw new Error(
        `The variant needs the ${name} judge scores, but ${paths.judge(name)} is missing. Run memory:eval judge --model ${name} first.`
      );
    }
  }
}

/**
 * `--model` applies the production parameters of another capture to every case. Only a
 * different corpus can validate that reading; on the model's own corpus the external
 * folds of its fit apply, and the command refuses `--model`.
 */
export function assertCrossCorpus(captureCorpus: string, modelCorpus: string): void {
  if (captureCorpus !== modelCorpus) return;
  throw new Error(
    `--model ${modelCorpus} is for cross-corpus validation only. On ${captureCorpus} the external folds of its own fit apply; drop --model.`
  );
}
