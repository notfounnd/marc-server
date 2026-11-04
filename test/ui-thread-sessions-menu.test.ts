import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ThreadSessionsState } from "../src/ui/use-thread-sessions.js";
import type {
  MarkdownLinkHandler,
  SessionStateName,
  ThreadSessionSlot,
  ThreadSessionWarning,
  Translate
} from "../src/ui/types.js";
import {
  DATA_DIR,
  NEW_TEXT,
  OPEN_COMMAND,
  RESUME_TEXT,
  SLOT_BY_STATE,
  WARNINGS,
  errorState,
  readyState,
  translate,
  viewOf
} from "./ui-thread-sessions-fixtures.js";

/** Components load dynamically, as the markdown panel test does, so the typecheck never reaches JSX. */
const menuUrl = new URL("../src/ui/thread-sessions-menu.tsx", import.meta.url)
  .href;
const pendingUrl = new URL(
  "../src/ui/thread-sessions-pending.tsx",
  import.meta.url
).href;

type Expansion = { pending: boolean; other: boolean };
type BodyProps = {
  sessions: ThreadSessionsState;
  t: Translate;
  onOpenLink: MarkdownLinkHandler;
  onCopy: (text: string) => void;
  expanded: Expansion;
  onToggle: (key: keyof Expansion) => void;
};

const { ThreadSessionsBody } = (await import(menuUrl)) as {
  ThreadSessionsBody: React.ComponentType<BodyProps>;
};
const { goReference } = (await import(pendingUrl)) as {
  goReference: (warning: ThreadSessionWarning) => string | undefined;
};

const CLOSED: Expansion = { pending: false, other: false };
const OPEN: Expansion = { pending: true, other: true };
const NOOP_LINK: MarkdownLinkHandler = () => undefined;

function bodyHtml(
  sessions: ThreadSessionsState,
  expanded: Expansion = CLOSED
): string {
  return renderToStaticMarkup(
    React.createElement(ThreadSessionsBody, {
      sessions,
      t: translate,
      onOpenLink: NOOP_LINK,
      onCopy: () => undefined,
      expanded,
      onToggle: () => undefined
    })
  );
}

/** Counts the degraded-source lines in the rendered body. */
function noticeCount(html: string): number {
  return html.split('class="sessions-notice"').length - 1;
}

const STATES: SessionStateName[] = [
  "unbound",
  "online",
  "reserved",
  "ended",
  "unknown",
  "conflict"
];

/** One slot per state, each under its own profile id, so the groups can be told apart. */
const SLOT_PER_STATE: ThreadSessionSlot[] = STATES.map((state) => ({
  ...SLOT_BY_STATE[state],
  profile: `p-${state}`
}));

test("pending items show two lines, each with its own title and no concatenation", () => {
  const html = bodyHtml(readyState(viewOf({ warnings: WARNINGS })), OPEN);

  assert.ok(html.includes('title="claude-dev"'));
  assert.ok(html.includes('title="Was mentioned and has not replied yet"'));
  assert.ok(html.includes('title="Architect exchange"'));
  assert.ok(
    html.includes(
      'title="Waiting for a human message after 3 architect messages"'
    )
  );
  assert.ok(html.includes('title="ui-user"'));
  assert.ok(
    html.includes('title="claude-software-architect asked you something"')
  );
  assert.equal(html.includes('title="claude-dev Was'), false);
});

test("the pending section is titled Pending, never Warnings, and lists nothing while collapsed", () => {
  const collapsed = bodyHtml(readyState(viewOf({ warnings: WARNINGS })));
  const expanded = bodyHtml(readyState(viewOf({ warnings: WARNINGS })), OPEN);

  assert.equal(collapsed.includes("Was mentioned"), false);
  assert.equal(collapsed.includes('class="sessions-eyebrow">Pending<'), false);
  assert.ok(expanded.includes('class="sessions-eyebrow">Pending<'));
  assert.equal(expanded.includes("Warnings"), false);
  assert.equal(expanded.includes("warning"), false);
});

test("each pending item's go-to button targets the last message of its warning", () => {
  assert.equal(goReference(WARNINGS[0]), "marc://#msg_aaa111");
  assert.equal(goReference(WARNINGS[1]), "marc://#msg_ccc333");
  assert.equal(goReference(WARNINGS[2]), "marc://#msg_ddd444");

  const html = bodyHtml(readyState(viewOf({ warnings: WARNINGS })), OPEN);

  assert.ok(html.includes('data-reference="marc://#msg_aaa111"'));
  assert.ok(html.includes('data-reference="marc://#msg_ccc333"'));
  assert.ok(html.includes('data-reference="marc://#msg_ddd444"'));
  assert.equal(html.includes('data-reference="marc://#msg_bbb222"'), false);
  assert.ok(html.includes('aria-label="Go to the message"'));
  assert.ok(html.includes('aria-label="Go to the latest message"'));
  assert.ok(html.includes('aria-label="Go to the question"'));
});

test("with no warnings an open pending panel shows no pending section", () => {
  const html = bodyHtml(readyState(viewOf({ warnings: [] })), OPEN);

  assert.equal(html.includes('class="sessions-eyebrow">Pending<'), false);
});

