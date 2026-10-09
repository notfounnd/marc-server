import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("preserves agent profile line breaks without changing other Markdown views", () => {
  const content = fs.readFileSync("src/ui/app-content.tsx", "utf8");
  const panel = fs.readFileSync("src/ui/markdown-panel.tsx", "utf8");
  const styles = fs.readFileSync("src/ui/styles/thread-content.css", "utf8");

  assert.match(
    content,
    /<MarkdownPanel\s+markdown=\{selectedAgent\.markdown\}\s+preserveLineBreaks/
  );
  assert.match(panel, /preserveLineBreaks = false/);
  assert.match(
    panel,
    /preserveLineBreaks && "markdown-panel-preserve-line-breaks"/
  );
  assert.match(
    styles,
    /\.markdown-panel-preserve-line-breaks p\s*\{\s*white-space: pre-line;\s*\}/
  );
});
