import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { CaptureFile } from "../scripts/memory-eval/capture-types.js";
import { judgeKeyOf } from "../scripts/memory-eval/fit.js";
import { KEEP_OPTION } from "../scripts/memory-eval/judge-prompts.js";
import {
  JUDGE_CACHE_DIR,
  KEV_IDENTITY,
  LFM_IDENTITY,
  QWEN_IDENTITY,
  softmaxPair,
  tokenTruncatorOf,
  type ChoiceRunner,
  type JudgeRunner,
  type Tokenizer
} from "../scripts/memory-eval/judge-runner.js";
import {
  choiceCasesOf,
  choiceCapture,
  choiceDecisionsOf,
  choiceFileName,
  judgeCapture,
  judgeFileName,
  judgeTableOf,
  type ChoiceFile,
  type JudgeFile
} from "../scripts/memory-eval/judge.js";
import { captureFixture, dataset } from "./memory-eval-capture-fixtures.js";

/**
 * A copy of the capture in which every case has a distinct correction, except the first
 * case, which keeps its query as typed (its correction equals the original).
 */
function withCorrections(capture: CaptureFile): CaptureFile {
  const copy = structuredClone(capture);
  copy.cases.forEach((captured) => {
    captured.candidates.variants[1] = `${captured.originalQuery} corrected`;
  });
  copy.cases[0].candidates.variants[1] = copy.cases[0].originalQuery;
  return copy;
}

/** The fixed vocabulary of the word-level tokenizer: one id per word, in this order. */
const VOCABULARY = ["a", "b", "c", "d"] as const;

/** A word-level tokenizer over VOCABULARY: each word is its position in the table. */
function wordTokenizer(): Tokenizer {
  const encode = (text: string): number[] =>
    text
      .split(" ")
      .map((word) => VOCABULARY.indexOf(word as (typeof VOCABULARY)[number]));
  return Object.assign(
    (text: string) => ({ input_ids: { data: encode(text) } }),
    {
      decode: (ids: number[]): string =>
        ids.map((id) => VOCABULARY[id]).join(" "),
      convert_tokens_to_ids: (): number => 0,
      encode,
      apply_chat_template: (): string => ""
    }
  );
}

function fakeJudge(scores: number[]): JudgeRunner {
  return {
    identity: QWEN_IDENTITY,
    truncate: (text) => text,
    scoreDocument: async (_query, document) => {
      scores.push(document.length);
      return 0.25;
    }
  };
}

test("the file names and the model cache are fixed", () => {
  assert.equal(judgeFileName("qwen"), "judge-qwen.json");
  assert.equal(choiceFileName("kev"), "choice-kev.json");
  assert.equal(JUDGE_CACHE_DIR, ".marc/cache/memory-eval/models");
});

test("the judge models are pinned by full commit SHA and the LFM folder is read only", () => {
  assert.match(QWEN_IDENTITY.revision ?? "", /^[0-9a-f]{40}$/);
  assert.match(KEV_IDENTITY.revision ?? "", /^[0-9a-f]{40}$/);
  assert.equal(LFM_IDENTITY.revision, null);
});

test("the judge pass writes one entry per case, each thread with its score and document hash", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const scored: number[] = [];
  const saves: JudgeFile[] = [];
  const file = await judgeCapture({
    capture,
    dataset,
    judge: "qwen",
    runner: fakeJudge(scored),
    save: async (next) => {
      saves.push(next);
    },
    log: () => undefined
  });
  assert.equal(file.judge, "qwen");
  assert.equal(file.captureId, capture.captureId);
  assert.deepEqual(file.model, QWEN_IDENTITY);
  assert.equal(Object.keys(file.cases).length, capture.cases.length);
  assert.equal(saves.length, capture.cases.length);
  const threads = Object.values(file.cases).flatMap((entry) => entry.threads);
  assert.equal(scored.length, threads.length);
  assert.ok(
    threads.every(
      (thread) =>
        thread.score === 0.25 && /^[0-9a-f]{64}$/.test(thread.documentSha256)
    )
  );
});

