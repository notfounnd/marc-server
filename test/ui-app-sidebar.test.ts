import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("forwards the deep retry state and action to the middle sidebar", () => {
  const sidebar = fs.readFileSync("src/ui/app-sidebar.tsx", "utf8");

  assert.match(
    sidebar,
    /memorySearchDeepRetryAvailable=\{memorySearchDeepRetryAvailable\}/
  );
  assert.match(sidebar, /onMemorySearchDeepRetry=\{onMemorySearchDeepRetry\}/);
});
