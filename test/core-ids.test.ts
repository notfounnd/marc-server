import assert from "node:assert/strict";
import test from "node:test";
import { slugify, threadSlug } from "../src/core/ids.js";

test("threadSlug removes trailing truncation separators and preserves slugify", () => {
  const longTitle = "a".repeat(63) + " b";

  assert.equal(threadSlug(longTitle), "a".repeat(63));
  assert.equal(threadSlug("Título curto"), "titulo-curto");
  assert.equal(threadSlug("!@#"), "item");
  assert.equal(slugify(longTitle), "a".repeat(63) + "-");
});
