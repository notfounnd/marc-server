import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { WorkspaceInfo } from "../../src/core/types.js";
import { getWorkspaceInfo } from "../../src/core/workspace.js";
import { LocalEmbeddingProvider } from "../../src/core/memory/local-provider.js";
import { LocalQueryInterpretationProvider } from "../../src/core/memory/local-query-interpreter.js";
import { LocalRerankingProvider } from "../../src/core/memory/local-reranker.js";
import { captureMemoryEval, type CaptureProviders } from "./capture.js";
import { queryFingerprintCases, sha256Json } from "./capture-fingerprint.js";
import type { CaptureFile } from "./capture-types.js";
import { replayCapture } from "./replay.js";
import { PRODUCTION_RECALL_ID, isRankingVariantId } from "./variants.js";
import {
  REPORT_VARIANTS,
  buildReport,
  readRaterPairs,
  renderMarkdown
} from "./report.js";
import { compareCaptures } from "./compare.js";
import { measureCaptureLatency, readLatencyFile } from "./latency.js";
import {
  buildWorksheet,
  commitMerge,
  mergeJudgments,
  writeMergeReport,
  type MergeReport
} from "./judgments.js";
import { writeFileAtomically } from "../../src/core/write-coordination.js";
import {
  buildValidationCorpus,
  validateDataset,
  type CorpusIndex,
  type EvalDataset,
  type PinnedCorpus,
  type ValidationIssue
} from "./dataset.js";

const MEMORY_EVAL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(MEMORY_EVAL_DIR, "..", "..");

type CorpusRegistration = {
  datasetPath: string;
  pinnedPath: string;
  threadsPath: string;
  rulesPath: string;
  productionManifestPath?: string;
};

const CORPORA: ReadonlyMap<string, CorpusRegistration> = new Map<
  string,
  CorpusRegistration
>([
  [
    "marc",
    {
      datasetPath: path.join(MEMORY_EVAL_DIR, "datasets", "marc.json"),
      pinnedPath: path.join(MEMORY_EVAL_DIR, "datasets", "marc.corpus.json"),
      threadsPath: path.join(REPOSITORY_ROOT, ".marc", "threads"),
      rulesPath: path.join(REPOSITORY_ROOT, ".marc", "RULES.md"),
      productionManifestPath: path.join(
        REPOSITORY_ROOT,
        ".marc",
        "memory",
        "manifest.json"
      )
    }
  ],
  [
    "ledgerline-en",
    {
      datasetPath: path.join(MEMORY_EVAL_DIR, "datasets", "ledgerline-en.json"),
      pinnedPath: path.join(MEMORY_EVAL_DIR, "datasets", "ledgerline-en.corpus.json"),
      threadsPath: path.join(
        REPOSITORY_ROOT,
        "test",
        "fixtures",
        "memory-eval",
        "ledgerline-en",
        "threads"
      ),
      rulesPath: path.join(
        REPOSITORY_ROOT,
        "test",
        "fixtures",
        "memory-eval",
        "ledgerline-en",
        "RULES.md"
      )
    }
  ]
]);

type CommandOptions = ReadonlyMap<string, string>;
type CommandHandler = (options: CommandOptions) => Promise<number>;

type ThreadSummary = {
  threadId: string;
  markdown: string;
};

