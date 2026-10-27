import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_RERANK_ORDER,
  RERANK_ORDER_PLANNERS,
  rerankOrderOf,
  restoreScoreOrder
} from "../src/core/memory/rerank-order.js";

test("the length order sends the shortest document first", () => {
  // Scenario: lengths 9, 1, 5, 2 give the order 1, 3, 2, 0.
  assert.deepEqual(
    RERANK_ORDER_PLANNERS.length(["aaaaaaaaa", "a", "aaaaa", "aa"]),
    [1, 3, 2, 0]
  );
});

test("the length order breaks a tie of length by the input index", () => {
  // Scenario: lengths 3, 1, 3, 1 give 1 and 3 first (length 1), then 0 and 2 (length 3).
  assert.deepEqual(
    RERANK_ORDER_PLANNERS.length(["abc", "a", "def", "g"]),
    [1, 3, 0, 2]
  );
});

test("the length order batches documents of similar length together", () => {
  // Scenario: batches of 2 over the length order of lengths 9, 1, 5, 2 are [1, 3] and [2, 0].
  const order = RERANK_ORDER_PLANNERS.length(["aaaaaaaaa", "a", "aaaaa", "aa"]);
  assert.deepEqual(order.slice(0, 2), [1, 3]);
  assert.deepEqual(order.slice(2, 4), [2, 0]);
});

test("the input order keeps the documents as they were received", () => {
  // Scenario: 5 documents in input order with batches of 2 give the old batches [0,1], [2,3], [4].
  const documents = ["a", "bb", "ccc", "dddd", "eeeee"];
  const order = RERANK_ORDER_PLANNERS.input(documents);
  assert.deepEqual(order, [0, 1, 2, 3, 4]);
  assert.deepEqual(
    [order.slice(0, 2), order.slice(2, 4), order.slice(4)],
    [[0, 1], [2, 3], [4]]
  );
});

test("scores come back to the input indexes after a length reorder", () => {
  // Scenario: order 1, 3, 0, 2 sends the scores 0.1, 0.3, 0.5, 0.7 at those positions.
  assert.deepEqual(
    restoreScoreOrder([1, 3, 0, 2], [0.1, 0.3, 0.5, 0.7]),
    [0.5, 0.1, 0.7, 0.3]
  );
});

test("scores of the input order are unchanged", () => {
  assert.deepEqual(
    restoreScoreOrder([0, 1, 2], [0.4, 0.5, 0.6]),
    [0.4, 0.5, 0.6]
  );
});

test("a score count that does not match the sent documents is refused", () => {
  assert.throws(
    () => restoreScoreOrder([0, 1], [0.4]),
    /unexpected score count/
  );
});

test("the default order is the length order", () => {
  assert.equal(DEFAULT_RERANK_ORDER, "length");
});

test("a missing order falls back to the length order", () => {
  assert.equal(rerankOrderOf(undefined), "length");
});

test("the input order is kept when asked for explicitly", () => {
  assert.equal(rerankOrderOf("input"), "input");
});

test("an unknown order falls back to the length order", () => {
  assert.equal(rerankOrderOf("random"), "length");
});
