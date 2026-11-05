import assert from "node:assert/strict";
import test from "node:test";
import { loadTranslations } from "../src/i18n/index.js";

/** The module is TSX, so it loads dynamically: the typecheck never reaches its JSX. */
const pauseUrl = new URL(
  "../src/ui/workspace-pause-control.tsx",
  import.meta.url
).href;
const { PAUSE_LABEL_KEYS } = (await import(pauseUrl)) as {
  PAUSE_LABEL_KEYS: string[];
};

test("the pause control and its banner use only keys of the en_US catalog", () => {
  const catalog = loadTranslations();
  assert.deepEqual(
    PAUSE_LABEL_KEYS.filter((key) => catalog[key] === undefined),
    []
  );
});

test("the pause titles name the action of the next click, in the workspace", () => {
  const catalog = loadTranslations();
  assert.deepEqual(
    [
      catalog["Pause all activations in this workspace"],
      catalog["Resume activations in this workspace"]
    ],
    [
      "Pause all activations in this workspace",
      "Resume activations in this workspace"
    ]
  );
});
