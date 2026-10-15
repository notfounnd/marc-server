import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { rehypeMarkdownHtmlSource } from "../src/ui/markdown-html-source.js";

const markdownPanelUrl = new URL(
  "../src/ui/markdown-panel.tsx",
  import.meta.url
).href;
const { MarkdownPanel } = (await import(markdownPanelUrl)) as {
  MarkdownPanel: React.ComponentType<{ markdown: string }>;
};

type TestNode = {
  type: string;
  value?: string;
  position?: {
    start?: { line?: number };
    end?: { line?: number };
  };
  tagName?: string;
  properties?: { className?: string[]; [key: string]: unknown };
  children?: TestNode[];
};

function transformSourceTree(children: TestNode[]): TestNode[] {
  const tree: TestNode = { type: "root", children };
  rehypeMarkdownHtmlSource()(tree);
  return tree.children ?? [];
}

function readCustomRulesCommentRun(): string {
  const source = readFileSync(".marc/RULES.md", "utf8");
  const firstStart = source.indexOf(
    "<!-- Keep project-specific custom rules below this line."
  );
  assert.notEqual(firstStart, -1);

  const firstEnd = source.indexOf("-->", firstStart) + 3;
  const secondStart = source.indexOf(
    "<!-- Prefer ### or deeper headings to organize project-specific rules in this section. -->",
    firstEnd
  );
  assert.ok(secondStart > firstEnd);

  const secondEnd = source.indexOf("-->", secondStart) + 3;
  assert.ok(secondEnd > secondStart);

  return source.slice(firstStart, secondEnd);
}

test("preserves the actual Custom Rules comments as separate source lines", () => {
  const markdown = readCustomRulesCommentRun();
  const html = renderToStaticMarkup(
    React.createElement(MarkdownPanel, { markdown })
  );

  assert.ok(
    html.includes(
      '<span class="markdown-html-source">&lt;!-- Keep project-specific custom rules below this line. This section is preserved by workspace_update_recommendations. --&gt;\n&lt;!-- Prefer ### or deeper headings to organize project-specific rules in this section. --&gt;</span>'
    )
  );
});

test("restores blank source lines between raw comments from their positions", () => {
  const markdown = "<!-- first -->\n\n\n<!-- second -->";
  const html = renderToStaticMarkup(
    React.createElement(MarkdownPanel, { markdown })
  );

  assert.ok(
    html.includes(
      '<span class="markdown-html-source">&lt;!-- first --&gt;\n\n\n&lt;!-- second --&gt;</span>'
    )
  );
  assert.equal(markdown, "<!-- first -->\n\n\n<!-- second -->");
});

test("preserves inline whitespace between raw comments on the same source line", () => {
  const markdown = "<!-- first -->   <!-- second -->";
  const html = renderToStaticMarkup(
    React.createElement(MarkdownPanel, { markdown })
  );

  assert.ok(
    html.includes(
      '<span class="markdown-html-source">&lt;!-- first --&gt;   &lt;!-- second --&gt;</span>'
    )
  );
});

test("wraps a raw comment inside a paragraph and preserves its surrounding text", () => {
  const markdown = "Before <!-- inline --> after.";
  const html = renderToStaticMarkup(
    React.createElement(MarkdownPanel, { markdown })
  );

  assert.ok(
    html.includes(
      '<p>Before <span class="markdown-html-source">&lt;!-- inline --&gt;</span> after.</p>'
    )
  );
});

test("restores source lines between directly adjacent raw nodes", () => {
  const children: TestNode[] = [
    {
      type: "raw",
      value: "<!-- first -->",
      position: { end: { line: 1 } }
    },
    {
      type: "raw",
      value: "<!-- second -->",
      position: { start: { line: 3 } }
    }
  ];
  const transformed = transformSourceTree(children);

  assert.equal(
    transformed[0].children?.[0].value,
    "<!-- first -->\n\n<!-- second -->"
  );
});

test("uses HAST whitespace when raw nodes do not have source positions", () => {
  const transformed = transformSourceTree([
    { type: "raw", value: "<!-- first -->" },
    { type: "text", value: " \t " },
    { type: "raw", value: "<!-- second -->" }
  ]);

  assert.equal(
    transformed[0].children?.[0].value,
    "<!-- first --> \t <!-- second -->"
  );
});

test("wraps an isolated multiline comment without absorbing surrounding paragraphs", () => {
  const markdown =
    "Before content.\n\n<!-- first line\nsecond line -->\n\nAfter content.";
  const html = renderToStaticMarkup(
    React.createElement(MarkdownPanel, { markdown })
  );

  assert.ok(html.includes("<p>Before content.</p>"));
  assert.ok(
    html.includes(
      '<span class="markdown-html-source">&lt;!-- first line\nsecond line --&gt;</span>'
    )
  );
  assert.ok(html.includes("<p>After content.</p>"));
});

test("keeps raw nodes separated by Markdown content in distinct wrappers", () => {
  const markdown = "<!-- before -->\n\n**middle content**\n\n<!-- after -->";
  const html = renderToStaticMarkup(
    React.createElement(MarkdownPanel, { markdown })
  );

  assert.ok(html.includes("&lt;!-- before --&gt;</span>"));
  assert.ok(html.includes("<p><strong>middle content</strong></p>"));
  assert.ok(
    html.includes(
      '<span class="markdown-html-source">&lt;!-- after --&gt;</span>'
    )
  );
  assert.equal(html.match(/class="markdown-html-source"/g)?.length, 2);
});
