import assert from "node:assert/strict";
import test from "node:test";
import { scanThreadSummarySources } from "../src/core/memory/summaries.js";
import { tempWorkspace, writeSummary } from "./memory-test-helpers.js";

test("summary identity uses the title and executive synthesis only", async () => {
  const info = await tempWorkspace();
  await writeSummary(
    info,
    "thread-ui",
    [
      "# Summary - Search interface",
      "",
      "Thread: `thread-ui`",
      "",
      "## Result",
      "",
      "Implemented the workspace search interface.",
      "",
      "## Validation",
      "",
      "The unrelated deployment example mentions kubernetes autoscaling."
    ].join("\n")
  );

  const [source] = await scanThreadSummarySources(info);
  const identity = source?.chunks.find((chunk) => chunk.kind === "identity");

  assert.ok(identity);
  assert.match(identity.embeddingText, /Thread: Search interface/);
  assert.match(identity.embeddingText, /workspace search interface/);
  assert.doesNotMatch(identity.embeddingText, /kubernetes autoscaling/);
});

test("summary passages do not repeat the thread title in embedding text", async () => {
  const info = await tempWorkspace();
  await writeSummary(
    info,
    "thread-ui",
    [
      "# Summary - Unique thread title",
      "",
      "Thread: `thread-ui`",
      "",
      "## Result",
      "",
      "Implemented the workspace search interface."
    ].join("\n")
  );

  const [source] = await scanThreadSummarySources(info);
  const identityCount =
    source?.chunks.filter((chunk) => chunk.kind === "identity").length ?? 0;
  const section = source?.chunks.find((chunk) => chunk.kind === "section");

  assert.equal(identityCount, 1);
  assert.ok(section);
  assert.doesNotMatch(section.embeddingText, /Unique thread title/);
});
