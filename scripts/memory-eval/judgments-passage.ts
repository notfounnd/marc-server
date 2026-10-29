import type { EvalDataset, RelevanceGrade } from "./dataset.js";
import { PASSAGE_ID_PATTERN } from "./source-group.js";
import { quadraticKappa } from "./statistics.js";

/** A passage cell: its grade lives in `passageJudgments`, and its key in a rater file is `passage:<passageId>`. */
export type PassageCell = { passageId: string };

/** A grade addition of a passage cell, as `withCellGrades` receives it. */
export type PassageAddition = { cell: PassageCell; grade: RelevanceGrade };

/** Grades keyed by case id, then by cell key. Layer cells and passage cells share the shape. */
export type GradeTable = Record<string, Record<string, RelevanceGrade>>;

const PASSAGE_KEY_PREFIX = "passage:";

export function passageKeyOf(passageId: string): string {
  return `${PASSAGE_KEY_PREFIX}${passageId}`;
}

export function isPassageKey(key: string): boolean {
  return key.startsWith(PASSAGE_KEY_PREFIX);
}

/**
 * Checks one passage key of a rater: the passageId format, and membership in the captured passages
 * when the merge knows them. The membership check is what keeps a grade from a stale passage out.
 */
export function checkPassageKey(input: {
  name: string;
  caseId: string;
  key: string;
  passageIds?: ReadonlySet<string>;
}): void {
  const passageId = input.key.slice(PASSAGE_KEY_PREFIX.length);
  if (!PASSAGE_ID_PATTERN.test(passageId))
    throw new Error(`${input.name}: ${input.caseId} has the key ${input.key}, which is not a passageId.`);
  if (input.passageIds === undefined || input.passageIds.has(passageId)) return;
  throw new Error(`${input.name}: passage ${passageId} of ${input.caseId} is not in the capture.`);
}

/** The passage keys of a rater, as grades by passageId. */
export function passageRaterOf(rater: GradeTable): GradeTable {
  return Object.fromEntries(
    Object.entries(rater).map(([caseId, cells]) => [
      caseId,
      Object.fromEntries(
        Object.entries(cells)
          .filter(([key]) => isPassageKey(key))
          .map(([key, grade]) => [key.slice(PASSAGE_KEY_PREFIX.length), grade])
      )
    ])
  );
}

/** The rater without its passage keys: what the layer merge reads. */
export function withoutPassageKeys(rater: GradeTable): GradeTable {
  return Object.fromEntries(
    Object.entries(rater).map(([caseId, cells]) => [
      caseId,
      Object.fromEntries(Object.entries(cells).filter(([key]) => !isPassageKey(key)))
    ])
  );
}

export function countPassageGrades(rater: GradeTable): number {
  return Object.values(passageRaterOf(rater)).reduce((total, cells) => total + Object.keys(cells).length, 0);
}

export type PassageDivergence = { caseId: string; passageId: string; a: number; b: number };

export type PassageMergeReport = {
  pairs: number;
  kappa: number | null;
  concordant: number;
  divergences: PassageDivergence[];
  unresolved: PassageDivergence[];
  written: Array<{ caseId: string; passageId: string; grade: number }>;
  alreadyPresent: number;
  conflicts: Array<{ caseId: string; passageId: string; existing: number; proposed: number }>;
};

export type PassageMerge = {
  report: PassageMergeReport;
  /** The additions of each case, to be applied by `withCellGrades`. */
  additions: Map<string, PassageAddition[]>;
};

type PassagePair = { caseId: string; passageId: string; a: number; b: number };

/**
 * Merges the passage grades of two raters, in the same way as the layer grades: concordant pairs are
 * written, divergences are written only when the consensus resolves them, and a grade that the dataset
 * already holds is never overwritten.
 */
