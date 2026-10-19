import assert from "node:assert/strict";
import test from "node:test";
import { parseMarkdownSections } from "../src/core/memory/sources/sections.js";
import { readSummarySources } from "../src/core/memory/sources/summary.js";
import { tempWorkspace, writeSummary } from "./memory-test-helpers.js";

const SECTION_SCENARIOS: Array<{
  name: string;
  markdown: string;
  expected: Array<{
    title: string;
    text: string;
    lineStart: number;
    lineEnd: number;
  }>;
}> = [
  {
    name: "a heading inside a ts fence does not start a section",
    markdown:
      "## Real\n\nBefore.\n\n```ts\n## Fake\nconst a = 1;\n```\n\nAfter.",
    expected: [
      { title: "Real", text: "Before. After.", lineStart: 1, lineEnd: 10 }
    ]
  },
  {
    name: "a heading inside a text fence stays body text",
    markdown: "## Real\n\n```text\n## Fake\n```\n\nAfter.",
    expected: [{ title: "Real", text: "Fake After.", lineStart: 1, lineEnd: 7 }]
  }
];

const FENCE_TITLE_SCENARIOS: Array<{
  name: string;
  markdown: string;
  titles: string[];
}> = [
  {
    name: "a tilde fence hides its headings and a later heading still starts a section",
    markdown: "## Real\n~~~ts\n## Fake\n~~~\n## Second\nBody.",
    titles: ["Real", "Second"]
  },
  {
    name: "a fence closes only with the same character",
    markdown: "## Real\n```\n## Fake\n~~~\nstill\n```\n## Second",
    titles: ["Real", "Second"]
  },
  {
    name: "a closing run shorter than the opening run does not close the fence",
    markdown: "## Real\n````\n## Fake\n```\n## Second\n````\n## Third",
    titles: ["Real", "Third"]
  },
  {
    name: "an indented fence is not a fence",
    markdown: "## Real\n    ```\n## Second\n    ```",
    titles: ["Real", "Second"]
  },
  {
    name: "a backtick fence info string cannot contain backticks",
    markdown: "## Real\n```a`b\n## Second\n```",
    titles: ["Real", "Second"]
  },
  {
    name: "a fence without a closing line hides every later heading",
    markdown: "## Real\n```ts\n## Fake\n## Also fake",
    titles: ["Real"]
  }
];

const SUMMARY_WITH_FENCE = [
  "Thread: `thread-fence`",
  "Closed: 2026-10-01T00:00:00.000Z",
  "",
  "# Summary - Fence",
  "",
  "## Real",
  "Before fence.",
  "",
  "```ts",
  "## Fake",
  "const a = 1;",
  "```",
  "",
  "## Next",
  "After."
].join("\n");

for (const scenario of SECTION_SCENARIOS) {
  test(`fenced sections: ${scenario.name}`, () => {
    assert.deepEqual(
      parseMarkdownSections(scenario.markdown, [2]),
      scenario.expected
    );
  });
}

for (const scenario of FENCE_TITLE_SCENARIOS) {
  test(`fence state: ${scenario.name}`, () => {
    const titles = parseMarkdownSections(scenario.markdown, [2]).map(
      (section) => section.title
    );
    assert.deepEqual(titles, scenario.titles);
  });
}

test("summary reader keeps a fenced heading in its section with provenance lines", async () => {
  const info = await tempWorkspace();
  await writeSummary(info, "thread-fence", SUMMARY_WITH_FENCE);

  const sources = await readSummarySources(info);
  const sections = sources.flatMap((source) =>
    source.chunks
      .filter((chunk) => chunk.kind === "section")
      .map((chunk) => ({
        sectionTitle: chunk.sectionTitle,
        text: chunk.text,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd
      }))
  );

  assert.deepEqual(sections, [
    {
      sectionTitle: "Real",
      text: "Before fence.",
      lineStart: 6,
      lineEnd: 13
    },
    {
      sectionTitle: "Next",
      text: "After.",
      lineStart: 14,
      lineEnd: 15
    }
  ]);
});

type FenceForm = {
  name: string;
  open: (info: string) => string;
  close: string;
};

// The same fence shapes as the normalization tests. Each one wraps a ts block
// that holds SENTINEL_CODE, and a bash block that must stay in the text.
const FENCE_FORMS: FenceForm[] = [
  { name: "tilde", open: (info) => "~~~" + info, close: "~~~" },
  { name: "four backticks", open: (info) => "````" + info, close: "````" },
  { name: "one space indent", open: (info) => " ```" + info, close: " ```" },
  { name: "two space indent", open: (info) => "  ```" + info, close: "  ```" },
  {
    name: "three space indent",
    open: (info) => "   ```" + info,
    close: "   ```"
  },
  { name: "longer closing run", open: (info) => "```" + info, close: "`````" }
];

for (const [index, form] of FENCE_FORMS.entries()) {
  test(`summary reader drops a ts fence and keeps prose and shell: ${form.name}`, async () => {
    const threadId = `thread-form-${index}`;
    const info = await tempWorkspace();
    await writeSummary(info, threadId, formSummary(form, threadId));

    const sources = await readSummarySources(info);
    const sections = sources.flatMap((source) =>
      source.chunks
        .filter((chunk) => chunk.kind === "section")
        .map((chunk) => ({
          sectionTitle: chunk.sectionTitle,
          text: chunk.text,
          lineStart: chunk.lineStart,
          lineEnd: chunk.lineEnd
        }))
    );

    assert.deepEqual(sections, [
      {
        sectionTitle: "Real",
        text: "Prose before. Prose middle. pnpm run kept",
        lineStart: 6,
        lineEnd: 18
      },
      { sectionTitle: "Next", text: "After.", lineStart: 19, lineEnd: 20 }
    ]);
  });
}

function formSummary(form: FenceForm, threadId: string): string {
  return [
    "Thread: `" + threadId + "`",
    "Closed: 2026-10-01T00:00:00.000Z",
    "",
    "# Summary - Forms",
    "",
    "## Real",
    "Prose before.",
    "",
    form.open("ts"),
    "const SENTINEL_CODE = 1;",
    form.close,
    "",
    "Prose middle.",
    "",
    form.open("bash"),
    "pnpm run kept",
    form.close,
    "",
    "## Next",
    "After."
  ].join("\n");
}
