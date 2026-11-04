import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

/** Key lists load dynamically, as the markdown panel test does, so the typecheck never reaches JSX. */
const rowKeysUrl = new URL("../src/ui/thread-sessions-row.tsx", import.meta.url)
  .href;
const menuKeysUrl = new URL(
  "../src/ui/thread-sessions-menu.tsx",
  import.meta.url
).href;
const pendingKeysUrl = new URL(
  "../src/ui/thread-sessions-pending.tsx",
  import.meta.url
).href;
const { ROW_LABEL_KEYS } = (await import(rowKeysUrl)) as {
  ROW_LABEL_KEYS: string[];
};
const { MENU_LABEL_KEYS } = (await import(menuKeysUrl)) as {
  MENU_LABEL_KEYS: string[];
};
const { PENDING_LABEL_KEYS } = (await import(pendingKeysUrl)) as {
  PENDING_LABEL_KEYS: string[];
};

const catalog = JSON.parse(
  fs.readFileSync("public/locales/en_US/translation.json", "utf8")
) as Record<string, string>;

const SESSION_KEYS = [
  ...ROW_LABEL_KEYS,
  ...MENU_LABEL_KEYS,
  ...PENDING_LABEL_KEYS
];

test("the catalog holds no session key that no sessions module can show", () => {
  const shown = new Set(SESSION_KEYS);
  const stale = [
    "Busy",
    "Listening",
    "Past conflict",
    "Unbound",
    "Online",
    "Reserved",
    "Unknown",
    "Conflict",
    "Open with Claude Code",
    "Start new session",
    "Nothing pending.",
    "An agent is waiting for a human reply"
  ].filter((key) => !shown.has(key));

  assert.deepEqual(
    stale.filter((key) => catalog[key] !== undefined),
    []
  );
});

test("every label the sessions menu and row can show exists in the en-US catalog", () => {
  const missing = SESSION_KEYS.filter((key) => catalog[key] === undefined);

  assert.deepEqual([...new Set(missing)].sort(), []);
});

test("the en-US catalog maps each sessions label to its own key", () => {
  const differing = SESSION_KEYS.filter((key) => catalog[key] !== key);

  assert.deepEqual([...new Set(differing)].sort(), []);
});