function isClosedSummary(markdown: string): boolean {
  return /^Closed: `/m.test(markdown);
}

async function readThreadSummary(
  threadsPath: string,
  threadId: string
): Promise<ThreadSummary | undefined> {
  const markdown = await fs
    .readFile(path.join(threadsPath, threadId, "SUMMARY.md"), "utf8")
    .catch(() => undefined);
  if (markdown === undefined) return undefined;
  return { threadId, markdown };
}

/** Reads the closed threads of a corpus, read-only. */
export async function readClosedThreads(threadsPath: string): Promise<CorpusIndex> {
  const entries = await fs.readdir(threadsPath, { withFileTypes: true });
  const summaries = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readThreadSummary(threadsPath, entry.name))
  );
  const closed = summaries.filter(
    (summary): summary is ThreadSummary =>
      summary !== undefined && isClosedSummary(summary.markdown)
  );
  return new Map(closed.map((summary) => [summary.threadId, summary.markdown] as const));
}

/** Reads the frozen corpus: the thread ids that captures and validation use. */
async function readPinnedCorpus(pinnedPath: string): Promise<PinnedCorpus> {
  return JSON.parse(await fs.readFile(pinnedPath, "utf8")) as PinnedCorpus;
}

async function validationCorpus(
  registration: CorpusRegistration
): Promise<ReturnType<typeof buildValidationCorpus>> {
  const pinned = await readPinnedCorpus(registration.pinnedPath);
  const closed = await readClosedThreads(registration.threadsPath);
  return buildValidationCorpus(pinned, closed);
}

function optionValue(next: string | undefined): string | undefined {
  if (next === undefined || next.startsWith("--")) return undefined;
  return next;
}

/** Parses `--name value` pairs and bare `--flag` options, which become "true". */
function parseOptions(args: readonly string[]): CommandOptions {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; ) {
    const name = args[index].replace(/^--/, "");
    const value = optionValue(args[index + 1]);
    options.set(name, value ?? "true");
    index += 1 + Number(value !== undefined);
  }
  return options;
}

function printIssue(issue: ValidationIssue): void {
  console.log(`${issue.rule} ${issue.caseId}: ${issue.detail}`);
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** Returns the file text, or undefined when the file does not exist. */
async function readOptionalText(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error: unknown) {
    if (isMissingFile(error)) return undefined;
    throw error;
  }
}

async function readDataset(
  corpusName: string,
  registration: CorpusRegistration
): Promise<EvalDataset | undefined> {
  const content = await readOptionalText(registration.datasetPath);
  if (content === undefined) {
    console.error(
      `Dataset not found for corpus ${corpusName}: ${registration.datasetPath}. Create it from the reviewed judgments before running this command.`
    );
    return undefined;
  }
  const dataset = JSON.parse(content) as EvalDataset;
  if (dataset.corpus === corpusName) return dataset;
  console.error(`Dataset declares corpus ${dataset.corpus}, expected ${corpusName}`);
  return undefined;
}

async function validateCommand(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const { corpus, issues: pinnedIssues } = await validationCorpus(registration);
  const { issues } = validateDataset(dataset, corpus);
  const allIssues = [...pinnedIssues, ...issues];
  console.log(
    `corpus=${corpusName} cases=${dataset.cases.length} pinnedThreads=${corpus.size} issues=${allIssues.length}`
  );
  allIssues.forEach(printIssue);
  if (allIssues.length > 0) return 1;
  return 0;
}

/**
 * Local providers load models from the production workspace cache. The
 * temporary workspace only receives the store and the manifest of the rebuild.
 */
function createLocalProviders(modelInfo: WorkspaceInfo): CaptureProviders {
  return {
    embedding: new LocalEmbeddingProvider(modelInfo),
    reranker: new LocalRerankingProvider(modelInfo),
    interpreter: new LocalQueryInterpretationProvider(modelInfo)
  };
}

async function captureCommand(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const { corpus, issues: pinnedIssues } = await validationCorpus(registration);
  const { issues } = validateDataset(dataset, corpus);
  const allIssues = [...pinnedIssues, ...issues];
  if (allIssues.length > 0) {
    allIssues.forEach(printIssue);
    console.error("The dataset or the pinned corpus is invalid; the capture was not started.");
    return 1;
  }
  const pinned = await readPinnedCorpus(registration.pinnedPath);
  const modelInfo = await getWorkspaceInfo(REPOSITORY_ROOT);
  const result = await captureMemoryEval({
    dataset,
    source: {
      threadsRoot: registration.threadsPath,
      threadIds: pinned.threadIds,
      rulesPath: registration.rulesPath
    },
    outputRoot: path.join(REPOSITORY_ROOT, ".marc", "cache", "memory-eval"),
    repositoryRoot: REPOSITORY_ROOT,
    createProviders: () => createLocalProviders(modelInfo),
    productionManifestPath: registration.productionManifestPath,
    resume: options.get("resume") === "true",
    log: (line) => process.stderr.write(`${line}\n`)
  });
  console.log(
    `captureId=${result.captureId} dir=${result.captureDir} cases=${result.cases} executed=${result.executedCases} skipped=${result.skippedCases} durationMs=${result.durationMs.toFixed(0)}`
  );
  return 0;
}

const DEFAULT_VARIANTS = "M0,D0,ORACLE_ADMISSION";

async function replayCommand(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  const captureId = options.get("capture");
  if (captureId === undefined) {
    console.error(
      "Usage: memory:eval replay --capture <captureId> [--corpus marc] [--variants M0,D0,ORACLE_ADMISSION]"
    );
    return 2;
  }
  const variantIds = (options.get("variants") ?? DEFAULT_VARIANTS)
    .split(",")
    .map((id) => id.trim());
  const unknown = variantIds.filter((id) => !isRankingVariantId(id));
  if (unknown.length > 0) {
    console.error(`Unknown ranking variants: ${unknown.join(", ")}`);
    return 2;
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const captureDir = path.join(
    REPOSITORY_ROOT,
    ".marc",
    "cache",
    "memory-eval",
    corpusName,
    captureId
  );
  const capture = JSON.parse(
    await fs.readFile(path.join(captureDir, "capture.json"), "utf8")
  ) as CaptureFile;
  const currentQueries = sha256Json(queryFingerprintCases(dataset.cases));
  if (currentQueries !== capture.fingerprint.queryFingerprint) {
    console.error(
      "The dataset queries differ from the capture. Capture again before replaying."
    );
    return 1;
  }
  const result = await replayCapture({ capture, dataset, variantIds });
  const outputPath = path.join(
    captureDir,
    `replay-${variantIds.join("-")}.json`
  );
  await writeFileAtomically(outputPath, JSON.stringify(result));
  const failed = result.failedCaseIds.join(",") || "none";
  const delta = result.scoreDelta;
  console.log(
    `captureId=${captureId} equivalence=${result.equivalence} cases=${result.cases.length} failed=${failed} scoreDelta(median,p95,max)=${delta.median?.toExponential(2) ?? "n/a"},${delta.p95?.toExponential(2) ?? "n/a"},${delta.max?.toExponential(2) ?? "n/a"} output=${outputPath}`
  );
  if (result.equivalence === "failed") return 1;
  return 0;
}

function captureDirectoryOf(corpusName: string, captureId: string): string {
  return path.join(REPOSITORY_ROOT, ".marc", "cache", "memory-eval", corpusName, captureId);
}

async function readCaptureFileOf(corpusName: string, captureId: string): Promise<CaptureFile> {
  const content = await fs.readFile(
    path.join(captureDirectoryOf(corpusName, captureId), "capture.json"),
    "utf8"
  );
  return JSON.parse(content) as CaptureFile;
}

async function reportCommand(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  const captureId = options.get("capture");
  if (captureId === undefined) {
    console.error("Usage: memory:eval report --capture <captureId> [--corpus marc] [--raters a.json,b.json]");
    return 2;
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const capture = await readCaptureFileOf(corpusName, captureId);
  const currentQueries = sha256Json(queryFingerprintCases(dataset.cases));
  if (currentQueries !== capture.fingerprint.queryFingerprint) {
    console.error("The dataset queries differ from the capture. Capture again before reporting.");
    return 1;
  }
  const latency = await readLatencyFile(captureDirectoryOf(corpusName, captureId), captureId).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    return undefined;
  });
  if (latency === undefined) return 1;
  const replay = await replayCapture({ capture, dataset, variantIds: [...REPORT_VARIANTS, PRODUCTION_RECALL_ID] });
  const ratersArgument = options.get("raters");
  const raters = ratersArgument === undefined
    ? undefined
    : await readRaterPairs(...splitPair(ratersArgument));
  const report = await buildReport({ capture, dataset, replay, latency, raters });
  const directory = captureDirectoryOf(corpusName, captureId);
  await writeFileAtomically(path.join(directory, "report.json"), JSON.stringify(report, null, 2));
  await writeFileAtomically(path.join(directory, "report.md"), renderMarkdown(report));
  console.log(
    `captureId=${captureId} equivalence=${report.equivalence.status} M0=${report.variants.M0?.status ?? "n/a"} report=${path.join(directory, "report.md")}`
  );
  return 0;
}

function splitPair(argument: string): [string, string] {
  const [first, second] = argument.split(",").map((item) => item.trim());
  if (first === undefined || second === undefined) throw new Error("Expected two comma-separated files.");
  return [first, second];
}

function parseSide(argument: string | undefined): { captureId: string; variant: string } | undefined {
  if (argument === undefined) return undefined;
  const [captureId, variant] = argument.split(":");
  if (captureId === undefined || variant === undefined) return undefined;
  return { captureId, variant };
}

async function compareCommand(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  const baseline = parseSide(options.get("baseline"));
  const candidate = parseSide(options.get("candidate"));
  if (baseline === undefined || candidate === undefined) {
    console.error("Usage: memory:eval compare --baseline <captureId>:<variant> --candidate <captureId>:<variant> [--corpus marc]");
    return 2;
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const baselineCapture = await readCaptureFileOf(corpusName, baseline.captureId);
  const candidateCapture = await readCaptureFileOf(corpusName, candidate.captureId);
  const result = await compareCaptures({
    dataset,
    baseline: { capture: baselineCapture, variant: baseline.variant },
    candidate: { capture: candidateCapture, variant: candidate.variant }
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    return undefined;
  });
  if (result === undefined) return 1;
  const outputPath = path.join(
    captureDirectoryOf(corpusName, candidate.captureId),
    `compare-${baseline.captureId}-${baseline.variant}-vs-${candidate.captureId}-${candidate.variant}.json`
  );
  await writeFileAtomically(outputPath, JSON.stringify(result, null, 2));
  console.log(`verdict=${result.verdict} baseline=${baseline.captureId}:${baseline.variant} candidate=${candidate.captureId}:${candidate.variant} output=${outputPath}`);
  for (const row of result.rows) {
    console.log(`${row.scope} ${row.metric} difference=${row.difference ?? "n/a"} term=${row.term ?? "n/a"}`);
  }
  if (result.verdict === "incomplete") return 1;
  return 0;
}

async function worksheetCommand(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  const captureId = options.get("capture");
  if (captureId === undefined) {
    console.error("Usage: memory:eval worksheet --capture <captureId> [--corpus marc] [--variants v1,v2]");
    return 2;
  }
  const variants = splitList(options.get("variants"));
  const unknown = variants.filter((id) => !isRankingVariantId(id));
  if (unknown.length > 0) {
    console.error(`Unknown ranking variants: ${unknown.join(", ")}`);
    return 2;
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const capture = await readCaptureFileOf(corpusName, captureId);
  if (sha256Json(queryFingerprintCases(dataset.cases)) !== capture.fingerprint.queryFingerprint) {
    console.error("The dataset queries differ from the capture. Capture again before the worksheet.");
    return 1;
  }
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: [...new Set(["M0", "D0", ...variants])]
  });
  const pinned = await readPinnedCorpus(registration.pinnedPath);
  const worksheet = await buildWorksheet({
    capture,
    dataset,
    replay,
    source: {
      threadsRoot: registration.threadsPath,
      threadIds: pinned.threadIds,
      rulesPath: registration.rulesPath
    },
    variants
  });
  const directory = captureDirectoryOf(corpusName, captureId);
  await writeFileAtomically(path.join(directory, "worksheet.md"), `${worksheet.markdown}\n`);
  await writeFileAtomically(
    path.join(directory, "worksheet-template.json"),
    `${JSON.stringify(worksheet.template, null, 2)}\n`
  );
  console.log(
    `captureId=${captureId} pendingPairs=${worksheet.pending} worksheet=${path.join(directory, "worksheet.md")} template=${path.join(directory, "worksheet-template.json")}`
  );
  return 0;
}

async function mergeCommand(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  const inputs = options.get("inputs");
  if (inputs === undefined) {
    console.error("Usage: memory:eval merge-judgments --corpus marc --inputs a.json,b.json [--consensus c.json]");
    return 2;
  }
  const [first, second] = splitPair(inputs);
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const corpus = await validationCorpus(registration);
  if (corpus.issues.length > 0) {
    corpus.issues.forEach(printIssue);
    return 1;
  }
  const consensusPath = options.get("consensus");
  const outcome = mergeJudgments({
    dataset,
    corpus: corpus.corpus,
    raterA: await readJson(first),
    raterB: await readJson(second),
    consensus: consensusPath === undefined ? undefined : await readJson(consensusPath)
  });
  const committed = await commitMerge({ datasetPath: registration.datasetPath, outcome });
  const reportPath = await writeMergeReport(
    path.join(REPOSITORY_ROOT, ".marc", "cache", "memory-eval", corpusName),
    outcome.report,
    new Date()
  );
  printMergeReport(outcome.report, committed, reportPath);
  if (outcome.report.issues.length > 0) return 1;
  return 0;
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
}

function splitList(value: string | undefined): string[] {
  if (value === undefined) return [];
  return value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
}

function printMergeReport(report: MergeReport, committed: boolean, reportPath: string): void {
  console.log(
    `pairs=${report.pairs} concordant=${report.concordant} kappa=${report.kappa ?? "n/a"} divergences=${report.divergences.length} unresolved=${report.unresolved.length} written=${report.written.length} alreadyPresent=${report.alreadyPresent} conflicts=${report.conflicts.length} committed=${committed}`
  );
  for (const flag of report.flags) console.log(`flag: ${flag}`);
  for (const conflict of report.conflicts) {
    console.log(`conflict ${conflict.caseId}/${conflict.threadId}: existing=${conflict.existing} proposed=${conflict.proposed}`);
  }
  for (const issue of report.issues) printIssue(issue);
  console.log(`report=${reportPath}`);
}

/** Measures latency of a complete capture into latency.json. Run it on a quiet machine. */
async function latencyCommand(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const { corpus, issues: pinnedIssues } = await validationCorpus(registration);
  const { issues } = validateDataset(dataset, corpus);
  const allIssues = [...pinnedIssues, ...issues];
  if (allIssues.length > 0) {
    allIssues.forEach(printIssue);
    console.error("The dataset or the pinned corpus is invalid; the latency was not measured.");
    return 1;
  }
  const pinned = await readPinnedCorpus(registration.pinnedPath);
  const modelInfo = await getWorkspaceInfo(REPOSITORY_ROOT);
  const result = await measureCaptureLatency({
    dataset,
    source: {
      threadsRoot: registration.threadsPath,
      threadIds: pinned.threadIds,
      rulesPath: registration.rulesPath
    },
    outputRoot: path.join(REPOSITORY_ROOT, ".marc", "cache", "memory-eval"),
    repositoryRoot: REPOSITORY_ROOT,
    createProviders: () => createLocalProviders(modelInfo),
    productionManifestPath: registration.productionManifestPath,
    log: (line) => process.stderr.write(`${line}\n`)
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    return undefined;
  });
  if (result === undefined) return 1;
  console.log(`captureId=${result.captureId} cases=${result.cases} latency=${result.latencyPath}`);
  return 0;
}

const COMMANDS: ReadonlyMap<string, CommandHandler> = new Map<string, CommandHandler>([
  ["validate", validateCommand],
  ["capture", captureCommand],
  ["latency", latencyCommand],
  ["replay", replayCommand],
  ["report", reportCommand],
  ["compare", compareCommand],
  ["worksheet", worksheetCommand],
  ["merge-judgments", mergeCommand]
]);

/** Runs one memory-eval command. Returns the process exit code. */
export async function runCli(argv: readonly string[]): Promise<number> {
  const [commandName = "", ...rest] = argv;
  const handler = COMMANDS.get(commandName);
  if (handler === undefined) {
    const names = [...COMMANDS.keys()].join("|");
    console.error(`Usage: memory:eval <${names}> [--corpus marc] [--resume]`);
    return 2;
  }
  return handler(parseOptions(rest));
}

function isEntrypoint(): boolean {
  const invokedPath = process.argv[1];
  if (invokedPath === undefined) return false;
  return path.resolve(invokedPath) === fileURLToPath(import.meta.url);
}

async function runAsEntrypoint(): Promise<void> {
  if (!isEntrypoint()) return;
  process.exitCode = await runCli(process.argv.slice(2));
}

runAsEntrypoint().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
