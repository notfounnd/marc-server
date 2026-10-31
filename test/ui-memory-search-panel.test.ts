import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("renders full-width memory search with no deep retry action", () => {
  const panel = fs.readFileSync("src/ui/memory-search-panel.tsx", "utf8");
  const css = fs.readFileSync("src/ui/styles/shell-navigation.css", "utf8");

  assert.match(panel, /className="memory-search-submit"/);
  assert.match(panel, /\{t\("Search"\)\}/);
  assert.doesNotMatch(panel, /Deep retry|deepRetry|DeepRetry/);
  assert.match(panel, /className="memory-search-interpretation"/);
  assert.match(panel, /t\("Searching for \{\{query\}\}"/);
  assert.match(panel, /t\("Search instead for"\)/);
  assert.match(panel, /t\("Did you mean \{\{query\}\}\?"/);
  assert.match(panel, /t\("Search for"\)/);
  assert.match(panel, />\s*\{result\.interpretation\.originalQuery\}\s*<\/a>/);
  assert.match(panel, />\s*\{result\.interpretation\.suggestedQuery\}\s*<\/a>/);
  assert.doesNotMatch(panel, /className="button-icon"/);
  assert.match(
    css,
    /\.memory-search-form\s*{[\s\S]*display: flex;[\s\S]*flex-direction: column;/
  );
  assert.match(
    css,
    /\.memory-search-submit\s*{[\s\S]*width: 100%;[\s\S]*min-height: 40px;/
  );
  assert.doesNotMatch(css, /memory-search-deep-retry/);
});

test("a hit without a thread shows its path, never the selected state or an error mark", () => {
  const panel = fs.readFileSync("src/ui/memory-search-panel.tsx", "utf8");

  assert.match(panel, /isMemorySearchHitSelected\(hit, selectedThreadId\)/);
  assert.doesNotMatch(panel, /hit\.threadId === selectedThreadId/);
  assert.match(panel, /key=\{hitKey\(hit\)\}/);
  assert.match(panel, /<FileText size=\{16\} \/>/);
});

test("shows the band as a signal icon in a row below the card text, not as a text label", () => {
  const panel = fs.readFileSync("src/ui/memory-search-panel.tsx", "utf8");
  const css = fs.readFileSync("src/ui/styles/shell-navigation.css", "utf8");

  assert.match(panel, /<MemorySearchBandSignal band=\{hit\.band\} t=\{t\} \/>/);
  assert.doesNotMatch(panel, /trailing=/);
  assert.doesNotMatch(panel, /memory-search-band"/);
  assert.doesNotMatch(panel, /BAND_LABEL_KEYS/);
  assert.doesNotMatch(css, /\.memory-search-results \.nav-trailing/);
  assert.match(
    css,
    /\.memory-search-signal-row\s*{[\s\S]*?justify-content: flex-end;/
  );
  assert.match(
    css,
    /\.memory-search-signal\s*{[\s\S]*?color: var\(--ink-muted\);/
  );
});
