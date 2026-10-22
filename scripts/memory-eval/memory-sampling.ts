import { defaultMemoryInferenceManager } from "../../src/core/memory/inference-manager.js";
import type { WorkspaceInfo } from "../../src/core/types.js";

/**
 * Memory of the measured processes, for the model latency (E2, A4). The worker part
 * reads every active inference worker of the workspace through the memoryUsage
 * action. The harness part is the RSS of this
 * process, read on a timer, which keeps the largest reading (the peak).
 */

/** The RSS of each active inference worker of the workspace, by role, in bytes. */
export async function workerRssBytes(info: WorkspaceInfo): Promise<Record<string, number>> {
  const rss: Record<string, number> = {};
  for (const worker of defaultMemoryInferenceManager.activeWorkers(info)) {
    const reply = await defaultMemoryInferenceManager.run(info, worker.role, {
      action: "memoryUsage"
    });
    if (!("memoryUsage" in reply)) continue;
    rss[worker.role] = reply.memoryUsage.rss;
  }
  return rss;
}

export type RssSampler = {
  /** Reads once more and keeps the larger value. */
  sample: () => void;
  /** The largest reading so far, in bytes. */
  peakBytes: () => number;
  /** Stops the timer, if one runs, reads once more, and returns the peak. */
  stop: () => number;
};

/**
 * Keeps the largest reading of `read`, in bytes. When `intervalMs` is given, a timer
 * reads on that period until stop is called. The first reading is taken at creation.
 */
export function createRssSampler(
  read: () => number = () => process.memoryUsage().rss,
  intervalMs?: number
): RssSampler {
  let peak = read();
  const timer =
    intervalMs === undefined
      ? undefined
      : setInterval(() => {
          peak = Math.max(peak, read());
        }, intervalMs);
  return {
    sample: () => {
      peak = Math.max(peak, read());
    },
    peakBytes: () => peak,
    stop: () => {
      if (timer !== undefined) clearInterval(timer);
      peak = Math.max(peak, read());
      return peak;
    }
  };
}
