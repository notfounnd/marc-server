import type { DeepReport, CaseReport } from "./deep-run.js";
import { DEEP_VARIANTS, type DeepVariantId } from "./deep-variants.js";

/** The Markdown of a deep report: the adopted variant, the protocol, the gate, the summary and one row per case. */
export function renderDeepMarkdown(report: DeepReport): string {
  return [
    `# Deep run of ${report.corpus}, capture ${report.captureId}`,
    "",
    adoptedLines(report),
    "",
    protocolLines(report),
    "",
    gateLines(report),
    "",
    summaryLines(report),
    "",
    "## Cases",
    "",
    tableHeader(),
    ...report.cases.map(caseRow),
    ""
  ].join("\n");
}

function adoptedLines(report: DeepReport): string {
  const budget = report.deepBudget === null ? "none" : String(report.deepBudget);
  return [
    "## Adopted configuration",
    "",
    `- adopted variant: ${report.adoptedVariant} (deepBudget ${budget})`,
    "- DEEP is the baseline of comparison with B=232; it is not the approval of the adopted variant."
  ].join("\n");
}

function protocolLines(report: DeepReport): string {
  const protocol = report.protocol;
  const reasons = protocol.reasons.length === 0 ? "none" : protocol.reasons.join("; ");
  return [
    "## Protocol",
    "",
    `- deep cases: ${protocol.deepCases} (unscoped ${protocol.unscopedCases}, scoped ${protocol.scopedCases})`,
    `- scoped cases above B=${protocol.budget}: ${protocol.scopedAboveBudget}`,
    `- protocolIncomplete: ${protocol.protocolIncomplete}`,
    `- reasons: ${reasons}`
  ].join("\n");
}

function gateLines(report: DeepReport): string {
  const gate = report.gate;
  const passed = gate.passed === null ? "not applied" : String(gate.passed);
  return [
    "## Gate",
    "",
    `- gate of ${report.adoptedVariant}: applied ${gate.applied}; passed: ${passed}`,
    `- Success@5 of ${report.adoptedVariant}: ${gate.successAdopted} of ${report.protocol.deepCases} (required ${gate.requiredSuccess})`,
    `- incomplete cases: ${gate.incompleteCases}`,
    `- scope conformance of ${report.adoptedVariant}: ${gate.scopeConformAdopted}`
  ].join("\n");
}

function summaryLines(report: DeepReport): string {
  const summary = report.summary;
  const success = DEEP_VARIANTS.map((id) => `${id} ${summary.success[id] ?? 0}`).join(", ");
  const incomplete = DEEP_VARIANTS.map((id) => `${id} ${incompleteText(summary.incomplete[id])}`).join("; ");
  const failures = Object.entries(summary.failures)
    .map(([name, count]) => `${name} ${count}`)
    .join(", ");
  return [
    "## Summary",
    "",
    `- Success@5 (complete cases), baseline: ${success}`,
    `- Success@5 of ${report.adoptedVariant} (complete cases): ${summary.successAdopted}`,
    `- incomplete by variant and reason: ${incomplete}`,
    `- incomplete cases by reason: ${incompleteText(summary.incompleteCases)}`,
    `- failure classes of ${report.adoptedVariant}: ${failures.length === 0 ? "none" : failures}`,
    `- cases with ordering also truncated: ${summary.alsoTruncated}`,
    `- cases where DEEP and DEEP_ALL differ in the first five: ${summary.deepDiffersFromDeepAll}`
  ].join("\n");
}

function incompleteText(counts: Partial<Record<string, number>> | undefined): string {
  const entries = Object.entries(counts ?? {});
  if (entries.length === 0) return "0";
  return entries.map(([reason, count]) => `${reason} ${count}`).join(", ");
}

function tableHeader(): string {
  return [
    "| case | scope | scopePassages | truncated | DEEP (baseline) | DEEP_ALL | DEEP_COSINE | DEEP_BUDGET | adopted | saturated | class | alsoTruncated |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  ].join("\n");
}

function caseRow(item: CaseReport): string {
  const cells = [
    item.id,
    scopeText(item),
    item.scopePassages === null ? "-" : String(item.scopePassages),
    item.truncated ? "yes" : "no",
    ...DEEP_VARIANTS.map((id) => variantText(item, id)),
    adoptedText(item),
    item.saturatedAdopted === null ? "-" : String(item.saturatedAdopted),
    item.failure?.class ?? "-",
    item.failure?.alsoTruncated === true ? "yes" : "no"
  ];
  return `| ${cells.join(" | ")} |`;
}

function scopeText(item: CaseReport): string {
  if (!item.scoped) return "unscoped";
  const types = item.sourceTypes === null ? "" : ` [${item.sourceTypes.join(",")}]`;
  return `${item.threadId ?? ""}${types}`;
}

function variantText(item: CaseReport, id: DeepVariantId): string {
  const metrics = item.variants[id];
  if (metrics === undefined) return "-";
  if (metrics.status === "incomplete") return `incomplete (${metrics.reason ?? "unknown"})`;
  return metrics.success ? "success" : "failure";
}

function adoptedText(item: CaseReport): string {
  if (item.successAdopted === null) return "incomplete";
  return item.successAdopted ? "success" : "failure";
}
