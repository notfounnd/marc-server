import { isNonThreadGroup } from "./dataset.js";

/**
 * The cells that a judged depth needs: for a group, every layer up to the depth where the capture
 * holds its passages, and layer 0 for a thread (its summary). The worksheet asks these cells and the
 * evaluation requires them, so both read the same rule. A cell is graded only by a judgment of its own
 * layer: a grade of layer 0 never stands in for a layer that the capture holds and nobody judged.
 */
export type JudgedLayer = 0 | 1 | 2;

const LAYERS: readonly JudgedLayer[] = [0, 1, 2];

export type RequiredCell = { groupId: string; layer: JudgedLayer };

/**
 * Whether the summary grade of a group (layer 0) already saturates it: a 3 is its top grade, so its
 * layers 1 and 2 are not asked, in the worksheet or in the completeness of any variant. Only grades
 * already in the dataset count; a summary judged in the current round does not saturate the worksheet.
 */
export function saturatedOf(judgments: Readonly<Record<string, number>>, groupId: string): boolean {
  return judgments[groupId] === 3;
}

/**
 * The layers of one group that must carry a judgment at the given depth. A saturated group needs
 * layer 0 only. The worksheet and the evaluation both call this function.
 */
export function requiredLayersOf(
  groupId: string,
  depth: number,
  presentLayers: ReadonlySet<number>,
  saturated = false
): JudgedLayer[] {
  return LAYERS.filter(
    (layer) =>
      layer <= depth &&
      (presentLayers.has(layer) || isThreadSummary(groupId, layer)) &&
      (layer === 0 || !saturated)
  );
}

/** The layers that the capture holds for each group: `{ groupId: layers }`, as the replay stores them. */
export function presentLayersOf(
  records: readonly { threadId: string; layer?: number }[]
): Record<string, number[]> {
  const byGroup = new Map<string, Set<number>>();
  for (const record of records) {
    const layers = byGroup.get(record.threadId) ?? new Set<number>();
    layers.add(record.layer ?? 0);
    byGroup.set(record.threadId, layers);
  }
  return Object.fromEntries([...byGroup].map(([groupId, layers]) => [groupId, [...layers].sort()]));
}

function isThreadSummary(groupId: string, layer: number): boolean {
  if (layer !== 0) return false;
  return !isNonThreadGroup(groupId);
}
