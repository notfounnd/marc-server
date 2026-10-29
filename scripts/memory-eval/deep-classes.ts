import type { DepthPool } from "../../src/core/memory/deep-pool.js";
import type { EvidenceMatch } from "./matrix-plan.js";
import type { VariantMetrics } from "./deep-metrics.js";
import { groupIdOfSource } from "./source-group.js";

/** The failure classes of criterion 2, in the order of precedence of the plan. */
export type FailureClass = "segmentation" | "admission/pool" | "cap" | "ordering";

export type FailureDecision = {
  class: FailureClass;
  /** The variant that the class is read against: DEEP for the first two, DEEP_ALL for the cap and the ordering. */
  reference: "DEEP" | "DEEP_ALL";
  /** Ordering only: the evidence lies outside the budget and DEEP_ALL fails too, so both losses are visible. */
  alsoTruncated: boolean;
};

/** What a failing and complete case has: its evidence, the metrics of DEEP and DEEP_ALL, and the pool when unscoped. */
export type FailureInput = {
  scoped: boolean;
  evidence: EvidenceMatch[];
  deep: VariantMetrics;
  deepAll: VariantMetrics;
  /** Passage ids of DEEP in order, all of them: the budget keeps the first `pool` of them. */
  deepRankedIds: string[];
  pool?: DepthPool;
  admittedGroups?: ReadonlySet<string>;
};

type Rule = (input: FailureInput) => FailureDecision | undefined;

/**
 * Classifies one failure. The first condition that holds decides, in this order: segmentation, then
 * admission/pool (unscoped), then cap (scoped and truncated), and ordering otherwise. Each condition is
 * mechanical: none of them reads a grade, so a passage without a grade is never taken for irrelevant.
 */
export function classifyFailure(input: FailureInput): FailureDecision {
  for (const rule of PRECEDENCE) {
    const decision = rule(input);
    if (decision !== undefined) return decision;
  }
  return orderingOf(input);
}

const PRECEDENCE: readonly Rule[] = [segmentationRule, admissionPoolRule, capRule];

/** Segmentation needs every quote unindexable: one indexed quote shows that the answer is in the index. */
function segmentationRule(input: FailureInput): FailureDecision | undefined {
  const allUnindexable =
    input.evidence.length > 0 && input.evidence.every((item) => item.status === "evidence_unindexable");
  if (!allUnindexable) return undefined;
  return { class: "segmentation", reference: "DEEP", alsoTruncated: false };
}

/** Admission/pool needs at least one indexed quote, and none of the indexed quotes held by the consolidated pool. */
function admissionPoolRule(input: FailureInput): FailureDecision | undefined {
  if (input.scoped || input.pool === undefined || input.admittedGroups === undefined) return undefined;
  const admittedGroups = input.admittedGroups;
  const pool = input.pool;
  const indexed = input.evidence.filter((item) => item.status === "indexed");
  if (indexed.length === 0) return undefined;
  const anyHeld = indexed.some((item) => evidenceHeldByPool(item, pool, admittedGroups));
  if (anyHeld) return undefined;
  return { class: "admission/pool", reference: "DEEP", alsoTruncated: false };
}

/** The group of the quote is admitted, and one of its passages that hold the quote is among the consolidated three. */
function evidenceHeldByPool(
  item: EvidenceMatch,
  pool: DepthPool,
  admittedGroups: ReadonlySet<string>
): boolean {
  const groupId = groupIdOfSource(item.sourcePath);
  if (!admittedGroups.has(groupId)) return false;
  return pool.entries.some(
    (entry) =>
      entry.evidence.record.kind === "passage" &&
      entry.evidence.record.threadId === groupId &&
      item.passageIds.includes(entry.evidence.record.passageId)
  );
}

function capRule(input: FailureInput): FailureDecision | undefined {
  if (!input.scoped || !input.deep.truncated) return undefined;
  if (input.deepAll.status !== "ok" || !input.deepAll.success) return undefined;
  return { class: "cap", reference: "DEEP_ALL", alsoTruncated: false };
}

function orderingOf(input: FailureInput): FailureDecision {
  const insideCap = input.evidence.some((item) =>
    item.passageIds.some((passageId) => input.deepRankedIds.includes(passageId))
  );
  const alsoTruncated = input.scoped && input.deep.truncated && !insideCap && !input.deepAll.success;
  return { class: "ordering", reference: "DEEP_ALL", alsoTruncated };
}
