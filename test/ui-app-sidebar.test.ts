import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("forwards the deep retry state and action to the middle sidebar", () => {
  const sidebar = fs.readFileSync("src/ui/app-sidebar.tsx", "utf8");

  assert.match(
    sidebar,
    /memorySearchDeepRetryAvailable=\{memorySearch\.deepRetryAvailable\}/
  );
  assert.match(
    sidebar,
    /onMemorySearchDeepRetry=\{memorySearch\.runDeepRetry\}/
  );
});

test("shows a workspace-gated create thread action before search", () => {
  const sidebar = fs.readFileSync("src/ui/app-sidebar.tsx", "utf8");
  const middle = fs.readFileSync("src/ui/app-sidebar-middle.tsx", "utf8");

  assert.match(sidebar, /canCreateThread=\{canCreateThread\}/);
  assert.match(sidebar, /onCreateThread=\{onCreateThread\}/);
  assert.match(middle, /PencilSparkles/);
  assert.match(middle, /aria-label=\{t\("Create thread"\)\}/);
  assert.match(middle, /disabled=\{!canCreateThread\}/);
  const threadActions = middle.match(
    /threads:\s*\(([\s\S]*?)\n\s*\)\n\s*\}/
  )?.[1];
  assert.ok(threadActions);
  assert.ok(
    threadActions.indexOf("<PencilSparkles") < threadActions.indexOf("<Search")
  );
});
