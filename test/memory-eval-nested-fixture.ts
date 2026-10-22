import type { TestContext } from "node:test";
import type { CaptureFile } from "../scripts/memory-eval/capture-types.js";
import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import {
  createFakes,
  dataset,
  fixtureThreadsRoot,
  readCaptureFile,
  runCapture,
  tempDirectory,
  THREAD_RULES,
  THREAD_SETTINGS,
  THREAD_TOKEN
} from "./memory-eval-capture-fixtures.js";

/**
 * The fixture cases, judged on every fixture thread, each copied into three families of
 * its own: nine families over five folds. The three-case fixture leaves too few non-empty
 * folds for the nested H7 fit, which needs them on both sides of every split.
 */
export const NESTED_JUDGED_DATASET: EvalDataset = {
  ...dataset,
  cases: dataset.cases.flatMap((item) =>
    [1, 2, 3].map((copy) => ({
      ...item,
      id: `${item.id}-${copy}`,
      family: `${item.family}-${copy}`,
      judgments: {
        [THREAD_TOKEN]: 3,
        [THREAD_SETTINGS]: 2,
        [THREAD_RULES]: 0
      }
    }))
  )
};

/** The capture of the fixture corpus, built with the given dataset and read back. */
export async function captureOf(
  t: TestContext,
  judged: EvalDataset
): Promise<CaptureFile> {
  const { result } = await runCapture({
    threadsRoot: await fixtureThreadsRoot(t),
    outputRoot: await tempDirectory(t),
    fakes: createFakes(),
    dataset: judged
  });
  return readCaptureFile(result.captureDir);
}