test("the slots group into Active, Ended and a collapsed Other profiles toggle, in that order", () => {
  const html = bodyHtml(
    readyState(viewOf({ slots: SLOT_PER_STATE, warnings: [] }))
  );
  const active = html.indexOf(">Active<");
  const ended = html.indexOf(">Ended<");
  const other = html.indexOf("Other profiles · 1");

  assert.ok(active >= 0);
  assert.ok(ended > active);
  assert.ok(other > ended);
  ["p-online", "p-reserved", "p-unknown", "p-conflict"].forEach((name) => {
    const at = html.indexOf(`>${name}<`);
    assert.ok(at > active && at < ended, `${name} is active`);
  });
  assert.ok(
    html.indexOf(">p-ended<") > ended && html.indexOf(">p-ended<") < other
  );
  assert.equal(html.includes(">p-unbound<"), false);
  assert.ok(html.includes('aria-expanded="false"'));
});

test("the Other profiles rows show only when that toggle is open", () => {
  const sessions = readyState(viewOf({ slots: SLOT_PER_STATE, warnings: [] }));

  assert.equal(bodyHtml(sessions, CLOSED).includes(">p-unbound<"), false);
  assert.ok(bodyHtml(sessions, OPEN).includes(">p-unbound<"));
});

test("an empty group is not rendered, and a body with only open slots has no Other toggle", () => {
  const onlyOnline = [SLOT_PER_STATE[1]];
  const html = bodyHtml(
    readyState(viewOf({ slots: onlyOnline, warnings: [] }))
  );

  assert.ok(html.includes(">Active<"));
  assert.equal(html.includes(">Ended<"), false);
  assert.equal(html.includes("Other profiles"), false);
});

test("the body never renders a command, its argv, the data directory, or the copied text", () => {
  const view = viewOf({ slots: SLOT_PER_STATE, warnings: WARNINGS });
  const html = bodyHtml(readyState(view), OPEN);

  assert.equal(html.includes(DATA_DIR), false);
  assert.equal(html.includes("--data-dir"), false);
  assert.equal(html.includes(OPEN_COMMAND.shell), false);
  assert.equal(html.includes(NEW_TEXT), false);
  assert.equal(html.includes(RESUME_TEXT), false);
  assert.equal(html.includes("argv"), false);
  assert.equal(html.includes("route-owner-token"), false);
});

test("a healthy menu shows no source line and no sources footer", () => {
  const html = bodyHtml(readyState(viewOf({})));

  assert.equal(html.includes("sessions-notice"), false);
  assert.equal(html.includes("Sources"), false);
  assert.equal(html.includes("Claude Code session list"), false);
  assert.equal(html.includes("Session registry"), false);
  assert.equal(html.includes("Listening check"), false);
});

test("when agents are unavailable one plain line says the states may show as unknown", () => {
  const html = bodyHtml(
    readyState(
      viewOf({
        sources: { agents: "unavailable", mcpLeases: 0, listening: "available" }
      })
    )
  );

  assert.equal(noticeCount(html), 1);
  assert.ok(
    html.includes(
      "Claude Code session list unavailable. States may show as unknown."
    )
  );
});

test("an unreadable registry blocks opening, in one plain line", () => {
  const html = bodyHtml(
    readyState(
      viewOf({ registry: { status: "invalid", reason: "invalid_json" } })
    )
  );

  assert.equal(noticeCount(html), 1);
  assert.ok(
    html.includes(
      "Session registry unreadable. Opening sessions is blocked until it is recovered."
    )
  );
  assert.equal(html.includes("See Sessions and ownership"), false);
});

test("a lost registry also points to the docs section on ownership", () => {
  const html = bodyHtml(
    readyState(
      viewOf({ registry: { status: "invalid", reason: "registry_lost" } })
    )
  );

  assert.ok(
    html.includes(
      "Session registry unreadable. Opening sessions is blocked until it is recovered. See Sessions and ownership in the docs."
    )
  );
  assert.equal(noticeCount(html), 1);
});

test("an unreadable registry outranks unavailable agents, so only the registry line shows", () => {
  const html = bodyHtml(
    readyState(
      viewOf({
        registry: { status: "invalid", reason: "registry_lost" },
        sources: { agents: "unavailable", mcpLeases: 0, listening: "available" }
      })
    )
  );

  assert.equal(noticeCount(html), 1);
  assert.equal(html.includes("Claude Code session list"), false);
});

test("a failed fetch shows Sessions unavailable with its reason", () => {
  const html = bodyHtml(errorState("Not found"));

  assert.ok(html.includes("Sessions unavailable"));
  assert.ok(html.includes("Not found"));
});

test("a loading fetch shows the loading note", () => {
  assert.ok(
    bodyHtml({ key: "ws:t", status: "loading" }).includes("Loading sessions")
  );
});

test("an empty slot list shows its note", () => {
  const html = bodyHtml(readyState(viewOf({ slots: [], warnings: [] })));

  assert.ok(html.includes("No agent profiles to show."));
  assert.equal(html.includes("Nothing pending."), false);
});
