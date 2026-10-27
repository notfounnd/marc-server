import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getWorkspaceInfo } from "../../src/core/workspace.js";
import type { WorkspaceInfo } from "../../src/core/types.js";
import { LocalEmbeddingProvider } from "../../src/core/memory/local-provider.js";
import { LocalQueryInterpretationProvider } from "../../src/core/memory/local-query-interpreter.js";
import { LocalRerankingProvider } from "../../src/core/memory/local-reranker.js";
import { searchChannelsByLayer } from "../../src/core/memory/layered-search.js";
import type { MemoryLayer } from "../../src/core/memory/sources/contract.js";
import type {
  MemoryLexicalField,
  MemorySearchChannels
} from "../../src/core/memory/types.js";
import type { CaptureFile } from "./capture-types.js";
import { lexicalFieldsForQueryReplica } from "./capture-channels.js";
import { disposeProviders, openCaptureContext, type CaptureProviders } from "./capture.js";
import { configuredDocumentsOf, withTemporaryWorkspace, type CorpusSource } from "./corpus.js";

/**
 * Invariance of BM25 in the real index of marc: the layer-0 channels of the same queries, searched in an
 * index of layer 0 alone and in an index of layers 0, 1 and 2. A divergence is reported, never corrected.
 * Both indexes live in temporary workspaces; the queries are read from a capture; no interpreter runs.
 */
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const CAPTURE_FILE = path.join(REPOSITORY_ROOT, ".marc", "cache", "memory-eval", "marc", "1b68a7e3f4e6", "capture.json");
const PINNED_FILE = path.join(SCRIPT_DIR, "datasets", "marc.corpus.json");
const OUTPUT_FILE = path.join(REPOSITORY_ROOT, ".marc", "cache", "memory-eval-e3", "t1c", "bm25-invariance.json");
const EXAMPLES_PER_CHANNEL = 3;
const TOP = 5;

type Ranked = { ids: string[]; scores: number[] };
type QueryChannels = { identity: Ranked; passage: Ranked; lexical: Partial<Record<MemoryLexicalField, Ranked>> };
type Query = { caseId: string; query: string };
type IndexRun = { layers: MemoryLayer[]; records: number; buildMs: number; channels: Map<string, QueryChannels> };
type Example = { caseId: string; query: string; channel: string; firstPosition: number; layer0: string[]; allLayers: string[] };
type ChannelStats = { queries: number; orderDivergent: number; setDivergent: number; maxScoreDelta: number; examples: Example[] };

export async function runBm25Invariance(): Promise<Record<string, unknown>> {
  const capture = JSON.parse(await fs.readFile(CAPTURE_FILE, "utf8")) as CaptureFile;
  const queries: Query[] = capture.cases.map((item) => ({ caseId: item.id, query: item.interpretation.effectiveQuery }));
  const pinned = JSON.parse(await fs.readFile(PINNED_FILE, "utf8")) as { threadIds: string[] };
  const source: CorpusSource = {
    threadsRoot: path.join(REPOSITORY_ROOT, ".marc", "threads"),
    threadIds: pinned.threadIds,
    rulesPath: path.join(REPOSITORY_ROOT, ".marc", "RULES.md"),
    documents: await configuredDocumentsOf({ repositoryRoot: REPOSITORY_ROOT })
  };
  const providers = providersOf(await getWorkspaceInfo(REPOSITORY_ROOT));
  try {
    const layer0 = await indexRun(source, [0], queries, providers);
    const allLayers = await indexRun(source, [0, 1, 2], queries, providers);
    const { channels, divergentCaseIds } = compareRuns(queries, layer0, allLayers);
    return {
      generatedAt: new Date().toISOString(),
      captureId: capture.captureId,
      corpus: capture.corpus,
      queries: queries.length,
      indexes: {
        layer0: { layers: layer0.layers, records: layer0.records, buildMs: layer0.buildMs },
        allLayers: { layers: allLayers.layers, records: allLayers.records, buildMs: allLayers.buildMs }
      },
      channels,
      divergentCaseIds,
      comparedFrom: "layer-0 channels: membership and order per channel, and the largest score delta of the members both runs hold"
    };
  } finally {
    await disposeProviders(providers);
  }
}

function providersOf(info: WorkspaceInfo): CaptureProviders {
  return {
    embedding: new LocalEmbeddingProvider(info),
    reranker: new LocalRerankingProvider(info),
    interpreter: new LocalQueryInterpretationProvider(info)
  };
}

