import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ThreadSessionSlot, Translate } from "../src/ui/types.js";
import {
  ARCHITECT_NEW_TEXT,
  DATA_DIR,
  NEW_TEXT,
  OPEN_COMMAND,
  POSTED_UNBOUND,
  RESUME_TEXT,
  SLOT_BY_STATE,
  WORKSPACE,
  slot,
  translate
} from "./ui-thread-sessions-fixtures.js";

/** Components load dynamically, as the markdown panel test does, so the typecheck never reaches JSX. */
const rowUrl = new URL("../src/ui/thread-sessions-row.tsx", import.meta.url)
  .href;
const { ThreadSessionRow, copySlotCommand } = (await import(rowUrl)) as {
  ThreadSessionRow: React.ComponentType<{
    slot: ThreadSessionSlot;
    t: Translate;
    onCopy: (text: string) => void;
  }>;
  copySlotCommand: (
    slot: ThreadSessionSlot,
    onCopy: (text: string) => void
  ) => void;
};

function rowHtml(value: ThreadSessionSlot): string {
  return renderToStaticMarkup(
    React.createElement(ThreadSessionRow, {
      slot: value,
      t: translate,
      onCopy: () => undefined
    })
  );
}

/** The data-tone attribute of the status dot in a rendered row. */
function toneOf(html: string): string {
  return html.match(/data-tone="([a-z]+)"/)?.[1] ?? "";
}

test("the dot is green when online, amber when reserved, unknown or in conflict, neutral when ended or unbound, and a ring when a posted profile is unbound", () => {
  assert.equal(toneOf(rowHtml(SLOT_BY_STATE.online)), "online");
  ["reserved", "unknown", "conflict"].forEach((state) => {
    const key = state as "reserved" | "unknown" | "conflict";
    assert.equal(toneOf(rowHtml(SLOT_BY_STATE[key])), "attention", state);
  });
  assert.equal(toneOf(rowHtml(SLOT_BY_STATE.ended)), "neutral");
  assert.equal(toneOf(rowHtml(SLOT_BY_STATE.unbound)), "neutral");
  assert.equal(toneOf(rowHtml(POSTED_UNBOUND)), "posted");
});

test("the sub-line reads the role, then the short state", () => {
  const cases: Array<[ThreadSessionSlot, string]> = [
    [
      slot({
        state: "online",
        details: {
          ...SLOT_BY_STATE.online.details,
          busy: true,
          reason: "owner_listed"
        }
      }),
      "developer · busy"
    ],
    [
      slot({
        state: "online",
        details: {
          ...SLOT_BY_STATE.online.details,
          busy: false,
          listening: true,
          reason: "owner_listed"
        }
      }),
      "developer · listening"
    ],
    [
      slot({
        state: "online",
        details: {
          ...SLOT_BY_STATE.online.details,
          busy: false,
          listening: false,
          reason: "owner_listed"
        }
      }),
      "developer · online"
    ],
    [SLOT_BY_STATE.reserved, "developer · reserved"],
    [SLOT_BY_STATE.ended, "developer · ended"],
    [SLOT_BY_STATE.unbound, "developer · no session"],
    [POSTED_UNBOUND, "architect · posted here, no session linked"],
    [SLOT_BY_STATE.unknown, "developer · process list unavailable"],
    [SLOT_BY_STATE.conflict, "developer · conflict recorded"],
    [
      slot({
        state: "unknown",
        details: { ...SLOT_BY_STATE.unknown.details, reason: "made_up_code" }
      }),
      "developer · state unknown"
    ]
  ];

  cases.forEach(([value, text]) => {
    assert.ok(rowHtml(value).includes(text), text);
  });
});

test("the profile id is bold and the full reason and the binding live in the row's title tooltip", () => {
  const html = rowHtml(SLOT_BY_STATE.ended);

  assert.ok(
    html.includes('<strong class="sessions-profile">claude-dev</strong>')
  );
  assert.ok(html.includes('title="The linked process is no longer running.'));
  assert.ok(html.includes("Adopted from a session outside mARC"));
  assert.ok(html.includes("Generation: 3"));
  assert.equal(html.includes("<dl"), false);
  assert.equal(html.includes("sessions-binding"), false);
  assert.equal(html.includes("sessions-chip"), false);
});

test("each row has exactly one icon button, the copy button", () => {
  Object.values(SLOT_BY_STATE).forEach((value) => {
    assert.equal(rowHtml(value).split("<button").length - 1, 1);
  });
});

test("Copy is enabled only for an ended or an unbound slot", () => {
  ["ended", "unbound"].forEach((state) => {
    const html = rowHtml(SLOT_BY_STATE[state as "ended" | "unbound"]);
    assert.equal(html.includes("disabled"), false, state);
    assert.ok(html.includes('aria-label="Copy command"'), state);
  });
  assert.equal(rowHtml(POSTED_UNBOUND).includes("disabled"), false);
});

test("a blocked Copy button names the reason in its title", () => {
  const reasons: Array<[keyof typeof SLOT_BY_STATE, string]> = [
    ["online", "Session already open"],
    ["reserved", "Session reserved"],
    ["unknown", "Session state unknown"],
    ["conflict", "Session in conflict"]
  ];

  reasons.forEach(([state, reason]) => {
    const html = rowHtml(SLOT_BY_STATE[state]);
    assert.ok(html.includes("disabled"), `${state} disabled`);
    assert.ok(html.includes(`title="${reason}"`), `${state} reason`);
  });
});

test("copying an ended or an unbound slot copies its native command text, and a blocked slot copies nothing", () => {
  const copied: string[] = [];
  const record = (text: string) => {
    copied.push(text);
  };

  copySlotCommand(SLOT_BY_STATE.ended, record);
  copySlotCommand(SLOT_BY_STATE.unbound, record);
  copySlotCommand(POSTED_UNBOUND, record);
  copySlotCommand(SLOT_BY_STATE.online, record);
  copySlotCommand(SLOT_BY_STATE.reserved, record);
  copySlotCommand(SLOT_BY_STATE.unknown, record);
  copySlotCommand(SLOT_BY_STATE.conflict, record);

  assert.deepEqual(copied, [RESUME_TEXT, NEW_TEXT, ARCHITECT_NEW_TEXT]);
});

test("the native new-session command quotes its prompt in single quotes, and the prompt has none", () => {
  assert.ok(NEW_TEXT.startsWith("claude '"));
  assert.ok(NEW_TEXT.endsWith("'"));
  const prompt = NEW_TEXT.slice("claude '".length, -1);

  assert.equal(prompt.includes("'"), false);
  assert.ok(prompt.includes("marc://$thread-1"));
  assert.equal(
    RESUME_TEXT,
    "claude --resume 7b29f3be-2d0c-456f-996a-ff29e6ee7922"
  );
});

test("no row renders the copied text, the open command, argv, the data directory, or the workspace path", () => {
  const values = [...Object.values(SLOT_BY_STATE), POSTED_UNBOUND];

  values.forEach((value) => {
    const html = rowHtml(value);
    assert.equal(html.includes(DATA_DIR), false);
    assert.equal(html.includes(WORKSPACE), false);
    assert.equal(html.includes("--data-dir"), false);
    assert.equal(html.includes(OPEN_COMMAND.shell), false);
    assert.equal(html.includes(NEW_TEXT), false);
    assert.equal(html.includes(RESUME_TEXT), false);
    assert.equal(html.includes("route-owner-token"), false);
  });
});
