import assert from "node:assert/strict";
import test from "node:test";
import { summaryProvenanceFixture } from "./memory-provenance-fixtures.js";
import {
  buildMemoryQueryCandidates,
  buildMemoryQueryVariants,
  interpretMemoryQuery
} from "../src/core/memory/query-interpretation.js";
import type {
  MemoryVectorRow,
  QueryInterpretationProvider
} from "../src/core/memory/types.js";

test("builds typo variants from the active memory corpus", () => {
  const variants = buildMemoryQueryVariants("toogle settings", [
    memoryRow("Toggle settings", "Configure the workspace toggle.")
  ]);

  assert.equal(variants[0], "toogle settings");
  assert.ok(variants.includes("toggle settings"));
});

test("does not treat a typo found in the corpus as authoritative", () => {
  const candidates = buildMemoryQueryCandidates("toogle", [
    memoryRow("Toggle settings", "Configure the workspace toggle."),
    memoryRow("Search experiment", "Compare toggle with toogle.")
  ]);

  const toggleIndex = candidates.variants.indexOf("toggle");
  assert.equal(candidates.variants[0], "toogle");
  assert.ok(toggleIndex > 0);
  assert.ok(candidates.suggestionOnlyIndexes.includes(toggleIndex));
});

test("combines independent typo corrections without language lists", () => {
  const variants = buildMemoryQueryVariants("interace com brutalismp", [
    memoryRow(
      "Neo-brutalism interface",
      "The interface follows the neo-brutalism design system."
    )
  ]);

  assert.ok(variants.includes("interface com brutalism"));
  assert.equal(variants.length, 2);
});

test("rejects correction candidates beyond one character edit", () => {
  const variants = buildMemoryQueryVariants("invoice tax reconciliation", [
    memoryRow("Indice", "Indice reconciliation")
  ]);

  assert.deepEqual(variants, ["invoice tax reconciliation"]);
});

test("rejects accent-only correction candidates", () => {
  const variants = buildMemoryQueryVariants("seguranca da interface", [
    memoryRow("Segurança", "Segurança da interface")
  ]);

  assert.deepEqual(variants, ["seguranca da interface"]);
});

test("keeps a corpus-backed token when its alternative has less support", () => {
  const variants = buildMemoryQueryVariants("token rotation", [
    memoryRow("Token security", "Token token tokens rotation")
  ]);

  assert.deepEqual(variants, ["token rotation"]);
});

test("preserves references paths URLs hashes and code identifiers", () => {
  const query =
    "marc://$thread-834716ba C:/Projetos/marc https://example.com memory_recall abc123ef";
  const variants = buildMemoryQueryVariants(query, [
    memoryRow("Memory recall", "Thread project example identifier")
  ]);

  assert.deepEqual(variants, [query]);
});

test("uses a valid provider selection and reports the effective query", async () => {
  const provider = new FakeQueryInterpretationProvider(["1"]);

  const interpretation = await interpretMemoryQuery({
    mode: "auto",
    originalQuery: "toogle",
    provider,
    variants: ["toogle", "toggle"]
  });

  assert.deepEqual(interpretation, {
    correctionApplied: true,
    effectiveQuery: "toggle",
    mode: "auto",
    originalQuery: "toogle",
    suggestedQuery: "toggle"
  });
  assert.equal(provider.calls.length, 1);
  assert.deepEqual(provider.calls[0]?.variants, ["toogle", "toggle"]);
  assert.match(provider.calls[0]?.feedback ?? "", /audit candidate 1/i);
});

test("keeps a corpus-backed spelling literal and exposes the alternative", async () => {
  const provider = new FakeQueryInterpretationProvider(["1"]);

  const interpretation = await interpretMemoryQuery({
    mode: "auto",
    originalQuery: "toogle",
    provider,
    suggestionOnlyIndexes: [1],
    variants: ["toogle", "toggle"]
  });

  assert.deepEqual(interpretation, {
    correctionApplied: false,
    effectiveQuery: "toogle",
    mode: "auto",
    originalQuery: "toogle",
    suggestedQuery: "toggle"
  });
});

test("rejects a selected alternative that fails semantic typo audit", async () => {
  const provider = new FakeQueryInterpretationProvider(["0"]);

  const interpretation = await interpretMemoryQuery({
    mode: "auto",
    originalQuery: "invoice tax reconciliation",
    provider,
    variants: ["invoice tax reconciliation", "indice tax reconciliation"]
  });

  assert.equal(interpretation.effectiveQuery, "invoice tax reconciliation");
  assert.equal(interpretation.correctionApplied, false);
  assert.equal(provider.calls.length, 1);
  assert.deepEqual(provider.calls[0]?.variants, [
    "invoice tax reconciliation",
    "indice tax reconciliation"
  ]);
});

test("performs one guarded loopback and falls back to the original query", async () => {
  const provider = new FakeQueryInterpretationProvider(["toggle", "9"]);

  const interpretation = await interpretMemoryQuery({
    mode: "auto",
    originalQuery: "toogle",
    provider,
    variants: ["toogle", "toggle"]
  });

  assert.equal(interpretation.effectiveQuery, "toogle");
  assert.equal(interpretation.correctionApplied, false);
  assert.equal(provider.calls.length, 2);
  assert.match(provider.calls[1]?.feedback ?? "", /integer index/i);
});

test("literal mode skips the provider", async () => {
  const provider = new FakeQueryInterpretationProvider(["1"]);

  const interpretation = await interpretMemoryQuery({
    mode: "literal",
    originalQuery: "toogle",
    provider,
    variants: ["toogle", "toggle"]
  });

  assert.equal(interpretation.effectiveQuery, "toogle");
  assert.equal(interpretation.correctionApplied, false);
  assert.equal(provider.calls.length, 0);
});

test("auto mode skips the provider when no correction candidate exists", async () => {
  const provider = new FakeQueryInterpretationProvider(["0"]);

  const interpretation = await interpretMemoryQuery({
    mode: "auto",
    originalQuery: "toggle",
    provider,
    variants: ["toggle"]
  });

  assert.equal(interpretation.effectiveQuery, "toggle");
  assert.equal(provider.calls.length, 0);
});

class FakeQueryInterpretationProvider implements QueryInterpretationProvider {
  readonly calls: Array<{ feedback?: string; variants: string[] }> = [];

  constructor(private readonly outputs: string[]) {}

  describe() {
    return {
      id: "fake-interpreter",
      model: "fake-query-model",
      name: "Fake query interpreter",
      quantized: true,
      runtime: "local" as const,
      version: "1"
    };
  }

  isPrepared(): Promise<boolean> {
    return Promise.resolve(true);
  }

  prepare(): Promise<void> {
    return Promise.resolve();
  }

  selectVariant(input: {
    feedback?: string;
    originalQuery: string;
    variants: string[];
  }): Promise<string> {
    this.calls.push({ feedback: input.feedback, variants: input.variants });
    return Promise.resolve(this.outputs.shift() ?? "0");
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}

function memoryRow(title: string, text: string): MemoryVectorRow {
  return {
    closedAt: "2026-08-01T00:00:00.000Z",
    embeddingText: text,
    kind: "passage",
    recordId: `record-${title}`,
    reference: "marc://$thread",
    relativeSummaryPath: ".marc/threads/thread/SUMMARY.md",
    sectionTitle: "Summary",
    summaryPath: "C:/workspace/.marc/threads/thread/SUMMARY.md",
    text,
    threadId: "thread",
    title,
    vector: [1, 0, 0],
    ...summaryProvenanceFixture("thread", text)
  };
}
