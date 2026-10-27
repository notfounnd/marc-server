import type { MemorySearchDepth } from "../../src/core/memory/types.js";
import { markdownToIndexText } from "../../src/core/memory/sources/markdown-text.js";

export type RelevanceGrade = 0 | 1 | 2 | 3;

/** Layers that carry judgments of their own. Layer 0 judgments are `EvalCase.judgments`. */
export type JudgedLayer = 1 | 2;

/**
 * Judgments of layers 1 and 2, keyed by group: a thread id, `@rules`, or `@document/<sourcePath>`.
 * A group without a judgment in a layer is not judged there.
 */
export type LayerJudgments = Partial<Record<JudgedLayer, Record<string, RelevanceGrade>>>;

export type EvalCaseStyle =
  | "direct"
  | "indirect"
  | "implicit"
  | "typo"
  | "overcorrection-control"
  | "negative"
  | "layer"
  | "adaptive-trap";

/** A literal quote of the text that answers the query, found in one source file. */
export type EvidenceQuote = {
  /** Path of the source inside the pinned corpus, e.g. `threads/<id>/artifacts/x.md` or `RULES.md`. */
  sourcePath: string;
  /** Literal text, 5 to 40 words. Recognised by its content, not by section lines. */
  quote: string;
};

export type EvalCase = {
  id: string;
  family: string;
  style: EvalCaseStyle;
  query: string;
  queryMode: "auto" | "literal";
  expectedInterpretation?: {
    effectiveQuery: string;
    suggestedQuery?: string;
  };
  /** Layer 0 grades, keyed by group id (the thread id). */
  judgments: Record<string, RelevanceGrade>;
  /** Grades of layers 1 and 2. Absent in datasets that judge layer 0 only. */
  layerJudgments?: LayerJudgments;
  /** Required for the `layer` and `adaptive-trap` styles: where the answer lives. */
  evidence?: EvidenceQuote[];
  origin: string;
};

export type EvalDataset = {
  schemaVersion: 1;
  corpus: "marc" | "ledgerline-en";
  cases: EvalCase[];
};

/** Closed threads of a corpus: threadId mapped to the SUMMARY.md markdown. */
export type CorpusIndex = ReadonlyMap<string, string>;

/**
 * Origins whose query text was migrated as a historical record. Their cases
 * are exempt from the summary overlap check.
 */
export const HISTORICAL_ORIGINS = [
  "baseline-2026-08-04",
  "baseline-controls",
  "memory-quality-v4"
] as const;

export const OVERLAP_MIN_WORDS = 4;

export type ValidationRule =
  | "duplicate-id"
  | "judgment-thread-not-closed"
  | "grade-out-of-range"
  | "missing-target-judgment"
  | "negative-with-relevant-judgment"
  | "missing-expected-interpretation"
  | "query-overlaps-summary"
  | "pinned-thread-missing"
  | "missing-evidence"
  | "quote-length"
  | "evidence-source-missing"
  | "quote-not-in-source"
  | "layer-judgment-group-missing";

/** Group ids of the layer-1 sources that are not threads. */
export const RULES_GROUP = "@rules";
export const RULES_PATH = "RULES.md";
export const DOCUMENT_GROUP_PREFIX = "@document/";

/** `@rules` and `@document/<sourcePath>` are groups of the layer-1 sources, not threads. */
export function isNonThreadGroup(groupId: string): boolean {
  return groupId === RULES_GROUP || groupId.startsWith(DOCUMENT_GROUP_PREFIX);
}

/** Frozen corpus of a memory-eval dataset: the thread ids that its captures and judgments refer to. */
export type PinnedCorpus = {
  schemaVersion: 1;
  corpus: "marc" | "ledgerline-en";
  threadIds: string[];
};

export type ValidationIssue = {
  rule: ValidationRule;
  caseId: string;
  detail: string;
};

export type ValidationResult = {
  issues: ValidationIssue[];
};

type RuleContext = {
  corpus: CorpusIndex;
  duplicatedIds: ReadonlySet<string>;
  /** Source path to markdown text, for the evidence quotes of the pinned corpus. */
  sources: ReadonlyMap<string, string>;
};

