import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MemoryBand } from "../src/ui/types.js";

const memorySearchSignalUrl = new URL(
  "../src/ui/memory-search-signal.tsx",
  import.meta.url
).href;
const { MemorySearchBandSignal } = (await import(memorySearchSignalUrl)) as {
  MemorySearchBandSignal: React.ComponentType<{
    band: MemoryBand;
    t: (key: string) => string;
  }>;
};

const t = (key: string) => key;

const scenarios: ReadonlyArray<{
  band: MemoryBand;
  icon: string;
  label: string;
  otherIcons: ReadonlyArray<string>;
}> = [
  {
    band: "high",
    icon: "lucide-signal-high",
    label: "High confidence",
    otherIcons: ["lucide-signal-medium", "lucide-signal-low"]
  },
  {
    band: "medium",
    icon: "lucide-signal-medium",
    label: "Medium confidence",
    otherIcons: ["lucide-signal-high", "lucide-signal-low"]
  },
  {
    band: "low",
    icon: "lucide-signal-low",
    label: "Low confidence",
    otherIcons: ["lucide-signal-high", "lucide-signal-medium"]
  }
];

test("renders each band as a labelled signal icon with no visible text", () => {
  for (const scenario of scenarios) {
    const html = renderToStaticMarkup(
      React.createElement(MemorySearchBandSignal, { band: scenario.band, t })
    );

    assert.match(html, new RegExp(`class="[^"]*${scenario.icon}[^"]*"`));
    assert.ok(html.includes(`class="memory-search-signal-row"`));
    assert.match(html, /role="img"/);
    assert.ok(html.includes(`aria-label="${scenario.label}"`));
    assert.ok(html.includes(`title="${scenario.label}"`));
    assert.ok(html.includes(`data-band="${scenario.band}"`));
    for (const otherIcon of scenario.otherIcons) {
      assert.doesNotMatch(html, new RegExp(otherIcon));
    }
    assert.equal(html.replace(/<[^>]*>/g, ""), "");
    assert.doesNotMatch(html.replace(/<[^>]*>/g, ""), /\d|%|score/i);
  }
});

test("renders nothing for a band outside the dispatch table", () => {
  const html = renderToStaticMarkup(
    React.createElement(MemorySearchBandSignal, {
      band: "bogus" as unknown as MemoryBand,
      t
    })
  );

  assert.equal(html, "");
});
