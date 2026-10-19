import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  findMessageLines,
  messageLineRanges,
  readChatSources
} from "../src/core/memory/sources/chat.js";
import { sectionsOrOverview } from "../src/core/memory/sources/sections.js";
import { readSummarySources } from "../src/core/memory/sources/summary.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import { tempWorkspace, writeSummary } from "./memory-test-helpers.js";

const SECTION_SCENARIOS: Array<{
  name: string;
  markdown: string;
  levels: number[];
  expected: Array<[string, number, number]>;
}> = [
  {
    name: "summary levels ignore third-level headings",
    markdown: "## Alpha\nbody\n### Beta\nmore",
    levels: [2],
    expected: [["Alpha", 1, 4]]
  },
  {
    name: "rules levels split on third-level headings too",
    markdown: "## Alpha\nbody\n### Beta\nmore",
    levels: [2, 3],
    expected: [
      ["Alpha", 1, 2],
      ["Beta", 3, 4]
    ]
  },
  {
    name: "text before the first heading is discarded",
    markdown: "intro\n## Alpha\nbody",
    levels: [2],
    expected: [["Alpha", 2, 3]]
  },
  {
    name: "a heading without a title stays body text",
    markdown: "## Alpha\n##   \nbody\n## Beta\ntext",
    levels: [2],
    expected: [
      ["Alpha", 1, 3],
      ["Beta", 4, 5]
    ]
  },
  {
    name: "a trailing newline does not add a line",
    markdown: "## Alpha\nbody\n",
    levels: [2],
    expected: [["Alpha", 1, 2]]
  },
  {
    name: "a first-level heading is body text",
    markdown: "# Title\n## Alpha\nx",
    levels: [2],
    expected: [["Alpha", 2, 3]]
  },
  {
    name: "a file without headings becomes one Overview section",
    markdown: "plain\ntext",
    levels: [2],
    expected: [["Overview", 1, 2]]
  },
  {
    name: "a file without indexable text yields no section",
    markdown: "",
    levels: [2],
    expected: []
  }
];

test("section scenarios keep the requested levels and lines", () => {
  for (const scenario of SECTION_SCENARIOS) {
    const sections = sectionsOrOverview(scenario.markdown, scenario.levels);
    assert.deepEqual(
      sections.map((section) => [
        section.title,
        section.lineStart,
        section.lineEnd
      ]),
      scenario.expected,
      scenario.name
    );
  }
});

test("message line ranges point at each marker pair", () => {
  assert.deepEqual(messageLineRanges(chatMarkdown()), [
    { messageId: "msg-1", lineStart: 6, lineEnd: 15 },
    { messageId: "msg-2", lineStart: 17, lineEnd: 27 }
  ]);
});

test("findMessageLines returns the range for an id and undefined when absent", () => {
  const ranges = messageLineRanges(chatMarkdown());

  assert.deepEqual(findMessageLines(ranges, "msg-2"), {
    messageId: "msg-2",
    lineStart: 17,
    lineEnd: 27
  });
  assert.equal(findMessageLines(ranges, "msg-missing"), undefined);
});

test("chat sources yield one section per message with ids and marker lines", async () => {
  const info = await tempWorkspace();
  await writeSummary(
    info,
    "thread-chat",
    closedSummary("thread-chat", "Chat thread")
  );
  await writeMarcFile(info, "threads/thread-chat/CHAT.md", chatMarkdown());

  const [chat] = await readChatSources(info);

  assert.equal(chat?.sourceType, "chat");
  assert.equal(chat?.threadId, "thread-chat");
  assert.equal(chat?.title, "Thread title");
  assert.equal(chat?.authority, "conversation");
  assert.equal(chat?.sourcePath, ".marc/threads/thread-chat/CHAT.md");
  assert.deepEqual(
    chat?.chunks.map((chunk) => [
      chunk.recordId,
      chunk.messageId,
      chunk.agentId,
      chunk.lineStart,
      chunk.lineEnd
    ]),
    [
      ["thread-chat:chat:msg-1", "msg-1", "agent-a", 6, 15],
      ["thread-chat:chat:msg-2", "msg-2", "agent-b", 17, 27]
    ]
  );
  assert.deepEqual(
    chat?.chunks.map((chunk) => [chunk.sectionTitle, chunk.text]),
    [
      ["agent-a 2026-10-01T00:00:01.000Z", "First body line."],
      ["agent-b 2026-10-01T00:00:02.000Z", "Second body."]
    ]
  );
});

test("chat of an open thread without SUMMARY.md is ignored", async () => {
  const info = await tempWorkspace();
  await writeMarcFile(info, "threads/thread-open-chat/CHAT.md", chatMarkdown());

  assert.deepEqual(await readChatSources(info), []);
});

test("summary chunks carry no chat or artifact origin fields", async () => {
  const info = await tempWorkspace();
  await writeSummary(
    info,
    "thread-plain-origin",
    closedSummary("thread-plain-origin", "Origin thread")
  );

  const [summary] = await readSummarySources(info);

  for (const chunk of summary?.chunks ?? []) {
    assert.equal("messageId" in chunk, false);
    assert.equal("agentId" in chunk, false);
    assert.equal("artifactFileName" in chunk, false);
  }
});

function closedSummary(threadId: string, title: string): string {
  return [
    `# Summary - ${title}`,
    "",
    `Thread: \`${threadId}\``,
    "",
    "## Result",
    "",
    "Done."
  ].join("\n");
}

function chatMarkdown(): string {
  return [
    "# Thread title",
    "",
    "Thread: `thread-chat`",
    "Created: `2026-10-01T00:00:00.000Z`",
    "",
    "<!-- marc-message",
    "id: msg-1",
    "threadId: thread-chat",
    "timestamp: 2026-10-01T00:00:01.000Z",
    "agentId: agent-a",
    "-->",
    "",
    "First body line.",
    "",
    "<!-- /marc-message -->",
    "",
    "<!-- marc-message",
    "id: msg-2",
    "threadId: thread-chat",
    "timestamp: 2026-10-01T00:00:02.000Z",
    "agentId: agent-b",
    "role: reviewer",
    "-->",
    "",
    "Second body.",
    "",
    "<!-- /marc-message -->"
  ].join("\n");
}

async function writeMarcFile(
  info: WorkspaceInfo,
  relativePath: string,
  content: string
): Promise<void> {
  await writeFileAt(
    path.join(info.marcPath, ...relativePath.split("/")),
    content
  );
}

async function writeFileAt(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}