type CaseRule = (evalCase: EvalCase, context: RuleContext) => ValidationIssue[];

const VALID_GRADES: ReadonlySet<number> = new Set([0, 1, 2, 3]);
const TARGET_GRADE: RelevanceGrade = 3;
const RELEVANT_GRADE = 2;
const INTERPRETATION_STYLES: ReadonlySet<EvalCaseStyle> = new Set([
  "typo",
  "overcorrection-control"
]);
const EVIDENCE_STYLES: ReadonlySet<EvalCaseStyle> = new Set(["layer", "adaptive-trap"]);
export const QUOTE_MIN_WORDS = 5;
export const QUOTE_MAX_WORDS = 40;

/** Normalised text of the E3 rule `contém`: markdown reduced to index text, whitespace joined, lowercase. */
export function normalizedIndexText(text: string): string {
  return markdownToIndexText(text).replace(/\s+/g, " ").trim().toLowerCase();
}

/** The E3 rule `contém`: the quote lies whole inside the passage, after normalisation of both. */
export function containsQuote(passage: string, quote: string): boolean {
  return normalizedIndexText(passage).includes(normalizedIndexText(quote));
}

/**
 * The grades that count at a depth d: for each group, the highest grade among layer 0 and the
 * layers 1..d that judge it. A group judged in no layer up to d is absent, never graded 0.
 */
export function effectiveJudgments(
  evalCase: EvalCase,
  depth: MemorySearchDepth
): Record<string, RelevanceGrade> {
  const sources = [evalCase.judgments, ...judgedLayersUpTo(evalCase, depth)];
  const groupIds = [...new Set(sources.flatMap((judgments) => Object.keys(judgments)))];
  return Object.fromEntries(
    groupIds.map((groupId) => [groupId, highestGradeOf(sources, groupId)])
  );
}

function judgedLayersUpTo(
  evalCase: EvalCase,
  depth: MemorySearchDepth
): Array<Record<string, RelevanceGrade>> {
  const layers: JudgedLayer[] = [1, 2];
  return layers
    .filter((layer) => layer <= depth)
    .map((layer) => evalCase.layerJudgments?.[layer] ?? {});
}

function highestGradeOf(
  sources: ReadonlyArray<Record<string, RelevanceGrade>>,
  groupId: string
): RelevanceGrade {
  const grades = sources.map((judgments) => judgments[groupId] ?? -1);
  return Math.max(...grades) as RelevanceGrade;
}

/** Every grade of a case, with the layer it was given in (0 for `judgments`). */
function allGradeEntries(evalCase: EvalCase): Array<[string, RelevanceGrade]> {
  const layers = [evalCase.judgments, evalCase.layerJudgments?.[1] ?? {}, evalCase.layerJudgments?.[2] ?? {}];
  return layers.flatMap((judgments) => Object.entries(judgments));
}

export function isHistoricalOrigin(origin: string): boolean {
  return (HISTORICAL_ORIGINS as readonly string[]).includes(origin);
}

