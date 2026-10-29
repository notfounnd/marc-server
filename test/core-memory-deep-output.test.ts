import assert from "node:assert/strict";
import test from "node:test";
import {
  deepHitOf,
  emptyDeepResult,
  firstPerPassage,
  isSourceTypeAllowed,
  nextActionsFor
} from "../src/core/memory/deep-output.js";
import type { MemorySourceType } from "../src/core/memory/sources/contract.js";
import { memoryReferenceOf } from "../src/core/memory/recall-hits.js";
import { recordFixture, statusFixture } from "./memory-deep-fixtures.js";

const DECISION = recordFixture({
  recordId: "r-decision",
  threadId: "t-decision-cafe0041",
  kind: "passage",
  text: "decision text",
  authority: "decision"
});
const RULE = recordFixture({
  recordId: "r-rule",
  threadId: "@rules",
  kind: "passage",
  text: "rule text",
  sourceType: "rules",
  authority: "rule",
  sourcePath: ".marc/RULES.md",
  lineStart: 10,
  lineEnd: 20
});
const ARTIFACT = recordFixture({
  recordId: "r-artifact",
  threadId: "t-artifact-cafe0042",
  kind: "passage",
  text: "artifact text",
  sourceType: "artifact",
  authority: "artifact",
  messageId: "msg-1",
  artifactFileName: "plan.md",
  layer: 1
});
const DOCUMENT = recordFixture({
  recordId: "r-document",
  threadId: "@document/docs/guide.md",
  kind: "passage",
  text: "document text",
  sourceType: "document",
  authority: "document",
  sourcePath: "docs/guide.md",
  layer: 1
});
const CONVERSATION = recordFixture({
  recordId: "r-chat",
  threadId: "t-chat-cafe0043",
  kind: "passage",
  text: "chat text",
  sourceType: "chat",
  authority: "conversation",
  messageId: "msg-2",
  layer: 2
});

test("nextActions name the source to read for each of the five authorities, in order", () => {
  const hits = [DECISION, RULE, ARTIFACT, DOCUMENT, CONVERSATION].map(
    (record) => deepHitOf(record, 0.5)
  );

  assert.deepEqual(nextActionsFor(hits, statusFixture()), [
    "Call thread_read for marc://$t-decision-cafe0041 before reopening or contradicting this decision.",
    "Review .marc/RULES.md at lines 10-20 before applying this rule.",
    "Open the artifact marc://$t-artifact-cafe0042/#msg-1/!plan.md before relying on this evidence.",
    "Open the document docs/guide.md before relying on it.",
    "Treat marc://$t-chat-cafe0043/#msg-2 as intermediate context and confirm it in the thread SUMMARY.md or the final message."
  ]);
});

test("a stale index adds the rebuild action first, and the actions of the hits follow", () => {
  const hits = [deepHitOf(DECISION, 0.5)];

  assert.deepEqual(nextActionsFor(hits, statusFixture({ status: "stale" })), [
    "Run memory_rebuild when possible because the memory index is stale.",
    "Call thread_read for marc://$t-decision-cafe0041 before reopening or contradicting this decision."
  ]);
});

test("the next actions do not repeat an action for two passages of the same source", () => {
  const hits = [deepHitOf(DECISION, 0.9), deepHitOf(DECISION, 0.4)];

  assert.equal(nextActionsFor(hits, statusFixture()).length, 1);
});

test("a thread passage carries its thread id and the reference of recall; a rules passage has no thread id", () => {
  const threadHit = deepHitOf(ARTIFACT, 0.7, "high");
  const rulesHit = deepHitOf(RULE, 0.3, "low");

  assert.equal(threadHit.groupKind, "thread");
  assert.equal(threadHit.threadId, "t-artifact-cafe0042");
  assert.equal(threadHit.reference, memoryReferenceOf(ARTIFACT));
  assert.equal(threadHit.groupBand, "high");
  assert.equal(rulesHit.groupKind, "rules");
  assert.equal(rulesHit.threadId, undefined);
  assert.equal(rulesHit.groupBand, "low");
  assert.equal(rulesHit.reference, ".marc/RULES.md");
  assert.equal(rulesHit.matchedText, "rule text");
});

test("a scoped hit has no group band", () => {
  const hit = deepHitOf(DECISION, 0.5);

  assert.equal("groupBand" in hit, false);
});

test("firstPerPassage keeps the first hit of each passage, which is the best one", () => {
  const best = deepHitOf(DECISION, 0.9);
  const worse = deepHitOf(DECISION, 0.2);
  const other = deepHitOf(RULE, 0.5);

  const kept = firstPerPassage([best, worse, other]).map((hit) => hit.score);

  assert.deepEqual(kept, [0.9, 0.5]);
});

const SOURCE_TYPE_CASES: ReadonlyArray<
  readonly [string, MemorySourceType[] | undefined, boolean]
> = [
  ["no filter allows every source", undefined, true],
  ["a listed source is allowed", ["document"], true],
  ["an unlisted source is refused", ["chat"], false]
];

SOURCE_TYPE_CASES.forEach(([label, sourceTypes, allowed]) => {
  test(`isSourceTypeAllowed: ${label}`, () => {
    assert.equal(isSourceTypeAllowed("document", sourceTypes), allowed);
  });
});

test("an empty result is unscoped with abstained false, or scoped with its thread id", () => {
  const input = { query: "toogle" };

  const unscoped = emptyDeepResult(input, statusFixture(), [
    "Retry after the current memory operation completes."
  ]);
  const scoped = emptyDeepResult(
    input,
    statusFixture(),
    [],
    "t-scoped-cafe0044"
  );

  assert.equal(unscoped.mode, "unscoped");
  assert.equal(unscoped.abstained, false);
  assert.equal(unscoped.threadId, undefined);
  assert.equal(scoped.mode, "scoped");
  assert.equal(scoped.threadId, "t-scoped-cafe0044");
  assert.equal("abstained" in scoped, false);
  assert.deepEqual(scoped.results, []);
  assert.equal(scoped.rerankPairs, 0);
  assert.equal(scoped.query, "toogle");
});
