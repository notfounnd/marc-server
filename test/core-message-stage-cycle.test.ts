import assert from "node:assert/strict";
import test from "node:test";
import {
  addArtifactToMessage,
  parseMessages,
  renderMessage
} from "../src/core/markdown.js";
import type { ChatMessage } from "../src/core/types.js";

const BASE: ChatMessage = {
  id: "msg_1",
  threadId: "thread-1",
  timestamp: "2026-11-04T12:00:00.000Z",
  agentId: "claude-dev",
  role: "developer",
  body: "Implemented the change.",
  artifacts: []
};

/** Byte-for-byte output of a record written before stage and cycle existed. */
const OLD_RECORD = [
  "",
  "<!-- marc-message",
  "id: msg_1",
  "threadId: thread-1",
  "timestamp: 2026-11-04T12:00:00.000Z",
  "agentId: claude-dev",
  "role: developer",
  "-->",
  "",
  "Implemented the change.",
  "",
  "<!-- /marc-message -->",
  ""
].join("\n");

test("a message without stage or cycle renders byte-for-byte as before", () => {
  assert.equal(renderMessage(BASE), OLD_RECORD);
});

test("a message with stage and cycle writes both fields between role and artifacts", () => {
  const rendered = renderMessage({
    ...BASE,
    stage: "planning",
    cycle: 2,
    artifacts: ["artifacts/a.md"]
  });
  assert.ok(
    rendered.includes(
      "role: developer\nstage: planning\ncycle: 2\nartifacts: artifacts/a.md\n-->"
    )
  );
});

test("parsing returns stage and cycle when present, and no extra keys for an old record", () => {
  const parsed = parseMessages(OLD_RECORD);
  assert.deepEqual(parsed, [
    {
      id: "msg_1",
      threadId: "thread-1",
      timestamp: "2026-11-04T12:00:00.000Z",
      agentId: "claude-dev",
      role: "developer",
      body: "Implemented the change.",
      artifacts: []
    }
  ]);

  const withFields = parseMessages(
    renderMessage({ ...BASE, stage: "planning", cycle: 2 })
  );
  assert.equal(withFields[0]?.stage, "planning");
  assert.equal(withFields[0]?.cycle, 2);
});

const INVALID_CYCLE_CASES: ReadonlyArray<{
  name: string;
  value: string;
  expected: number | undefined;
}> = [
  { name: "zero", value: "0", expected: undefined },
  { name: "negative", value: "-1", expected: undefined },
  { name: "fraction", value: "1.5", expected: undefined },
  { name: "text", value: "two", expected: undefined },
  { name: "positive integer", value: "3", expected: 3 }
];

for (const row of INVALID_CYCLE_CASES) {
  test(`a stored cycle of ${row.name} is read as ${String(row.expected)}`, () => {
    const markdown = OLD_RECORD.replace(
      "role: developer\n",
      `role: developer\ncycle: ${row.value}\n`
    );
    assert.equal(parseMessages(markdown)[0]?.cycle, row.expected);
  });
}

test("adding an artifact keeps stage and cycle, and keeps a stored value that the reader ignores", () => {
  const withFields = renderMessage({ ...BASE, stage: "planning", cycle: 2 });
  const rebuilt = addArtifactToMessage(
    withFields,
    "msg_1",
    "artifacts/entrega.md"
  );
  const parsed = parseMessages(rebuilt)[0];
  assert.equal(parsed?.stage, "planning");
  assert.equal(parsed?.cycle, 2);
  assert.deepEqual(parsed?.artifacts, ["artifacts/entrega.md"]);

  const invalid = OLD_RECORD.replace(
    "role: developer\n",
    "role: developer\ncycle: 0\n"
  );
  const kept = addArtifactToMessage(invalid, "msg_1", "artifacts/entrega.md");
  assert.ok(kept.includes("cycle: 0\n"));
});

test("adding an artifact to an old record changes only the artifacts line", () => {
  const rebuilt = addArtifactToMessage(
    OLD_RECORD,
    "msg_1",
    "artifacts/entrega.md"
  );
  assert.equal(
    rebuilt,
    OLD_RECORD.replace("-->", "artifacts: artifacts/entrega.md\n-->")
  );
});

test("old and new records can sit in one thread and both parse", () => {
  const markdown = `${renderMessage(BASE)}${renderMessage({ ...BASE, id: "msg_2", stage: "execution", cycle: 1 })}`;
  const parsed = parseMessages(markdown);
  assert.deepEqual(
    parsed.map((item) => [item.id, item.stage, item.cycle]),
    [
      ["msg_1", undefined, undefined],
      ["msg_2", "execution", 1]
    ]
  );
});
