import { SCOPE_RERANK_BUDGET } from "../../src/core/memory/deep-scope.js";

/** The E4 protocol: fourteen deep cases, four unscoped and ten scoped. Fixed before any capture (plan, Avaliação). */
export const DEEP_CASE_COUNTS = { total: 14, unscoped: 4, scoped: 10 } as const;

/** Success@5 of the adopted configuration, in at least this many of the fourteen cases. */
export const REQUIRED_SUCCESS = 12;

/** The largest budget of a recuo: B' is an integer below the core budget B (criterion 5, domain 1 <= B' < B). */
export const MAX_DEEP_BUDGET = SCOPE_RERANK_BUDGET - 1;

export const DEEP_BUDGET_DOMAIN_MESSAGE = `the deep budget must be an integer from 1 to ${MAX_DEEP_BUDGET}, below the core budget ${SCOPE_RERANK_BUDGET}`;

/** True when a budget is in the domain of a recuo: an integer from 1 to B - 1. */
export function isValidDeepBudget(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_DEEP_BUDGET;
}

/** Refuses a budget outside its domain. An absent budget is valid: it means no recuo was given. */
export function assertDeepBudget(deepBudget: number | undefined): void {
  if (deepBudget === undefined || isValidDeepBudget(deepBudget)) return;
  throw new Error(`${DEEP_BUDGET_DOMAIN_MESSAGE}; it was ${deepBudget}.`);
}

export type ProtocolCase = { scoped: boolean; scopePassages: number | null };

export type ProtocolReport = {
  deepCases: number;
  unscopedCases: number;
  scopedCases: number;
  /** Scoped cases whose scope holds more passages than the budget B. The budget is the core's, not a variant's. */
  scopedAboveBudget: number;
  budget: number;
  /** Set when the cases do not match the protocol. The gate is then not applied, and the diagnostic is kept. */
  protocolIncomplete: boolean;
  reasons: string[];
};

export function protocolOf(cases: readonly ProtocolCase[], budget: number): ProtocolReport {
  const scoped = cases.filter((item) => item.scoped);
  const scopedAboveBudget = scoped.filter((item) => (item.scopePassages ?? 0) > budget).length;
  const report = {
    deepCases: cases.length,
    unscopedCases: cases.length - scoped.length,
    scopedCases: scoped.length,
    scopedAboveBudget,
    budget
  };
  const reasons = reasonsOf(report);
  return { ...report, protocolIncomplete: reasons.length > 0, reasons };
}

function reasonsOf(report: Omit<ProtocolReport, "protocolIncomplete" | "reasons">): string[] {
  return [
    ...(report.deepCases === DEEP_CASE_COUNTS.total
      ? []
      : [`deep cases are ${report.deepCases}, expected ${DEEP_CASE_COUNTS.total}`]),
    ...(report.unscopedCases === DEEP_CASE_COUNTS.unscoped
      ? []
      : [`unscoped cases are ${report.unscopedCases}, expected ${DEEP_CASE_COUNTS.unscoped}`]),
    ...(report.scopedCases === DEEP_CASE_COUNTS.scoped
      ? []
      : [`scoped cases are ${report.scopedCases}, expected ${DEEP_CASE_COUNTS.scoped}`]),
    ...(report.scopedAboveBudget > 0
      ? []
      : [`no scoped case has more than ${report.budget} passages in its scope`])
  ];
}

export type GateCase = {
  /** Success@5 of the adopted variant. Null when the adopted variant is incomplete in the case. */
  successAdopted: boolean | null;
  /** True when the case is incomplete in any variant, or has a missing quote. */
  incomplete: boolean;
  /** Every result of the adopted variant respects the scope. */
  scopeConformAdopted: boolean;
};

export type GateReport = {
  applied: boolean;
  /** Null when the gate is not applied. */
  passed: boolean | null;
  /** Cases where the adopted variant succeeds at five. */
  successAdopted: number;
  requiredSuccess: number;
  incompleteCases: number;
  scopeConformAdopted: boolean;
};

/**
 * The quality gate of the adopted configuration: DEEP, or the recuo DEEP_BUDGET when a budget was given. It is
 * not applied when the protocol is incomplete; then only the counts are kept.
 */
export function gateOf(protocol: ProtocolReport, cases: readonly GateCase[]): GateReport {
  const successAdopted = cases.filter((item) => item.successAdopted === true).length;
  const incompleteCases = cases.filter((item) => item.incomplete).length;
  const scopeConformAdopted = cases.every((item) => item.scopeConformAdopted);
  const applied = !protocol.protocolIncomplete;
  const passed =
    applied && successAdopted >= REQUIRED_SUCCESS && incompleteCases === 0 && scopeConformAdopted;
  return {
    applied,
    passed: applied ? passed : null,
    successAdopted,
    requiredSuccess: REQUIRED_SUCCESS,
    incompleteCases,
    scopeConformAdopted
  };
}