export function mergePassageGrades(input: {
  dataset: EvalDataset;
  first: GradeTable;
  second: GradeTable;
  consensus: GradeTable;
}): PassageMerge {
  const pairs = pairsOfPassages(input.first, input.second);
  const divergences = pairs.filter((pair) => pair.a !== pair.b);
  const concordant = pairs.filter((pair) => pair.a === pair.b);
  assertConsensusDivergent(entriesOfPassages(input.consensus), divergences);
  const consensusGradeOf = (item: PassagePair): number | undefined =>
    input.consensus[item.caseId]?.[item.passageId];
  const unresolved = divergences.filter((item) => consensusGradeOf(item) === undefined);
  const finals = [
    ...concordant.map((pair) => ({ caseId: pair.caseId, passageId: pair.passageId, grade: pair.a })),
    ...divergences.flatMap((item) => {
      const grade = consensusGradeOf(item);
      return grade === undefined ? [] : [{ caseId: item.caseId, passageId: item.passageId, grade }];
    })
  ];
  const { written, conflicts, alreadyPresent, additions } = applyFinals(input.dataset, finals);
  const kappa = quadraticKappa(pairs.map((pair) => [pair.a, pair.b]));
  return {
    report: {
      pairs: pairs.length,
      kappa,
      concordant: concordant.length,
      divergences: divergences.map(toDivergence),
      unresolved: unresolved.map(toDivergence),
      written,
      alreadyPresent,
      conflicts
    },
    additions
  };
}

function toDivergence(pair: PassagePair): PassageDivergence {
  return { caseId: pair.caseId, passageId: pair.passageId, a: pair.a, b: pair.b };
}

function pairsOfPassages(first: GradeTable, second: GradeTable): PassagePair[] {
  return Object.entries(first).flatMap(([caseId, cells]) =>
    Object.entries(cells).flatMap(([passageId, a]) => {
      const b = second[caseId]?.[passageId];
      if (b === undefined) return [];
      return [{ caseId, passageId, a, b }];
    })
  );
}

function entriesOfPassages(table: GradeTable): PassagePair[] {
  return Object.entries(table).flatMap(([caseId, cells]) =>
    Object.entries(cells).map(([passageId, grade]) => ({ caseId, passageId, a: grade, b: grade }))
  );
}

function assertConsensusDivergent(entries: PassagePair[], divergences: PassagePair[]): void {
  const touchesNoDivergence = entries.find(
    (entry) =>
      !divergences.some((item) => item.caseId === entry.caseId && item.passageId === entry.passageId)
  );
  if (touchesNoDivergence === undefined) return;
  throw new Error(
    `consensus touches ${touchesNoDivergence.caseId}/passage:${touchesNoDivergence.passageId}, which is not a divergent pair.`
  );
}

type Final = { caseId: string; passageId: string; grade: number };

function applyFinals(
  dataset: EvalDataset,
  finals: Final[]
): {
  written: PassageMerge["report"]["written"];
  conflicts: PassageMerge["report"]["conflicts"];
  alreadyPresent: number;
  additions: Map<string, PassageAddition[]>;
} {
  const written: PassageMerge["report"]["written"] = [];
  const conflicts: PassageMerge["report"]["conflicts"] = [];
  const additions = new Map<string, PassageAddition[]>();
  let alreadyPresent = 0;
  for (const item of finals) {
    const existing = dataset.cases.find((candidate) => candidate.id === item.caseId)?.passageJudgments?.[item.passageId];
    if (existing === undefined) {
      written.push(item);
      additions.set(item.caseId, [
        ...(additions.get(item.caseId) ?? []),
        { cell: { passageId: item.passageId }, grade: item.grade as RelevanceGrade }
      ]);
      continue;
    }
    if (existing === item.grade) {
      alreadyPresent += 1;
      continue;
    }
    conflicts.push({ caseId: item.caseId, passageId: item.passageId, existing, proposed: item.grade });
  }
  return { written, conflicts, alreadyPresent, additions };
}