test("a resumed judge pass scores only the cases that the checkpoint lacks", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const firstScores: number[] = [];
  const firstSaves: JudgeFile[] = [];
  const full = await judgeCapture({
    capture,
    dataset,
    judge: "qwen",
    runner: fakeJudge(firstScores),
    save: async (next) => {
      firstSaves.push(next);
    },
    log: () => undefined
  });
  const checkpoint = firstSaves[0];
  const resumedScores: number[] = [];
  const resumedSaves: JudgeFile[] = [];
  const resumed = await judgeCapture({
    capture,
    dataset,
    judge: "qwen",
    runner: fakeJudge(resumedScores),
    previous: checkpoint,
    save: async (next) => {
      resumedSaves.push(next);
    },
    log: () => undefined
  });
  assert.deepEqual(resumed.cases, full.cases);
  assert.equal(resumedSaves.length, capture.cases.length - 1);
  assert.ok(resumedScores.length < firstScores.length);
});

test("judgeTableOf indexes each score by its case and thread", async (t: TestContext) => {
  const capture = await captureFixture(t);
  const file = await judgeCapture({
    capture,
    dataset,
    judge: "kev",
    runner: fakeJudge([]),
    save: async () => undefined,
    log: () => undefined
  });
  const table = judgeTableOf(file);
  const threads = Object.entries(file.cases).flatMap(([caseId, entry]) =>
    entry.threads.map((thread) => [caseId, thread] as const)
  );
  assert.equal(table.size, threads.length);
  threads.forEach(([caseId, thread]) => {
    assert.equal(table.get(judgeKeyOf(caseId, thread.threadId)), thread.score);
  });
});

test("the choice covers only the cases whose correction differs from the query", async (t: TestContext) => {
  const capture = withCorrections(await captureFixture(t));
  assert.ok(capture.cases.length >= 2, "the fixture has at least two cases");
  const cases = choiceCasesOf(capture);
  assert.equal(cases.length, capture.cases.length - 1);
  assert.ok(!cases.some((item) => item.caseId === capture.cases[0].id));
});

test("the choice pass applies the H8 limits and offers keep as the second option", async (t: TestContext) => {
  const capture = withCorrections(await captureFixture(t));
  const runner: ChoiceRunner = {
    identity: KEV_IDENTITY,
    choose: async () => ({ pCorrection: 0.7, pKeep: 0.3 })
  };
  const file = await choiceCapture({
    capture,
    model: "kev",
    runner,
    save: async () => undefined,
    log: () => undefined
  });
  const expected = choiceCasesOf(capture);
  assert.deepEqual(
    Object.keys(file.cases).sort(),
    expected.map((item) => item.caseId).sort()
  );
  Object.values(file.cases).forEach((entry) => {
    assert.equal(entry.decision, "suggest");
    assert.equal(entry.options[1], KEEP_OPTION);
    assert.equal(entry.options[0], entry.correction);
  });
  const decisions = choiceDecisionsOf(file);
  assert.equal(decisions.size, expected.length);
});

test("a resumed choice pass keeps the decided cases and asks the runner only for the rest", async (t: TestContext) => {
  const capture = withCorrections(await captureFixture(t));
  const calls: string[] = [];
  const runner: ChoiceRunner = {
    identity: KEV_IDENTITY,
    choose: async (original) => {
      calls.push(original);
      return { pCorrection: 0.95, pKeep: 0.05 };
    }
  };
  const saves: ChoiceFile[] = [];
  const full = await choiceCapture({
    capture,
    model: "kev",
    runner,
    save: async (next) => {
      saves.push(next);
    },
    log: () => undefined
  });
  const callsAfterFull = calls.length;
  const resumed = await choiceCapture({
    capture,
    model: "kev",
    runner,
    previous: saves[0],
    save: async () => undefined,
    log: () => undefined
  });
  assert.deepEqual(resumed.cases, full.cases);
  assert.equal(
    calls.length - callsAfterFull,
    choiceCasesOf(capture).length - 1
  );
  assert.equal(Object.values(full.cases)[0].decision, "apply");
});

test("the token truncator keeps the leading tokens and leaves a short text alone", () => {
  const truncate = tokenTruncatorOf(wordTokenizer());
  assert.equal(truncate("a b c d", 2), "a b");
  assert.equal(truncate("a b", 5), "a b");
});

test("the two-way softmax is exact for equal logits and stable for large ones", () => {
  assert.deepEqual(softmaxPair(0, 0), [0.5, 0.5]);
  const [yes, no] = softmaxPair(1000, 0);
  assert.equal(yes, 1);
  assert.equal(no, 0);
  const [a, b] = softmaxPair(0.3, -1.2);
  assert.ok(Math.abs(a + b - 1) < 1e-12);
});
