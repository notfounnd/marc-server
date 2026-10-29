import type { MemorySourceType } from "../../src/core/memory/sources/contract.js";
import type { EvalCase, ValidationIssue, ValidationRule } from "./dataset.js";
import { PASSAGE_ID_PATTERN, corpusPathOf, groupIdOfSource } from "./source-group.js";

/** What the `deep` rules read: the closed threads and the pinned source texts. Imported as a type only. */
export type DeepRuleContext = {
  corpus: ReadonlyMap<string, string>;
  sources: ReadonlyMap<string, string>;
};

type DeepCaseRule = (evalCase: EvalCase, context: DeepRuleContext) => ValidationIssue[];

/** Every source type, keyed by type: adding a type to MemorySourceType fails here until it is listed. */
const SOURCE_TYPE_NAMES: Record<MemorySourceType, true> = {
  summary: true,
  artifact: true,
  rules: true,
  document: true,
  chat: true
};
const SOURCE_TYPES: ReadonlySet<string> = new Set(Object.keys(SOURCE_TYPE_NAMES));
/** Threads hold summaries, artifacts and chats only, so a thread scope accepts these three. */
const THREAD_SOURCE_TYPES: ReadonlySet<string> = new Set(["summary", "artifact", "chat"]);
const SCOPED_THREAD_ERROR = "a thread scope accepts only summary, artifact and chat";

function issueFor(evalCase: EvalCase, rule: ValidationRule, detail: string): ValidationIssue {
  return { rule, caseId: evalCase.id, detail };
}

function scopeOnlyDeepRule(evalCase: EvalCase): ValidationIssue[] {
  if (evalCase.style === "deep") return [];
  if (evalCase.scope === undefined && evalCase.passageJudgments === undefined) return [];
  return [
    issueFor(evalCase, "scope-only-deep", `style ${evalCase.style} cannot carry a scope or passage judgments`)
  ];
}

function scopeThreadRule(evalCase: EvalCase, context: DeepRuleContext): ValidationIssue[] {
  const threadId = evalCase.scope?.threadId;
  if (threadId === undefined || context.corpus.has(threadId)) return [];
  return [
    issueFor(evalCase, "scope-thread-not-closed", `scope thread ${threadId} is not a closed thread in the corpus`)
  ];
}

function sourceTypeIssues(evalCase: EvalCase, type: string, threadScoped: boolean): ValidationIssue[] {
  if (!SOURCE_TYPES.has(type))
    return [issueFor(evalCase, "scope-source-types-invalid", `source type ${type} is unknown`)];
  if (threadScoped && !THREAD_SOURCE_TYPES.has(type))
    return [issueFor(evalCase, "scope-source-types-invalid", `${SCOPED_THREAD_ERROR}; ${type} is not one of them`)];
  return [];
}

function scopeSourceTypesRule(evalCase: EvalCase): ValidationIssue[] {
  const types = evalCase.scope?.sourceTypes;
  if (types === undefined) return [];
  if (types.length === 0)
    return [issueFor(evalCase, "scope-source-types-invalid", "sourceTypes must not be empty")];
  const threadScoped = evalCase.scope?.threadId !== undefined;
  return types.flatMap((type) => sourceTypeIssues(evalCase, type, threadScoped));
}

function deepEvidenceOutsideScopeRule(evalCase: EvalCase): ValidationIssue[] {
  const threadId = evalCase.scope?.threadId;
  if (evalCase.style !== "deep" || threadId === undefined) return [];
  return (evalCase.evidence ?? [])
    .filter((item) => groupIdOfSource(item.sourcePath) !== threadId)
    .map((item) =>
      issueFor(
        evalCase,
        "deep-evidence-outside-scope",
        `evidence ${item.sourcePath} is outside the scope thread ${threadId}`
      )
    );
}

function passageEntries(evalCase: EvalCase): Array<[string, number]> {
  return Object.entries(evalCase.passageJudgments ?? {});
}

function passageGradeRule(evalCase: EvalCase): ValidationIssue[] {
  return passageEntries(evalCase)
    .filter(([, grade]) => !Number.isInteger(grade) || grade < 0 || grade > 3)
    .map(([passageId, grade]) =>
      issueFor(evalCase, "passage-grade-out-of-range", `passage ${passageId} has grade ${grade}`)
    );
}

function passageKeyRule(evalCase: EvalCase): ValidationIssue[] {
  return passageEntries(evalCase)
    .filter(([passageId]) => !PASSAGE_ID_PATTERN.test(passageId))
    .map(([passageId]) =>
      issueFor(
        evalCase,
        "passage-judgment-key-invalid",
        `key ${passageId} is not a passageId (sourcePath#16 lowercase hex)`
      )
    );
}

function passageSourceRule(evalCase: EvalCase, context: DeepRuleContext): ValidationIssue[] {
  return passageEntries(evalCase).flatMap(([passageId]) => {
    const match = PASSAGE_ID_PATTERN.exec(passageId);
    if (match === null) return [];
    const sourcePath = corpusPathOf(match[1] ?? "");
    if (context.sources.has(sourcePath)) return [];
    return [
      issueFor(
        evalCase,
        "passage-judgment-unknown-source",
        `passage ${passageId} is not in a source of the pinned corpus`
      )
    ];
  });
}

/** The E4 rules, appended to the case rules of every corpus. Each one reads only what its case declares. */
export const DEEP_CASE_RULES: ReadonlyArray<DeepCaseRule | ((evalCase: EvalCase) => ValidationIssue[])> = [
  scopeOnlyDeepRule,
  scopeThreadRule,
  scopeSourceTypesRule,
  deepEvidenceOutsideScopeRule,
  passageGradeRule,
  passageKeyRule,
  passageSourceRule
];
