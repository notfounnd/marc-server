import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  ApiGet,
  MarkdownLinkHandler,
  Thread,
  Workspace
} from "../src/ui/types.js";

/** The slot loads dynamically, as the activation slot test does, so the typecheck never reaches JSX. */
const slotUrl = new URL("../src/ui/content-header-actions.tsx", import.meta.url)
  .href;

type SlotProps = {
  api: ApiGet;
  selectedThread?: Thread;
  selectedWorkspace?: Workspace;
  onOpenLink: MarkdownLinkHandler;
};

const { ThreadSessionsSlot } = (await import(slotUrl)) as {
  ThreadSessionsSlot: React.ComponentType<SlotProps>;
};

const NO_GET = (() => Promise.resolve(undefined)) as unknown as ApiGet;
const WORKSPACE = { id: "ws-a", name: "Workspace" } as unknown as Workspace;

function threadWith(status: "open" | "closed"): Thread {
  return { id: "thread-a", title: "Thread", status } as unknown as Thread;
}

function triggerHtml(status: "open" | "closed"): string {
  return renderToStaticMarkup(
    React.createElement(ThreadSessionsSlot, {
      api: NO_GET,
      selectedThread: threadWith(status),
      selectedWorkspace: WORKSPACE,
      onOpenLink: () => undefined
    })
  );
}

const CASES: ReadonlyArray<{
  name: string;
  status: "open" | "closed";
  shown: boolean;
}> = [
  {
    name: "an open thread shows the sessions trigger",
    status: "open",
    shown: true
  },
  {
    name: "a closed thread hides the sessions trigger, because its session links end with it",
    status: "closed",
    shown: false
  }
];

for (const row of CASES) {
  test(row.name, () => {
    const html = triggerHtml(row.status);

    assert.equal(html.includes("sessions-trigger"), row.shown);
  });
}
