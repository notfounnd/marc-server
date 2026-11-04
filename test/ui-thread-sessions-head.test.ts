import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ThreadSessionsState } from "../src/ui/use-thread-sessions.js";
import type {
  MarkdownLinkHandler,
  ThreadSessionWarning,
  Translate
} from "../src/ui/types.js";
import {
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

type HeadProps = {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  t: Translate;
};

const {
  ThreadSessionsHead,
  PRESSED_TRIGGER_CLASS,
  closeThen,
  triggerLabel,
  warningCountOf
} = (await import(menuUrl)) as {
  ThreadSessionsHead: React.ComponentType<HeadProps>;
  PRESSED_TRIGGER_CLASS: string;
  closeThen: (
    close: () => void,
    onOpenLink: MarkdownLinkHandler
  ) => MarkdownLinkHandler;
  triggerLabel: (t: Translate, count: number) => string;
  warningCountOf: (sessions: ThreadSessionsState) => number;
};
const { goReference } = (await import(pendingUrl)) as {
  goReference: (warning: ThreadSessionWarning) => string | undefined;
};

function headHtml(count: number, expanded = false): string {
  return renderToStaticMarkup(
    React.createElement(ThreadSessionsHead, {
      count,
      expanded,
      onToggle: () => undefined,
      t: translate
    })
  );
}

test("a go-to action closes the menu first, then opens the last message of its warning", async () => {
  const calls: string[] = [];
  const go = closeThen(
    () => {
      calls.push("close");
    },
    async (href) => {
      calls.push(`open ${href}`);
    }
  );

  await go(goReference(WARNINGS[1]) ?? "");

  assert.deepEqual(calls, ["close", "open marc://#msg_ccc333"]);
});

test("the Pending chip is hidden at zero and shows the count and its state otherwise", () => {
  assert.equal(headHtml(0).includes("sessions-chip-toggle"), false);
  assert.ok(headHtml(3).includes('aria-expanded="false"'));
  assert.ok(headHtml(3).includes('class="sessions-count-chip">3<'));
  assert.ok(headHtml(3, true).includes('aria-expanded="true"'));
});

test("the trigger's accessible name is Thread sessions without warnings, and carries the count with them", () => {
  const none = warningCountOf(readyState(viewOf({ warnings: [] })));
  const some = warningCountOf(readyState(viewOf({ warnings: WARNINGS })));

  assert.equal(triggerLabel(translate, none), "Thread sessions");
  assert.equal(triggerLabel(translate, some), "Thread sessions, pending: 3");
});

test("the warning count on the button equals the number of warnings, and is zero while loading", () => {
  assert.equal(warningCountOf(readyState(viewOf({ warnings: WARNINGS }))), 3);
  assert.equal(warningCountOf(readyState(viewOf({ warnings: [] }))), 0);
  assert.equal(warningCountOf({ key: "ws:t", status: "loading" }), 0);
  assert.equal(warningCountOf(errorState("Not found")), 0);
});

test("the pressed trigger classes are on the sessions trigger and the artifact trigger", () => {
  [
    "data-[state=open]:translate-x-boxShadowX",
    "data-[state=open]:translate-y-boxShadowY",
    "data-[state=open]:shadow-none"
  ].forEach((cls) => {
    assert.ok(PRESSED_TRIGGER_CLASS.includes(cls), cls);
  });
  const menu = fs.readFileSync("src/ui/thread-sessions-menu.tsx", "utf8");
  const header = fs.readFileSync("src/ui/content-header-actions.tsx", "utf8");

  assert.ok(menu.includes("${PRESSED_TRIGGER_CLASS}"));
  assert.ok(header.includes("${PRESSED_TRIGGER_CLASS}"));
});
