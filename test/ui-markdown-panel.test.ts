import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const markdownPanelUrl = new URL(
  "../src/ui/markdown-panel.tsx",
  import.meta.url
).href;
const { MarkdownPanel } = (await import(markdownPanelUrl)) as {
  MarkdownPanel: React.ComponentType<{ markdown: string }>;
};

test("renders raw HTML source as escaped text without enabling markup", () => {
  const markdown = "<script>alert(1)</script>\n<img src=x onerror=alert(1)>";
  const html = renderToStaticMarkup(
    React.createElement(MarkdownPanel, { markdown })
  );

  assert.ok(
    html.includes(
      '<span class="markdown-html-source">&lt;script&gt;alert(1)&lt;/script&gt;\n&lt;img src=x onerror=alert(1)&gt;</span>'
    )
  );
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<img src=x"), false);
});

test("keeps HTML examples inside inline, fenced, and indented code literal", () => {
  const markdown = [
    "Use `<!-- inline -->` literally.",
    "",
    "```html",
    "<!-- fenced -->",
    "<script>alert(1)</script>",
    "```",
    "",
    "    <!-- indented -->"
  ].join("\n");
  const html = renderToStaticMarkup(
    React.createElement(MarkdownPanel, { markdown })
  );

  assert.ok(html.includes("<code>&lt;!-- inline --&gt;</code>"));
  assert.ok(html.includes("&lt;!-- fenced --&gt;"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("&lt;!-- indented --&gt;"));
  assert.equal(html.includes("markdown-html-source"), false);
});

test("preserves headings, lists, tables, links, and mARC labels", () => {
  const markdown = [
    "# Heading",
    "",
    "- first item",
    "- second item",
    "",
    "| Left | Right |",
    "| --- | --- |",
    "| one | two |",
    "",
    "See [the guide](https://example.com) and marc://@codex-dev."
  ].join("\n");
  const html = renderToStaticMarkup(
    React.createElement(MarkdownPanel, { markdown })
  );

  assert.ok(html.includes("<h1>Heading</h1>"));
  assert.ok(html.includes("<li>first item</li>"));
  assert.ok(html.includes("<li>second item</li>"));
  assert.ok(html.includes("<table>"));
  assert.ok(
    html.includes(
      '<a href="https://example.com" target="_blank" rel="noreferrer">the guide</a>'
    )
  );
  assert.ok(html.includes('<a href="#">@codex-dev</a>'));
});
