import type { CaptureFile, CapturedRecord } from "./capture-types.js";
import { ADAPTIVE_FUNNEL_NAMES, type FunnelVariantName } from "./funnel-variants.js";
import { funnelInputOf } from "./replay.js";
import { exhaustiveReachOf, type FunnelParams } from "./variants.js";
import type { MemorySearchDepth } from "../../src/core/memory/types.js";

/**
 * The exhaustive reach of the adaptive variants, by case id and then by group id. Each point of the
 * grid contributes, for every group, the deepest step that requested it; the union over the grid keeps
 * the largest depth. Only the worksheet calls this: its runs take every step, so no stop point is missed.
 */
export function exhaustiveReachesOf(input: {
  capture: CaptureFile;
  variants: readonly string[];
  grid: readonly FunnelParams[];
  vectors?: ReadonlyMap<string, number[]>;
}): Map<string, Map<string, MemorySearchDepth>> {
  const adaptive = input.variants.filter(isAdaptiveName);
  const records = new Map(
    input.capture.records.map((record): [string, CapturedRecord] => [record.recordId, record])
  );
  const reaches = new Map<string, Map<string, MemorySearchDepth>>();
  for (const captured of input.capture.cases) {
    const funnel = funnelInputOf({ captured, records, vectors: input.vectors });
    const reach = new Map<string, MemorySearchDepth>();
    for (const params of input.grid) {
      for (const name of adaptive) {
        mergeDeepest(reach, exhaustiveReachOf(name, { funnel, funnelParams: params }));
      }
    }
    reaches.set(captured.id, reach);
  }
  return reaches;
}

function isAdaptiveName(name: string): name is FunnelVariantName {
  return (ADAPTIVE_FUNNEL_NAMES as readonly string[]).includes(name);
}

function mergeDeepest(target: Map<string, MemorySearchDepth>, source: ReadonlyMap<string, MemorySearchDepth>): void {
  for (const [groupId, depth] of source) {
    target.set(groupId, Math.max(target.get(groupId) ?? 0, depth) as MemorySearchDepth);
  }
}
