import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  approvalWarningOf,
  STATUS_LABEL_KEYS,
  statusNoteKeyOf
} from "../src/ui/thread-activation-status.js";
import type { Translate } from "../src/ui/types.js";

const catalog: Record<string, string> = JSON.parse(
  fs.readFileSync("public/locales/en_US/translation.json", "utf8")
);

type Call = {
  key: string;
  variables: Record<string, string | number> | undefined;
};

/** A translator that records each key and its variables, and returns the key unchanged. */
function recording(calls: Call[]): Translate {
  return (key, variables) => {
    calls.push({ key, variables });
    return key;
  };
}

const WARNING_CASES: Array<{
  name: string;
  count: number;
  call: Call;
}> = [
  {
    name: "one approval uses the singular sentence",
    count: 1,
    call: {
      key: "Saving clears the approval of 1 agent.",
      variables: undefined
    }
  },
  {
    name: "two approvals use the plural sentence with the count",
    count: 2,
    call: {
      key: "Saving clears the approval of {{count}} agents.",
      variables: { count: 2 }
    }
  },
  {
    name: "five approvals use the plural sentence with the count",
    count: 5,
    call: {
      key: "Saving clears the approval of {{count}} agents.",
      variables: { count: 5 }
    }
  }
];

for (const row of WARNING_CASES) {
  test(`approval warning: ${row.name}`, () => {
    const calls: Call[] = [];
    approvalWarningOf(row.count, recording(calls));
    assert.deepEqual(calls, [row.call]);
  });
}

const NEW_KEYS = [
  "Approved",
  "Approved to start on mention",
  "Each agent's first start asks for your approval. After that it starts on its own in this thread, within the cycles.",
  "Saving clears the approval of 1 agent.",
  "Saving clears the approval of {{count}} agents."
];

for (const key of NEW_KEYS) {
  test(`en-US catalog holds the approval key: ${key}`, () => {
    assert.equal(catalog[key], key);
  });
}

test("the switch note on the on state is the approval note of the catalog", () => {
  const key = statusNoteKeyOf(true);
  assert.equal(key, NEW_KEYS[2]);
  assert.equal(catalog[key ?? ""], key);
});

test("every panel status label exists in the en-US catalog", () => {
  const labels = STATUS_LABEL_KEYS.filter((key) => key !== "");
  assert.deepEqual(
    labels.filter((key) => catalog[key] === undefined),
    []
  );
});

/** Components load dynamically, as the other UI tests do, so the typecheck never reaches JSX. */
const listsUrl = new URL(
  "../src/ui/thread-activation-lists.tsx",
  import.meta.url
).href;
const { ParticipantsSection } = (await import(listsUrl)) as {
  ParticipantsSection: React.ComponentType<{
    participants: string[];
    lead: string | null | undefined;
    approved: string[];
    busy: boolean;
    onMakeLead: (agentId: string) => void;
    t: Translate;
  }>;
};

const APPROVED_MARK =
  '<span class="activation-approved" role="img" aria-label="Approved" title="Approved to start on mention"><svg';

/** Renders the participants with the lead as the second architect and the given approvals. */
function renderParticipants(approved: string[]): string {
  return renderToStaticMarkup(
    React.createElement(ParticipantsSection, {
      participants: ["claude-software-architect", "codex-software-architect"],
      lead: "codex-software-architect",
      approved,
      busy: false,
      onMakeLead: () => undefined,
      t: (key) => key
    })
  );
}

test("the approval mark keeps the title and the label on a span, not on the svg", () => {
  const markup = renderParticipants(["claude-software-architect"]);
  assert.equal(markup.split(APPROVED_MARK).length - 1, 1);
  assert.match(
    markup,
    /<span class="activation-approved"[^>]*><svg[^>]*aria-hidden="true"/
  );
  assert.doesNotMatch(markup, /<svg[^>]*title=/);
  assert.doesNotMatch(markup, /<title>/);
});

test("an architect without approval renders no approval mark", () => {
  const markup = renderParticipants([]);
  assert.equal(markup.includes("activation-approved"), false);
});