export function normalizeForOverlap(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

/** Returns the first run of `minWords` consecutive words shared by query and summary. */
export function findSharedWordRun(
  query: string,
  summary: string,
  minWords: number = OVERLAP_MIN_WORDS
): string | undefined {
  const queryWords = normalizeForOverlap(query);
  const summaryText = ` ${normalizeForOverlap(summary).join(" ")} `;
  const runCount = Math.max(0, queryWords.length - minWords + 1);
  const runs = Array.from({ length: runCount }, (_, start) =>
    queryWords.slice(start, start + minWords).join(" ")
  );
  return runs.find((run) => summaryText.includes(` ${run} `));
}

function issueFor(
  evalCase: EvalCase,
  rule: ValidationRule,
  detail: string
): ValidationIssue {
  return { rule, caseId: evalCase.id, detail };
}

function isNegative(evalCase: EvalCase): boolean {
  return evalCase.style === "negative";
}

function duplicateIdRule(
  evalCase: EvalCase,
  context: RuleContext
): ValidationIssue[] {
  if (!context.duplicatedIds.has(evalCase.id)) return [];
  return [
    issueFor(evalCase, "duplicate-id", `id ${evalCase.id} is declared more than once`)
  ];
}

function judgmentThreadRule(
  evalCase: EvalCase,
  context: RuleContext
): ValidationIssue[] {
  return Object.keys(evalCase.judgments)
    .filter((threadId) => !context.corpus.has(threadId))
    .map((threadId) =>
      issueFor(
        evalCase,
        "judgment-thread-not-closed",
        `thread ${threadId} is not a closed thread in the corpus`
      )
    );
}

function gradeRangeRule(evalCase: EvalCase): ValidationIssue[] {
  return allGradeEntries(evalCase)
    .filter(([, grade]) => !VALID_GRADES.has(grade))
    .map(([groupId, grade]) =>
      issueFor(evalCase, "grade-out-of-range", `group ${groupId} has grade ${grade}`)
    );
}

function missingTargetRule(evalCase: EvalCase): ValidationIssue[] {
  if (isNegative(evalCase)) return [];
  const hasTarget = allGradeEntries(evalCase).some(([, grade]) => grade === TARGET_GRADE);
  if (hasTarget) return [];
  return [
    issueFor(
      evalCase,
      "missing-target-judgment",
      "a non-negative case needs at least one grade 3 thread"
    )
  ];
}

function negativeRelevantRule(evalCase: EvalCase): ValidationIssue[] {
  if (!isNegative(evalCase)) return [];
  return allGradeEntries(evalCase)
    .filter(([, grade]) => grade >= RELEVANT_GRADE)
    .map(([groupId, grade]) =>
      issueFor(
        evalCase,
        "negative-with-relevant-judgment",
        `negative case has group ${groupId} with grade ${grade}`
      )
    );
}

/** Whether a layer-1 or layer-2 group has content in the pinned corpus, by its corpus paths. */
function groupHasLayerContent(
  groupId: string,
  layer: JudgedLayer,
  context: RuleContext
): boolean {
  if (groupId === RULES_GROUP) return layer === 1 && context.sources.has(RULES_PATH);
  if (groupId.startsWith(DOCUMENT_GROUP_PREFIX)) {
    const sourcePath = groupId.slice(DOCUMENT_GROUP_PREFIX.length);
    return layer === 1 && context.sources.has(sourcePath);
  }
  if (!context.corpus.has(groupId)) return false;
  if (layer === 2) return context.sources.has(`threads/${groupId}/CHAT.md`);
  const artifactPrefix = `threads/${groupId}/artifacts/`;
  return [...context.sources.keys()].some((sourcePath) => sourcePath.startsWith(artifactPrefix));
}

function layerJudgmentGroupRule(evalCase: EvalCase, context: RuleContext): ValidationIssue[] {
  const layers: JudgedLayer[] = [1, 2];
  return layers.flatMap((layer) =>
    Object.keys(evalCase.layerJudgments?.[layer] ?? {})
      .filter((groupId) => !groupHasLayerContent(groupId, layer, context))
      .map((groupId) =>
        issueFor(
          evalCase,
          "layer-judgment-group-missing",
          `group ${groupId} has no content in layer ${layer} of the pinned corpus`
        )
      )
  );
}

function expectedInterpretationRule(evalCase: EvalCase): ValidationIssue[] {
  if (!INTERPRETATION_STYLES.has(evalCase.style)) return [];
  if (evalCase.expectedInterpretation !== undefined) return [];
  return [
    issueFor(
      evalCase,
      "missing-expected-interpretation",
      `style ${evalCase.style} requires expectedInterpretation`
    )
  ];
}

function overlapRule(evalCase: EvalCase, context: RuleContext): ValidationIssue[] {
  if (isNegative(evalCase)) return [];
  if (isHistoricalOrigin(evalCase.origin)) return [];
  return Object.entries(evalCase.judgments)
    .filter(([, grade]) => grade === TARGET_GRADE)
    .flatMap(([threadId]) => {
      const summary = context.corpus.get(threadId);
      if (summary === undefined) return [];
      const run = findSharedWordRun(evalCase.query, summary);
      if (run === undefined) return [];
      return [
        issueFor(
          evalCase,
          "query-overlaps-summary",
          `query shares "${run}" with the SUMMARY.md of ${threadId}`
        )
      ];
    });
}

function missingEvidenceRule(evalCase: EvalCase): ValidationIssue[] {
  if (!EVIDENCE_STYLES.has(evalCase.style)) return [];
  if ((evalCase.evidence ?? []).length > 0) return [];
  return [
    issueFor(evalCase, "missing-evidence", `style ${evalCase.style} requires evidence`)
  ];
}

function quoteLengthRule(evalCase: EvalCase): ValidationIssue[] {
  return (evalCase.evidence ?? [])
    .map((item) => ({ item, words: normalizeForOverlap(item.quote).length }))
    .filter(({ words }) => words < QUOTE_MIN_WORDS || words > QUOTE_MAX_WORDS)
    .map(({ item, words }) =>
      issueFor(
        evalCase,
        "quote-length",
        `quote of ${item.sourcePath} has ${words} words; ${QUOTE_MIN_WORDS} to ${QUOTE_MAX_WORDS} are allowed`
      )
    );
}

function quoteInSourceRule(evalCase: EvalCase, context: RuleContext): ValidationIssue[] {
  return (evalCase.evidence ?? []).flatMap((item) => {
    const source = context.sources.get(item.sourcePath);
    if (source === undefined) {
      return [
        issueFor(
          evalCase,
          "evidence-source-missing",
          `source ${item.sourcePath} is not in the pinned corpus`
        )
      ];
    }
    if (containsQuote(source, item.quote)) return [];
    return [
      issueFor(evalCase, "quote-not-in-source", `quote is not in ${item.sourcePath}`)
    ];
  });
}

const CASE_RULES: readonly CaseRule[] = [
  duplicateIdRule,
  judgmentThreadRule,
  gradeRangeRule,
  missingTargetRule,
  negativeRelevantRule,
  expectedInterpretationRule,
  overlapRule,
  missingEvidenceRule,
  quoteLengthRule,
  quoteInSourceRule,
  layerJudgmentGroupRule
];

function duplicatedIdsOf(cases: readonly EvalCase[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  cases.forEach((evalCase) => {
    if (seen.has(evalCase.id)) duplicated.add(evalCase.id);
    seen.add(evalCase.id);
  });
  return duplicated;
}

/**
 * Crosses the pinned thread ids with the closed threads that exist today. A
 * pinned thread that is missing or not closed is reported, and it is left out
 * of the validation corpus.
 */
export function buildValidationCorpus(
  pinned: PinnedCorpus,
  closedThreads: CorpusIndex
): { corpus: CorpusIndex; issues: ValidationIssue[] } {
  const corpus = new Map<string, string>();
  const issues: ValidationIssue[] = [];
  for (const threadId of pinned.threadIds) {
    const markdown = closedThreads.get(threadId);
    if (markdown === undefined) {
      issues.push({
        rule: "pinned-thread-missing",
        caseId: "corpus",
        detail: `pinned thread ${threadId} is missing or not closed`
      });
      continue;
    }
    corpus.set(threadId, markdown);
  }
  return { corpus, issues };
}

/**
 * Validates the cases against the closed threads (`corpus`) and against the source files
 * that their evidence quotes name (`sources`, keyed by the corpus path).
 */
export function validateDataset(
  dataset: EvalDataset,
  corpus: CorpusIndex,
  sources: ReadonlyMap<string, string> = new Map()
): ValidationResult {
  const context: RuleContext = {
    corpus,
    duplicatedIds: duplicatedIdsOf(dataset.cases),
    sources
  };
  const issues = dataset.cases.flatMap((evalCase) =>
    CASE_RULES.flatMap((rule) => rule(evalCase, context))
  );
  return { issues };
}
