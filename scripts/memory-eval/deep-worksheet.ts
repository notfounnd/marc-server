import path from "node:path";
import { writeFileAtomically } from "../../src/core/write-coordination.js";
import type { CapturedRecord } from "./capture-types.js";
import { passageRecordsOf, runDeepCases, type CaseRuns, type DeepInputs } from "./deep-run.js";
import { TOP_K } from "./deep-metrics.js";
import { DEEP_VARIANTS, type VariantRun } from "./deep-variants.js";
import { passageKeyOf } from "./judgments-passage.js";
import { corpusPathOf } from "./source-group.js";

export type PendingPassage = {
  passageId: string;
  sourcePath: string;
  sectionTitle: string;
  text: string;
};

export type PendingCase = {
  caseId: string;
  query: string;
  passages: PendingPassage[];
};

/**
 * The passages that a rater must still grade: the union of the first five of every variant, without a grade,
 * in passageId order. The worksheet is blind: it shows neither the variant, nor the position, nor the score.
 */
export function pendingCasesOf(runs: CaseRuns[], records: ReadonlyMap<string, CapturedRecord>): PendingCase[] {
  return runs.map((item) => ({
    caseId: item.evalCase.id,
    query: item.evalCase.query,
    passages: pendingPassagesOf(item, records)
  }));
}

function pendingPassagesOf(item: CaseRuns, records: ReadonlyMap<string, CapturedRecord>): PendingPassage[] {
  const ungraded = (passageId: string): boolean => item.evalCase.passageJudgments?.[passageId] === undefined;
  const ids = new Set(DEEP_VARIANTS.flatMap((id) => topOf(item.caseRuns.runs[id])));
  return [...ids]
    .filter(ungraded)
    .sort((left, right) => (left < right ? -1 : Number(left > right)))
    .map((passageId) => passageOf(records, passageId));
}

function topOf(run: VariantRun | undefined): string[] {
  if (run === undefined || run.status !== "ok") return [];
  return run.ranked.slice(0, TOP_K).map((passage) => passage.passageId);
}

function passageOf(records: ReadonlyMap<string, CapturedRecord>, passageId: string): PendingPassage {
  const record = records.get(passageId);
  if (record === undefined) throw new Error(`The capture has no passage ${passageId}.`);
  return {
    passageId,
    sourcePath: corpusPathOf(record.sourcePath ?? ""),
    sectionTitle: record.sectionTitle ?? "",
    text: record.text
  };
}

/** The worksheet in Markdown: each case with its query, then each passage in full. Cases without pending passages are left out. */
export function renderDeepWorksheet(cases: PendingCase[]): string {
  const pending = cases.filter((item) => item.passages.length > 0);
  const header = [
    "# Planilha de julgamento de trechos (marc-deep)",
    "",
    "Escala: 0 não responde à consulta; 1 menção incidental; 2 responde, mas não é a fonte principal; 3 responde à pergunta.",
    "",
    "Preencha deep-worksheet-template.json com um grau inteiro de 0 a 3 para cada trecho.",
    ""
  ];
  const body = pending.length === 0 ? ["Nenhum trecho pendente.", ""] : pending.flatMap(renderCase);
  return [...header, ...body].join("\n");
}

function renderCase(item: PendingCase): string[] {
  return [
    `## ${item.caseId}`,
    "",
    `Consulta: ${item.query}`,
    "",
    ...item.passages.flatMap((passage) => [
      `### ${passage.passageId}`,
      "",
      passage.sectionTitle.length === 0
        ? `Fonte: ${passage.sourcePath}`
        : `Fonte: ${passage.sourcePath}, seção: ${passage.sectionTitle}`,
      "",
      passage.text,
      ""
    ])
  ];
}

/** The rater template: one null per pending passage, under its `passage:<passageId>` key. */
export function worksheetTemplateOf(cases: PendingCase[]): Record<string, Record<string, null>> {
  return Object.fromEntries(
    cases
      .filter((item) => item.passages.length > 0)
      .map((item) => [
        item.caseId,
        Object.fromEntries(item.passages.map((passage) => [passageKeyOf(passage.passageId), null]))
      ])
  );
}

/** Writes the worksheet and its template beside the capture. Returns the number of pending passages. */
export async function writeDeepWorksheet(input: {
  inputs: DeepInputs;
  captureDir: string;
  deepBudget?: number;
}): Promise<number> {
  const runs = await runDeepCases(input.inputs, input.deepBudget);
  const cases = pendingCasesOf(runs, passageRecordsOf(input.inputs.capture));
  await writeFileAtomically(path.join(input.captureDir, "deep-worksheet.md"), renderDeepWorksheet(cases));
  await writeFileAtomically(
    path.join(input.captureDir, "deep-worksheet-template.json"),
    `${JSON.stringify(worksheetTemplateOf(cases), null, 2)}\n`
  );
  return cases.reduce((total, item) => total + item.passages.length, 0);
}
