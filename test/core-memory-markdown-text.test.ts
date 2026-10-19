import assert from "node:assert/strict";
import test from "node:test";
import { markdownToIndexText } from "../src/core/memory/sources/markdown-text.js";

const CONVERSION_SCENARIOS: Array<{
  name: string;
  markdown: string;
  expected: string;
}> = [
  {
    name: "plan example: inline code keeps its text and hyphens become spaces",
    markdown: "`field-aware-hybrid-v2`",
    expected: "field aware hybrid v2"
  },
  {
    name: "plan example: underscored identifiers become spaces",
    markdown: "memory_deep e snake_case_name",
    expected: "memory deep e snake case name"
  },
  {
    name: "plan example: link text and url are both kept",
    markdown: "[ADR 0001](docs/adrs/0001-markdown-source-of-truth.md)",
    expected: "ADR 0001 docs/adrs/0001 markdown source of truth.md"
  },
  {
    name: "plan example: marc reference keeps its tokens and hyphens become spaces",
    markdown: "marc://$oportunidade-x-1234abcd",
    expected: "marc://$oportunidade x 1234abcd"
  },
  {
    name: "plan example: list marker and bold markers are removed",
    markdown: "- **Decisão:** usar --resume",
    expected: "Decisão: usar resume"
  },
  {
    name: "plan example: bash fence keeps its body",
    markdown: "```bash\npnpm memory:eval capture\n```",
    expected: "pnpm memory:eval capture"
  },
  {
    name: "plan example: json fence is removed",
    markdown: '```json\n{"status": "ok"}\n```',
    expected: ""
  },
  {
    name: "plan example: table separator is removed and pipes become spaces",
    markdown: "| a | b |\n|---|---|",
    expected: "a b"
  },
  {
    name: "link text with inline code keeps the code text",
    markdown: "[`memory_deep`](docs/x.md)",
    expected: "memory deep docs/x.md"
  },
  {
    name: "marc reference inside a link keeps the url",
    markdown: "[thread](marc://$abc-1234abcd)",
    expected: "thread marc://$abc 1234abcd"
  },
  {
    name: "rule 1: html comments are removed",
    markdown: "Before\n<!--\nhidden note\n-->\nAfter",
    expected: "Before After"
  },
  {
    name: "rule 2: text fence keeps its body",
    markdown: "```text\nvisible line\n```",
    expected: "visible line"
  },
  {
    name: "rule 2: console fence keeps its body",
    markdown: "```console\n$ pnpm test\n```",
    expected: "$ pnpm test"
  },
  {
    name: "rule 2: fence without language keeps its body",
    markdown: "```\nplain body\n```",
    expected: "plain body"
  },
  {
    name: "rule 2: language match ignores case",
    markdown: "```Bash\necho ok\n```",
    expected: "echo ok"
  },
  {
    name: "rule 2: typescript fence is removed and surrounding text is kept",
    markdown: "Before\n```ts\nconst value = 1;\n```\nAfter",
    expected: "Before After"
  },
  {
    name: "rule 3: inline code keeps its text",
    markdown: "Run `pnpm test` now",
    expected: "Run pnpm test now"
  },
  {
    name: "rule 4: image keeps its alt text",
    markdown: "![architecture diagram](img/arch.png) shown",
    expected: "architecture diagram shown"
  },
  {
    name: "rule 5: link keeps text and url",
    markdown: "[docs](https://example.com/docs) here",
    expected: "docs https://example.com/docs here"
  },
  {
    name: "rule 5: identical text and url collapse to one",
    markdown: "[https://example.com](https://example.com)",
    expected: "https://example.com"
  },
  {
    name: "rule 6: heading markers are removed",
    markdown: "## Result\n### Detail",
    expected: "Result Detail"
  },
  {
    name: "rule 6: quote marker is removed",
    markdown: "> quoted line",
    expected: "quoted line"
  },
  {
    name: "rule 6: ordered list markers are removed",
    markdown: "1. first\n2) second",
    expected: "first second"
  },
  {
    name: "rule 6: unordered list markers are removed",
    markdown: "+ plus item\n* star item\n- dash item",
    expected: "plus item star item dash item"
  },
  {
    name: "rule 6: task boxes are removed",
    markdown: "- [ ] open task\n- [x] done task",
    expected: "open task done task"
  },
  {
    name: "rule 7: emphasis markers are removed",
    markdown: "**bold** and __strong__ and *em* and _it_",
    expected: "bold and strong and em and it"
  },
  {
    name: "rule 7: markers glued to letters or digits are left for rule 10",
    markdown: "x2*3*4 and a*b*c",
    expected: "x2 3 4 and a b c"
  },
  {
    name: "rule 8: table rows lose pipes and alignment rows are removed",
    markdown: "| name | value |\n| :--- | ---: |\n| alpha | 1 |",
    expected: "name value alpha 1"
  },
  {
    name: "rule 8: table without leading pipes loses its separator",
    markdown: "a | b\n--- | ---\nc | d",
    expected: "a b c d"
  },
  {
    name: "rule 9: dash horizontal rule is removed",
    markdown: "Above\n---\nBelow",
    expected: "Above Below"
  },
  {
    name: "rule 9: asterisk and underscore horizontal rules are removed",
    markdown: "Top\n***\nMiddle\n___\nEnd",
    expected: "Top Middle End"
  },
  {
    name: "rule 9: a dash run followed by text is not a horizontal rule",
    markdown: "--- not a rule",
    expected: "not a rule"
  },
  {
    name: "rule 6: dash list marker is removed before hyphens become spaces",
    markdown: "- item",
    expected: "item"
  },
  {
    name: "rule 9: dash-only line is removed before hyphens become spaces",
    markdown: "---",
    expected: ""
  },
  {
    name: "rule 10: hyphen run becomes one space",
    markdown: "auto-idle",
    expected: "auto idle"
  },
  {
    name: "rule 10: hyphens inside a marc reference become spaces",
    markdown: "marc://$a-b-c",
    expected: "marc://$a b c"
  },
  {
    name: "rule 10: underscores become spaces",
    markdown: "thread_create",
    expected: "thread create"
  },
  {
    name: "rule 10: memory_deep becomes two words",
    markdown: "memory_deep",
    expected: "memory deep"
  },
  {
    name: "rule 10: hash sign inside text becomes a space",
    markdown: "Suporte a # para mensagens",
    expected: "Suporte a para mensagens"
  },
  {
    name: "rule 10: asterisk inside a path becomes a space",
    markdown: ".marc/threads/*/SUMMARY.md",
    expected: ".marc/threads/ /SUMMARY.md"
  },
  {
    name: "rule 10: greater-than sign inside text becomes a space",
    markdown: "a > b",
    expected: "a b"
  },
  {
    name: "rule 11: whitespace collapses and the result is trimmed",
    markdown: "  alpha\n\n   beta\t\tgamma  ",
    expected: "alpha beta gamma"
  }
];

