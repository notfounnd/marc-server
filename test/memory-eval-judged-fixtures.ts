import type { EvalDataset } from "../scripts/memory-eval/dataset.js";
import {
  dataset,
  THREAD_RULES,
  THREAD_SETTINGS,
  THREAD_TOKEN
} from "./memory-eval-capture-fixtures.js";

/** Every fixture thread is judged in every case, so the variants can reach a verdict. */
export const judgedDataset: EvalDataset = {
  ...dataset,
  cases: [
    {
      ...dataset.cases[0],
      judgments: { [THREAD_TOKEN]: 3, [THREAD_SETTINGS]: 1, [THREAD_RULES]: 0 }
    },
    {
      ...dataset.cases[1],
      judgments: { [THREAD_TOKEN]: 0, [THREAD_SETTINGS]: 3, [THREAD_RULES]: 2 }
    },
    {
      ...dataset.cases[2],
      judgments: { [THREAD_TOKEN]: 0, [THREAD_SETTINGS]: 0, [THREAD_RULES]: 3 }
    }
  ]
};
