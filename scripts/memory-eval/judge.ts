import { asSearchRecord, type CaptureFile, type CapturedRecord } from "./capture-types.js";
import { candidateFeaturesOf, rerankScoresOf } from "./candidate-pairs.js";
import { decideChoice, type ChoiceDecision } from "./choice-decision.js";
import type { EvalDataset } from "./dataset.js";
import { judgeKeyOf, type JudgeTable } from "./fit.js";
import type { JudgeName } from "./judge-stage.js";
import type { JudgeRunner, ChoiceRunner, ModelIdentity } from "./judge-runner.js";
import { channelsOfCaptured, cachedReplayProviders, recordsById } from "./replay.js";
import type { TypedModel } from "./suggestion.js";
import {
  judgeDocumentOf,
  judgeDocumentSha256
} from "../../src/core/memory/scoring/judge-document.js";
import {
  selectedEvidenceOf,
  type RerankScores,
  type ThreadFeatures
} from "../../src/core/memory/scoring/features.js";
import type { MemoryVectorRecord } from "../../src/core/memory/types.js";

/**
 * The judge and choice passes (H7 and H8) over one capture. Each writes its own
 * file in the capture directory, with the identity of the model, one entry per
 * case and a checkpoint after every case. Resuming reads the file back and skips
 * the cases it already has.
 */

export function judgeFileName(judge: JudgeName): string {
  return `judge-${judge}.json`;
}

export function choiceFileName(model: TypedModel): string {
  return `choice-${model}.json`;
}

export type JudgeCase = {
  effectiveQuery: string;
  threads: Array<{ threadId: string; documentSha256: string; score: number }>;
};

export type JudgeFile = {
  schemaVersion: 1;
  judge: JudgeName;
  corpus: string;
  captureId: string;
  model: ModelIdentity;
  cases: Record<string, JudgeCase>;
};

export type ChoiceCase = {
  original: string;
  correction: string;
  options: [string, string];
  pCorrection: number;
  pKeep: number;
  decision: ChoiceDecision;
};

export type ChoiceFile = {
  schemaVersion: 1;
  model: TypedModel;
  corpus: string;
  captureId: string;
  identity: ModelIdentity;
  cases: Record<string, ChoiceCase>;
};

/** The judge scores of a judge file, keyed by judgeKeyOf(caseId, threadId). */
export function judgeTableOf(file: JudgeFile): JudgeTable {
  const table = new Map<string, number>();
  for (const [caseId, entry] of Object.entries(file.cases)) {
    for (const thread of entry.threads) {
      table.set(judgeKeyOf(caseId, thread.threadId), thread.score);
    }
  }
  return table;
}

/** The decisions of a choice file, by case. */
export function choiceDecisionsOf(file: ChoiceFile): Map<string, ChoiceDecision> {
  return new Map(
    Object.entries(file.cases).map(([caseId, entry]) => [caseId, entry.decision])
  );
}

/** The cases with a correction that differs from the original query (H8 covers only these). */
export function choiceCasesOf(capture: CaptureFile): Array<{ caseId: string; original: string; correction: string }> {
  return capture.cases.flatMap((captured) => {
    const correction = captured.candidates.variants[1];
    if (correction === undefined || correction === captured.originalQuery) return [];
    return [{ caseId: captured.id, original: captured.originalQuery, correction }];
  });
}

export function identityRecordsOf(capture: CaptureFile): Map<string, MemoryVectorRecord> {
  const identities = new Map<string, MemoryVectorRecord>();
  for (const record of capture.records) {
    if (record.kind !== "identity") continue;
    identities.set(record.threadId, asSearchRecord(record));
  }
  return identities;
}

/** A candidate thread of one case, with the evidence its judge document is built from. */
export type JudgeTarget = {
  threadId: string;
  features: ThreadFeatures;
  identity: MemoryVectorRecord;
  passages: MemoryVectorRecord[];
};

export type JudgeTargets = {
  query: string;
  rerankScores: RerankScores;
  targets: JudgeTarget[];
};

/**
 * The judge inputs of one case, read from the capture and the cached reranker
 * scores: no model is loaded. The judge pass and the judge latency share it.
 */
