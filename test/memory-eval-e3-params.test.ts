import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { funnelParamsOf } from "../scripts/memory-eval/replay-funnel.js";

/** The funnel parameters come from the command line and are never defaulted: an absent value is `undefined`. */
const ABSENT = undefined;

test("a missing budget, K or mode gives no funnel parameters at all", async () => {
  const withoutMode = await funnelParamsOf({
    budget: "232",
    k: "12",
    mode: ABSENT,
    bandCutsPath: ABSENT
  });
  assert.equal(withoutMode, undefined);
  const withoutBudget = await funnelParamsOf({
    budget: ABSENT,
    k: "12",
    mode: "cosine",
    bandCutsPath: ABSENT
  });
  assert.equal(withoutBudget, undefined);
});

test("the selection mode is taken as given, and the band cuts are optional", async () => {
  const params = await funnelParamsOf({
    budget: "232",
    k: "12",
    mode: "cosine-fts",
    bandCutsPath: ABSENT
  });
  assert.deepEqual(params, {
    budget: 232,
    k: 12,
    mode: "cosine-fts",
    cuts: ABSENT
  });
});

test("the band cuts are read from their file, and must be ordered high, medium, low", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "memory-eval-cuts-")
  );
  const ordered = path.join(directory, "ordered.json");
  const unordered = path.join(directory, "unordered.json");
  await fs.writeFile(
    ordered,
    JSON.stringify({ high: 0.9, medium: 0.6, low: 0.2 })
  );
  await fs.writeFile(
    unordered,
    JSON.stringify({ high: 0.5, medium: 0.9, low: 0.2 })
  );

  const params = await funnelParamsOf({
    budget: "232",
    k: "12",
    mode: "cosine",
    bandCutsPath: ordered
  });
  assert.deepEqual(params, {
    budget: 232,
    k: 12,
    mode: "cosine",
    cuts: { high: 0.9, medium: 0.6 }
  });
  await assert.rejects(
    funnelParamsOf({
      budget: "232",
      k: "12",
      mode: "cosine",
      bandCutsPath: unordered
    }),
    /high >= medium >= low/
  );
});
