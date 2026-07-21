import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("renders full-width memory search and deep retry actions", () => {
  const panel = fs.readFileSync("src/ui/memory-search-panel.tsx", "utf8");
  const css = fs.readFileSync("src/ui/styles/shell-navigation.css", "utf8");

  assert.match(panel, /className="memory-search-submit"/);
  assert.match(panel, /\{t\("Search"\)\}/);
  assert.match(panel, /className="memory-search-deep-retry"/);
  assert.match(panel, /\{t\("Deep retry"\)\}/);
  assert.doesNotMatch(panel, /className="button-icon"/);
  assert.match(
    css,
    /\.memory-search-form\s*{[\s\S]*display: flex;[\s\S]*flex-direction: column;/
  );
  assert.match(
    css,
    /\.memory-search-submit\s*{[\s\S]*width: 100%;[\s\S]*min-height: 40px;/
  );
  assert.match(css, /\.memory-search-deep-retry\s*{[\s\S]*width: 100%;/);
});
