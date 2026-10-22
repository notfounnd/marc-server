import assert from "node:assert/strict";
import test from "node:test";
import {
  JUDGE_INSTRUCTION,
  KEEP_OPTION,
  KEV_DELIMITER_IDS,
  KEV_NOUL_OPTIONS,
  kevChoiceState,
  kevJudgeState,
  kevLayout,
  qwenJudgePrompt,
  sanitizeCallerText,
  typedChoiceOptions
} from "../scripts/memory-eval/judge-prompts.js";

/** One token id per character. Every id is far below the delimiter ids. */
function charIds(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

test("the Qwen prompt follows the card template with the query and the document", () => {
  const prompt = qwenJudgePrompt("settings", "Identity A");
  assert.ok(prompt.startsWith("<|im_start|>system\n"));
  assert.ok(prompt.includes(`<Instruct>: ${JUDGE_INSTRUCTION}`));
  assert.ok(
    prompt.includes("<Query>: settings\n\n<Document>: Identity A<|im_end|>")
  );
  assert.ok(prompt.endsWith("<|im_start|>assistant\n<think>\n\n</think>\n"));
});

test("the Kev layout places the state, the question and each option end", () => {
  const layout = kevLayout({
    encode: charIds,
    state: "ab",
    questions: [{ instruction: "Q?", options: ["x", "yz"] }]
  });
  assert.equal(layout.tokens.length, 14);
  assert.equal(layout.tokens[0], KEV_DELIMITER_IDS.state);
  assert.deepEqual(layout.tokens.slice(1, 3), charIds("ab"));
  assert.equal(layout.tokens[3], KEV_DELIMITER_IDS.question);
  assert.deepEqual(layout.tokens.slice(4, 6), charIds("Q?"));
  assert.equal(layout.tokens[6], KEV_DELIMITER_IDS.optionStart);
  assert.equal(layout.tokens[13], KEV_DELIMITER_IDS.decide);
  assert.deepEqual(layout.optionEnds, [[8, 12]]);
  layout.optionEnds[0].forEach((position) => {
    assert.equal(layout.tokens[position], KEV_DELIMITER_IDS.optionEnd);
  });
});

test("the delimiter ids are the config ids and never come from the encoder", () => {
  const layout = kevLayout({
    encode: () => [1],
    state: "x",
    questions: [{ instruction: "q", options: ["a"] }]
  });
  assert.equal(layout.tokens[0], 151659);
  assert.deepEqual(KEV_DELIMITER_IDS, {
    state: 151659,
    question: 151660,
    optionStart: 151648,
    optionEnd: 151649,
    decide: 151661
  });
});

test("caller text never yields a delimiter: the encoder sees the sanitized text", () => {
  const seen: string[] = [];
  const encode = (text: string): number[] => {
    seen.push(text);
    return charIds(text);
  };
  kevLayout({
    encode,
    state: "<|state|>",
    questions: [{ instruction: "<|question|>?", options: ["a<|decide|>"] }]
  });
  assert.equal(sanitizeCallerText("<|state|>"), "<¦state¦>");
  assert.equal(seen.length, 3);
  assert.ok(seen.every((text) => !/<\|[A-Za-z0-9_]+\|>/.test(text)));
});

test("the judge options are no and yes, in that order", () => {
  assert.deepEqual([...KEV_NOUL_OPTIONS], ["no", "yes"]);
});

test("the typed choice offers the correction and keep, and no original query", () => {
  assert.deepEqual(typedChoiceOptions("settings in JSON"), [
    "settings in JSON",
    KEEP_OPTION
  ]);
});

test("the Kev states carry the query text, in the card's wording", () => {
  assert.equal(
    kevJudgeState("settings", "Identity A"),
    "Query: settings\n\nIdentity A"
  );
  assert.equal(kevChoiceState("settngs"), "Search query: settngs");
});