export async function judgeTargetsOf(input: {
  captured: CaptureFile["cases"][number];
  capture: CaptureFile;
  records: ReadonlyMap<string, CapturedRecord>;
  identities: ReadonlyMap<string, MemoryVectorRecord>;
}): Promise<JudgeTargets> {
  const query = input.captured.interpretation.effectiveQuery;
  const captured = input.captured;
  const channels = captured.channels[query];
  if (channels === undefined) {
    throw new Error(`Capture case ${captured.id} has no channels for its effective query.`);
  }
  const providers = cachedReplayProviders(captured, input.capture);
  const searchChannels = channelsOfCaptured(channels, input.records);
  const features = await candidateFeaturesOf(query, searchChannels, providers.reranker);
  const rerankScores = await rerankScoresOf(query, searchChannels, providers.reranker);
  const selection = selectedEvidenceOf(searchChannels);
  const targets = features.map((item) => {
    const evidence = selection.get(item.threadId);
    const identity = evidence?.identity ?? input.identities.get(item.threadId);
    if (identity === undefined) {
      throw new Error(`No identity record for thread ${item.threadId}.`);
    }
    return {
      threadId: item.threadId,
      features: item,
      identity,
      passages: evidence?.passages ?? []
    };
  });
  return { query, rerankScores, targets };
}

async function judgeCaseOf(input: {
  captured: CaptureFile["cases"][number];
  capture: CaptureFile;
  records: ReadonlyMap<string, CapturedRecord>;
  identities: ReadonlyMap<string, MemoryVectorRecord>;
  runner: JudgeRunner;
}): Promise<JudgeCase> {
  const { query, rerankScores, targets } = await judgeTargetsOf(input);
  const threads: JudgeCase["threads"] = [];
  for (const target of targets) {
    const document = judgeDocumentOf({
      identity: target.identity,
      passages: target.passages,
      rerankScores,
      truncate: input.runner.truncate
    });
    const score = await input.runner.scoreDocument(query, document);
    threads.push({
      threadId: target.threadId,
      documentSha256: judgeDocumentSha256(document),
      score
    });
  }
  return { effectiveQuery: query, threads };
}

/** Two model identities are the same model when the id, the file, the dtype and the revision agree. */
export function sameModel(left: ModelIdentity, right: ModelIdentity): boolean {
  return (
    left.id === right.id &&
    left.file === right.file &&
    left.dtype === right.dtype &&
    left.revision === right.revision
  );
}

/**
 * A judge file is reused only for the model, the capture and the queries that wrote it.
 * A mismatch fails with the first difference, and nothing is reused.
 */
export function assertJudgeFileReusable(
  file: JudgeFile,
  input: { capture: CaptureFile; judge: JudgeName; identity: ModelIdentity }
): void {
  if (file.judge !== input.judge) {
    throw new Error(`The judge file is for ${file.judge}, not ${input.judge}. Remove it or run without --resume.`);
  }
  if (file.captureId !== input.capture.captureId) {
    throw new Error(
      `The judge file belongs to captureId ${file.captureId}, not ${input.capture.captureId}. Remove it or run without --resume.`
    );
  }
  if (!sameModel(file.model, input.identity)) {
    throw new Error(
      `The judge file was written by ${file.model.id}@${file.model.revision}, not by ${input.identity.id}@${input.identity.revision}. Remove it or run without --resume.`
    );
  }
  const queries = new Map(
    input.capture.cases.map((captured) => [captured.id, captured.interpretation.effectiveQuery] as const)
  );
  for (const [caseId, entry] of Object.entries(file.cases)) {
    const query = queries.get(caseId);
    if (query !== entry.effectiveQuery) {
      throw new Error(
        `Case ${caseId} was judged with the query "${entry.effectiveQuery}", and the capture now has "${query ?? "no such case"}". Remove the file or run without --resume.`
      );
    }
  }
}

/**
 * The judged documents are rebuilt from the capture with the runner's tokenizer and
 * compared with the stored hashes. A changed document means the stored score no longer
 * belongs to that thread, so the resume stops.
 */
async function assertDocumentsUnchanged(
  previous: JudgeFile,
  input: {
    capture: CaptureFile;
    records: ReadonlyMap<string, CapturedRecord>;
    identities: ReadonlyMap<string, MemoryVectorRecord>;
    runner: JudgeRunner;
  }
): Promise<void> {
  for (const captured of input.capture.cases) {
    const entry = previous.cases[captured.id];
    if (entry === undefined) continue;
    const inputs = await judgeTargetsOf({
      captured,
      capture: input.capture,
      records: input.records,
      identities: input.identities
    });
    const now = new Map(
      inputs.targets.map((target) => [
        target.threadId,
        judgeDocumentSha256(
          judgeDocumentOf({
            identity: target.identity,
            passages: target.passages,
            rerankScores: inputs.rerankScores,
            truncate: input.runner.truncate
          })
        )
      ] as const)
    );
    const stored = new Map(entry.threads.map((thread) => [thread.threadId, thread.documentSha256] as const));
    if (now.size !== stored.size) {
      throw new Error(
        `Case ${captured.id}: ${stored.size} threads were judged, and ${now.size} are candidates now. Remove the file or run without --resume.`
      );
    }
    for (const [threadId, sha] of now) {
      const storedSha = stored.get(threadId);
      if (storedSha !== sha) {
        throw new Error(
          `Case ${captured.id} thread ${threadId}: the judged document changed (stored ${storedSha ?? "none"}, now ${sha}). Remove the file or run without --resume.`
        );
      }
    }
  }
}