/** One temporary index over `layers`: the layer-0 channels of every query, searched in that index. */
function indexRun(source: CorpusSource, layers: MemoryLayer[], queries: Query[], providers: CaptureProviders): Promise<IndexRun> {
  return withTemporaryWorkspace(source, async (info) => {
    const started = performance.now();
    const context = await openCaptureContext({ info, providers, threadIds: source.threadIds, layers });
    const buildMs = performance.now() - started;
    const channels = new Map<string, QueryChannels>();
    for (const item of queries) {
      const vector = await providers.embedding.embedQuery(item.query);
      const fields = lexicalFieldsForQueryReplica(item.query);
      const found = await searchChannelsByLayer({
        info,
        store: context.store,
        generation: context.generation,
        vector,
        queryText: item.query,
        fields,
        layers: [0]
      });
      channels.set(item.caseId, channelsOf(found, fields));
    }
    return { layers, records: context.rows.length, buildMs, channels };
  });
}

function channelsOf(found: MemorySearchChannels, fields: MemoryLexicalField[]): QueryChannels {
  const lexical: Partial<Record<MemoryLexicalField, Ranked>> = {};
  for (const field of fields) {
    lexical[field] = rankedOf(found.lexical.filter((hit) => hit.field === field));
  }
  return { identity: rankedOf(found.identities), passage: rankedOf(found.passages), lexical };
}

function rankedOf(hits: ReadonlyArray<{ record: { recordId: string }; score: number }>): Ranked {
  return { ids: hits.map((hit) => hit.record.recordId), scores: hits.map((hit) => hit.score) };
}

function compareRuns(queries: Query[], layer0: IndexRun, allLayers: IndexRun) {
  const stats = new Map<string, ChannelStats>();
  const divergentCaseIds = new Set<string>();
  for (const item of queries) {
    const a = layer0.channels.get(item.caseId);
    const b = allLayers.channels.get(item.caseId);
    if (a === undefined || b === undefined) throw new Error(`Missing channels for case ${item.caseId}.`);
    const fields = lexicalFieldsForQueryReplica(item.query);
    const pairs: Array<[string, Ranked, Ranked]> = [
      ["identity", a.identity, b.identity],
      ["passage", a.passage, b.passage],
      ...fields.map((field): [string, Ranked, Ranked] => [field, a.lexical[field] ?? emptyRanked(), b.lexical[field] ?? emptyRanked()])
    ];
    for (const [channel, left, right] of pairs) {
      const result = compareRanked(left, right);
      record(stats, channel, item, left, right, result);
      if (!result.sameOrder) divergentCaseIds.add(item.caseId);
    }
  }
  return {
    channels: Object.fromEntries(stats),
    divergentCaseIds: [...divergentCaseIds].sort()
  };
}

function emptyRanked(): Ranked {
  return { ids: [], scores: [] };
}

function compareRanked(left: Ranked, right: Ranked): { sameOrder: boolean; sameSet: boolean; firstPosition: number; maxScoreDelta: number } {
  const length = Math.max(left.ids.length, right.ids.length);
  const firstPosition = Array.from({ length }).findIndex((_, index) => left.ids[index] !== right.ids[index]);
  const rightScores = new Map(right.ids.map((id, index) => [id, right.scores[index] ?? 0]));
  const rightIds = new Set(right.ids);
  const maxScoreDelta = left.ids.reduce((largest, id, index) => {
    const other = rightScores.get(id);
    if (other === undefined) return largest;
    return Math.max(largest, Math.abs((left.scores[index] ?? 0) - other));
  }, 0);
  return {
    sameOrder: firstPosition === -1,
    sameSet: left.ids.length === right.ids.length && left.ids.every((id) => rightIds.has(id)),
    firstPosition: firstPosition === -1 ? length : firstPosition,
    maxScoreDelta
  };
}

function record(
  stats: Map<string, ChannelStats>,
  channel: string,
  item: Query,
  left: Ranked,
  right: Ranked,
  result: ReturnType<typeof compareRanked>
): void {
  const current = stats.get(channel) ?? { queries: 0, orderDivergent: 0, setDivergent: 0, maxScoreDelta: 0, examples: [] };
  const next: ChannelStats = {
    queries: current.queries + 1,
    orderDivergent: current.orderDivergent + (result.sameOrder ? 0 : 1),
    setDivergent: current.setDivergent + (result.sameSet ? 0 : 1),
    maxScoreDelta: Math.max(current.maxScoreDelta, result.maxScoreDelta),
    examples: current.examples
  };
  if (!result.sameOrder && next.examples.length < EXAMPLES_PER_CHANNEL) {
    next.examples = [
      ...next.examples,
      {
        caseId: item.caseId,
        query: item.query,
        channel,
        firstPosition: result.firstPosition,
        layer0: left.ids.slice(0, TOP),
        allLayers: right.ids.slice(0, TOP)
      }
    ];
  }
  stats.set(channel, next);
}

async function main(): Promise<void> {
  const report = await runBm25Invariance();
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`file=${OUTPUT_FILE}`);
  console.log(`divergentCases=${(report.divergentCaseIds as string[]).length} queries=${String(report.queries)}`);
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
