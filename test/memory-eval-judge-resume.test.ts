import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { CaptureFile } from "../scripts/memory-eval/capture-types.js";
import {
  choiceCapture,
  judgeCapture,
  type ChoiceCase,
  type ChoiceFile,
  type JudgeCase,
  type JudgeFile
} from "../scripts/memory-eval/judge.js";
import {
  KEV_IDENTITY,
  QWEN_IDENTITY,
  type ChoiceRunner,
  type JudgeRunner
} from "../scripts/memory-eval/judge-runner.js";
import { captureFixture, dataset } from "./memory-eval-capture-fixtures.js";

const fakeJudge: JudgeRunner = {
  identity: QWEN_IDENTITY,
  truncate: (text) => text,
  scoreDocument: async () => 0.5
};

const fakeChoice: ChoiceRunner = {
  identity: KEV_IDENTITY,
  choose: async () => ({ pCorrection: 0.95, pKeep: 0.05 })
};

/** The capture with a distinct correction in every case, so that every case is judged and chosen. */
function correctedCaptureOf(capture: CaptureFile): CaptureFile {
  const copy = structuredClone(capture);
  copy.cases.forEach((captured) => {
    captured.candidates.variants[1] = `${captured.originalQuery} corrected`;
  });
  return copy;
}

async function fullJudgeFileOf(capture: CaptureFile): Promise<JudgeFile> {
  return judgeCapture({
    capture,
    dataset,
    judge: "qwen",
    runner: fakeJudge,
    save: async () => undefined,
    log: () => undefined
  });
}

function withJudgeCase(
  file: JudgeFile,
  caseId: string,
  patch: Partial<JudgeCase>
): JudgeFile {
  return {
    ...file,
    cases: { ...file.cases, [caseId]: { ...file.cases[caseId], ...patch } }
  };
}

function withChoiceCase(
  file: ChoiceFile,
  caseId: string,
  patch: Partial<ChoiceCase>
): ChoiceFile {
  return {
    ...file,
    cases: { ...file.cases, [caseId]: { ...file.cases[caseId], ...patch } }
  };
}

/** Each change makes a stored judge file stale in one way; the resume must refuse it. */
const JUDGE_CHANGES: ReadonlyArray<{
  name: string;
  change: (file: JudgeFile, caseId: string) => JudgeFile;
  message: RegExp;
}> = [
  {
    name: "model",
    change: (file) => ({
      ...file,
      model: { ...file.model, revision: "0".repeat(40) }
    }),
    message: /was written by/
  },
  {
    name: "query",
    change: (file, caseId) =>
      withJudgeCase(file, caseId, { effectiveQuery: "another query" }),
    message: /was judged with the query/
  },
  {
    name: "document",
    change: (file, caseId) =>
      withJudgeCase(file, caseId, {
        threads: file.cases[caseId].threads.map((thread) => ({
          ...thread,
          documentSha256: "0".repeat(64)
        }))
      }),
    message: /the judged document changed/
  }
];

JUDGE_CHANGES.forEach(({ name, change, message }) => {
  test(`a judge file changed in its ${name} is not resumed`, async (t: TestContext) => {
    const capture = await captureFixture(t);
    const full = await fullJudgeFileOf(capture);
    const caseId = capture.cases[0].id;
    await assert.rejects(
      judgeCapture({
        capture,
        dataset,
        judge: "qwen",
        runner: fakeJudge,
        previous: change(full, caseId),
        save: async () => undefined,
        log: () => undefined
      }),
      message
    );
  });
});

test("a judge file of the same model, capture and documents resumes without a new score", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const full = await fullJudgeFileOf(capture);
  let scored = 0;
  const counting: JudgeRunner = {
    ...fakeJudge,
    scoreDocument: async () => {
      scored += 1;
      return 0.5;
    }
  };
  const resumed = await judgeCapture({
    capture,
    dataset,
    judge: "qwen",
    runner: counting,
    previous: full,
    save: async () => undefined,
    log: () => undefined
  });
  assert.equal(scored, 0);
  assert.deepEqual(resumed.cases, full.cases);
});

/** Each change makes a stored choice file stale; the resume must refuse it. */
const CHOICE_CHANGES: ReadonlyArray<{
  name: string;
  change: (file: ChoiceFile, caseId: string) => ChoiceFile;
  message: RegExp;
}> = [
  {
    name: "model",
    change: (file) => ({
      ...file,
      identity: { ...file.identity, revision: "0".repeat(40) }
    }),
    message: /The choice file was written by/
  },
  {
    name: "correction",
    change: (file, caseId) =>
      withChoiceCase(file, caseId, { correction: "another correction" }),
    message: /chosen with another query or correction/
  }
];

CHOICE_CHANGES.forEach(({ name, change, message }) => {
  test(`a choice file changed in its ${name} is not resumed`, async (t: TestContext) => {
    const capture = correctedCaptureOf(await captureFixture(t));
    const full = await choiceCapture({
      capture,
      model: "kev",
      runner: fakeChoice,
      save: async () => undefined,
      log: () => undefined
    });
    const caseId = Object.keys(full.cases)[0];
    await assert.rejects(
      choiceCapture({
        capture,
        model: "kev",
        runner: fakeChoice,
        previous: change(full, caseId),
        save: async () => undefined,
        log: () => undefined
      }),
      message
    );
  });
});
