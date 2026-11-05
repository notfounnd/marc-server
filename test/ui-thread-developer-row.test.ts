import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ThreadSessionSlot, Translate } from "../src/ui/types.js";
import { slot, translate } from "./ui-thread-sessions-fixtures.js";

/** Components load dynamically, as the sessions menu test does, so the typecheck never reaches JSX. */
const rowUrl = new URL("../src/ui/thread-sessions-row.tsx", import.meta.url)
  .href;
const { ThreadSessionRow } = (await import(rowUrl)) as {
  ThreadSessionRow: React.ComponentType<{
    slot: ThreadSessionSlot;
    t: Translate;
    onCopy: (text: string) => void;
  }>;
};

const NOTE =
  "Developer subagents run inside an architect's session and are never bound. A fixed developer session is bound through marc open.";
const NOTE_IN_MARKUP = NOTE.replace("'", "&#x27;");

const ROWS: ReadonlyArray<{
  name: string;
  slot: ThreadSessionSlot;
  note: boolean;
  subLine: string;
}> = [
  {
    name: "an unbound developer shows the note and keeps the no session line",
    slot: slot({ profile: "claude-dev", role: "developer", state: "unbound" }),
    note: true,
    subLine: "developer · no session"
  },
  {
    name: "an unbound architect shows no developer note",
    slot: slot({
      profile: "claude-software-architect",
      role: "architect",
      state: "unbound"
    }),
    note: false,
    subLine: "architect · no session"
  },
  {
    name: "a developer with an online session shows no note",
    slot: slot({ profile: "claude-dev", role: "developer", state: "online" }),
    note: false,
    subLine: "developer · online"
  }
];

test("the developer row tooltip explains the unbound case, and only that case", () => {
  const rendered = ROWS.map((row) => ({
    name: row.name,
    html: renderToStaticMarkup(
      React.createElement(ThreadSessionRow, {
        slot: row.slot,
        t: translate,
        onCopy: () => undefined
      })
    )
  }));
  assert.deepEqual(
    rendered.map((row) => [
      row.name,
      row.html.includes(NOTE_IN_MARKUP) || row.html.includes(NOTE)
    ]),
    ROWS.map((row) => [row.name, row.note])
  );
  assert.deepEqual(
    ROWS.map((row, index) => [
      row.name,
      rendered[index].html.includes(row.subLine)
    ]),
    ROWS.map((row) => [row.name, true])
  );
});