/**
 * A choice file is reused only for the model, the capture, and the original query and
 * correction of every case it holds. A mismatch fails with the first difference.
 */
export function assertChoiceFileReusable(
  file: ChoiceFile,
  input: { capture: CaptureFile; model: TypedModel; identity: ModelIdentity }
): void {
  if (file.model !== input.model) {
    throw new Error(`The choice file is for ${file.model}, not ${input.model}. Remove it or run without --resume.`);
  }
  if (file.captureId !== input.capture.captureId) {
    throw new Error(
      `The choice file belongs to captureId ${file.captureId}, not ${input.capture.captureId}. Remove it or run without --resume.`
    );
  }
  if (!sameModel(file.identity, input.identity)) {
    throw new Error(
      `The choice file was written by ${file.identity.id}@${file.identity.revision}, not by ${input.identity.id}@${input.identity.revision}. Remove it or run without --resume.`
    );
  }
  const items = new Map(choiceCasesOf(input.capture).map((item) => [item.caseId, item] as const));
  for (const [caseId, entry] of Object.entries(file.cases)) {
    const item = items.get(caseId);
    if (item === undefined || item.original !== entry.original || item.correction !== entry.correction) {
      throw new Error(
        `Case ${caseId} was chosen with another query or correction. Remove the file or run without --resume.`
      );
    }
  }
}

/**
 * Runs one judge over the capture. `previous` holds the cases already written, and
 * `save` runs after each new case.
 */
export async function judgeCapture(input: {
  capture: CaptureFile;
  dataset: EvalDataset;
  judge: JudgeName;
  runner: JudgeRunner;
  previous?: JudgeFile;
  save: (file: JudgeFile) => Promise<void>;
  log: (line: string) => void;
}): Promise<JudgeFile> {
  const records = recordsById(input.capture.records);
  const identities = identityRecordsOf(input.capture);
  if (input.previous !== undefined) {
    assertJudgeFileReusable(input.previous, {
      capture: input.capture,
      judge: input.judge,
      identity: input.runner.identity
    });
    await assertDocumentsUnchanged(input.previous, {
      capture: input.capture,
      records,
      identities,
      runner: input.runner
    });
  }
  let file: JudgeFile = input.previous ?? {
    schemaVersion: 1,
    judge: input.judge,
    corpus: input.capture.corpus,
    captureId: input.capture.captureId,
    model: input.runner.identity,
    cases: {}
  };
  for (const captured of input.capture.cases) {
    if (file.cases[captured.id] !== undefined) continue;
    const started = Date.now();
    const entry = await judgeCaseOf({ captured, capture: input.capture, records, identities, runner: input.runner });
    file = { ...file, cases: { ...file.cases, [captured.id]: entry } };
    await input.save(file);
    input.log(`${captured.id} threads=${entry.threads.length} ms=${Date.now() - started}`);
  }
  return file;
}

/**
 * Runs one typed choice over the cases with a distinct correction. The options are
 * the correction and "keep the query as typed", and the decision follows the H8 limits.
 */
export async function choiceCapture(input: {
  capture: CaptureFile;
  model: TypedModel;
  runner: ChoiceRunner;
  previous?: ChoiceFile;
  save: (file: ChoiceFile) => Promise<void>;
  log: (line: string) => void;
}): Promise<ChoiceFile> {
  if (input.previous !== undefined) {
    assertChoiceFileReusable(input.previous, {
      capture: input.capture,
      model: input.model,
      identity: input.runner.identity
    });
  }
  let file: ChoiceFile = input.previous ?? {
    schemaVersion: 1,
    model: input.model,
    corpus: input.capture.corpus,
    captureId: input.capture.captureId,
    identity: input.runner.identity,
    cases: {}
  };
  for (const item of choiceCasesOf(input.capture)) {
    if (file.cases[item.caseId] !== undefined) continue;
    const started = Date.now();
    const probabilities = await input.runner.choose(item.original, item.correction);
    const entry: ChoiceCase = {
      original: item.original,
      correction: item.correction,
      options: [item.correction, "keep the query as typed"],
      pCorrection: probabilities.pCorrection,
      pKeep: probabilities.pKeep,
      decision: decideChoice(probabilities.pCorrection, probabilities.pKeep)
    };
    file = { ...file, cases: { ...file.cases, [item.caseId]: entry } };
    await input.save(file);
    input.log(`${item.caseId} decision=${entry.decision} ms=${Date.now() - started}`);
  }
  return file;
}
