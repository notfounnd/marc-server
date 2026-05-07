import assert from "node:assert/strict";
import test from "node:test";
import { parseMarcReference } from "../src/core/marc-references.js";

test("parses canonical mARC references", () => {
  assert.deepEqual(parseMarcReference("marc://@codex-dev"), {
    type: "agent",
    agentId: "codex-dev",
  });
  assert.deepEqual(parseMarcReference("marc://#msg_123"), {
    type: "message",
    messageId: "msg_123",
  });
  assert.deepEqual(parseMarcReference("marc://$thread-abc"), {
    type: "thread",
    threadId: "thread-abc",
  });
  assert.deepEqual(parseMarcReference("marc://$thread-abc/#msg_123"), {
    type: "message",
    threadId: "thread-abc",
    messageId: "msg_123",
  });
  assert.deepEqual(parseMarcReference("marc://#msg_123/!decision-notes.md"), {
    type: "artifact",
    messageId: "msg_123",
    artifactFile: "decision-notes.md",
  });
  assert.deepEqual(parseMarcReference("marc://$thread-abc/#msg_123/!decision-notes.md"), {
    type: "artifact",
    threadId: "thread-abc",
    messageId: "msg_123",
    artifactFile: "decision-notes.md",
  });
});

test("rejects malformed mARC references", () => {
  assert.equal(parseMarcReference("marc://thread-abc"), undefined);
  assert.equal(parseMarcReference("marc://$thread-abc/!decision-notes.md"), undefined);
  assert.equal(parseMarcReference("marc://#msg_123/artifacts/decision-notes.md"), undefined);
  assert.equal(parseMarcReference("https://example.com"), undefined);
});