type FenceForm = {
  name: string;
  open: (info: string) => string;
  close: string;
};

// Fence shapes accepted by the definition in fences.ts.
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

const FENCE_SCENARIOS: Array<{
  name: string;
  markdown: string;
  expected: string;
}> = [
  ...FENCE_FORMS.flatMap((form) => [
    {
      name: `${form.name} ts fence is removed`,
      markdown: `${form.open("ts")}\nconst secret = 1;\n${form.close}`,
      expected: ""
    },
    {
      name: `${form.name} text fence keeps its body`,
      markdown: `${form.open("text")}\nkept line\n${form.close}`,
      expected: "kept line"
    },
    {
      name: `${form.name} bash fence keeps its body`,
      markdown: `${form.open("bash")}\npnpm run kept\n${form.close}`,
      expected: "pnpm run kept"
    }
  ]),
  {
    name: "four spaces of indentation is not a fence",
    markdown: "    ```ts\nkept\n    ```",
    expected: "```ts kept ```"
  },
  {
    name: "a closing line with another character does not close the fence",
    markdown: "~~~text\nkept\n```\nstill kept\n~~~",
    expected: "kept ``` still kept"
  },
  {
    name: "a fence without a closing line runs to the end and is removed",
    markdown: "Before\n```ts\nconst secret = 1;",
    expected: "Before"
  },
  {
    name: "a kept fence without a closing line keeps its body",
    markdown: "```text\nkept line",
    expected: "kept line"
  }
];

for (const scenario of [...CONVERSION_SCENARIOS, ...FENCE_SCENARIOS]) {
  test(`markdownToIndexText: ${scenario.name}`, () => {
    assert.equal(markdownToIndexText(scenario.markdown), scenario.expected);
  });
}
