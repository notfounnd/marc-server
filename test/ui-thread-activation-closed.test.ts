import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ApiWrite, Thread, Workspace } from "../src/ui/types.js";

/** The slot loads dynamically, as the sessions head test does, so the typecheck never reaches JSX. */
const slotUrl = new URL("../src/ui/content-header-actions.tsx", import.meta.url)
  .href;

type SlotProps = {
  apiPost: ApiWrite;
  apiPut: ApiWrite;
  selectedThread?: Thread;
  selectedWorkspace?: Workspace;
};

const { ThreadActivationSlot } = (await import(slotUrl)) as {
  ThreadActivationSlot: React.ComponentType<SlotProps>;
};

const NO_WRITE = (() => Promise.resolve(undefined)) as unknown as ApiWrite;
const WORKSPACE = { id: "ws-a", name: "Workspace" } as unknown as Workspace;

function threadWith(status: "open" | "closed"): Thread {
  return { id: "thread-a", title: "Thread", status } as unknown as Thread;
}

function triggerHtml(status: "open" | "closed"): string {
  return renderToStaticMarkup(
    React.createElement(ThreadActivationSlot, {
      apiPost: NO_WRITE,
      apiPut: NO_WRITE,
      selectedThread: threadWith(status),
      selectedWorkspace: WORKSPACE
    })
  );
}

const CASES: ReadonlyArray<{
  name: string;
  status: "open" | "closed";
  shown: boolean;
}> = [
  {
    name: "an open thread shows the activation trigger",
    status: "open",
    shown: true
  },
  {
    name: "a closed thread hides the activation trigger, because its policy is gone",
    status: "closed",
    shown: false
  }
];

for (const row of CASES) {
  test(row.name, () => {
    const html = triggerHtml(row.status);

    assert.equal(html.includes('aria-label="Activation policy"'), row.shown);
  });
}
