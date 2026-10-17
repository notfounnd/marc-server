export type RelevanceGrade = 0 | 1 | 2 | 3;

export type EvalCaseStyle =
  | "direct"
  | "indirect"
  | "implicit"
  | "typo"
  | "overcorrection-control"
  | "negative";

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
  judgments: Record<string, RelevanceGrade>;
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
  | "pinned-thread-missing";

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
};

type CaseRule = (evalCase: EvalCase, context: RuleContext) => ValidationIssue[];

const VALID_GRADES: ReadonlySet<number> = new Set([0, 1, 2, 3]);
const TARGET_GRADE: RelevanceGrade = 3;
const RELEVANT_GRADE = 2;
const INTERPRETATION_STYLES: ReadonlySet<EvalCaseStyle> = new Set([
  "typo",
  "overcorrection-control"
]);

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
  return Object.entries(evalCase.judgments)
    .filter(([, grade]) => !VALID_GRADES.has(grade))
    .map(([threadId, grade]) =>
      issueFor(evalCase, "grade-out-of-range", `thread ${threadId} has grade ${grade}`)
    );
}

function missingTargetRule(evalCase: EvalCase): ValidationIssue[] {
  if (isNegative(evalCase)) return [];
  const hasTarget = Object.values(evalCase.judgments).includes(TARGET_GRADE);
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
  return Object.entries(evalCase.judgments)
    .filter(([, grade]) => grade >= RELEVANT_GRADE)
    .map(([threadId, grade]) =>
      issueFor(
        evalCase,
        "negative-with-relevant-judgment",
        `negative case has thread ${threadId} with grade ${grade}`
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

const CASE_RULES: readonly CaseRule[] = [
  duplicateIdRule,
  judgmentThreadRule,
  gradeRangeRule,
  missingTargetRule,
  negativeRelevantRule,
  expectedInterpretationRule,
  overlapRule
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

export function validateDataset(
  dataset: EvalDataset,
  corpus: CorpusIndex
): ValidationResult {
  const context: RuleContext = {
    corpus,
    duplicatedIds: duplicatedIdsOf(dataset.cases)
  };
  const issues = dataset.cases.flatMap((evalCase) =>
    CASE_RULES.flatMap((rule) => rule(evalCase, context))
  );
  return { issues };
}
