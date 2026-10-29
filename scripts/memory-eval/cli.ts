import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { COUNT_LIMIT_HOURS, type EvidenceMatch } from "./matrix-plan.js";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { WorkspaceInfo } from "../../src/core/types.js";
import { getWorkspaceInfo } from "../../src/core/workspace.js";
import { LocalEmbeddingProvider } from "../../src/core/memory/local-provider.js";
import { LocalQueryInterpretationProvider } from "../../src/core/memory/local-query-interpreter.js";
import { LocalRerankingProvider } from "../../src/core/memory/local-reranker.js";
import {
  captureMemoryEval,
  disposeProviders,
  type CaptureOptions,
  type CaptureProviders
} from "./capture.js";
import { queryFingerprintCases, sha256Json } from "./capture-fingerprint.js";
import { countCapture } from "./capture-count.js";
import {
  complementCapture,
  complementCountOf,
  targetsOfJudged,
  type ComplementTargets
} from "./capture-complement.js";
import { readVectors } from "./capture-vectors.js";
import { funnelParamsOf, funnelWorksheetGridOf } from "./replay-funnel.js";
import type { WorksheetRun } from "./judgments.js";
import {
  AUDIT_DEPTH_VARIANTS,
  AUDIT_SEED,
  auditCasesOf,
  complementGroupsOf,
  type ComplementGroupsFile,
  mergeReportOf,
  medianOf,
  readOrCreateAuditManifest,
  sampledByCaseOf
} from "./audit-sample.js";
import { exhaustiveReachesOf } from "./worksheet-reach.js";
import { isFunnelVariantName } from "./funnel-variants.js";
import type { CaptureFile } from "./capture-types.js";
import { recordsById, replayCapture } from "./replay.js";
import {
  assertCrossCorpus,
  assertInputsPresent,
  requirementsOf,
  usesFoldCalibrations,
  type ReplayInputs
} from "./replay-inputs.js";
import {
  FIT_FILE,
  FIT_PREDICTIONS_FILE,
  buildFit,
  fitSummaryLines,
  type FitPredictionsFile
} from "./fit.js";
import type { FitResult } from "./fit-model.js";
import type { CalibrationSet } from "./calibration.js";
import {
  calibrateCapture,
  calibrationFileName,
  type CalibrationFile,
  type CalibrationModel
} from "./calibrate.js";
import {
  suggestionFileName,
  suggestionFileOf,
  suggestionTableLines
} from "./h3.js";
import { FOLD_COUNT, caseFolds } from "./folds.js";
import {
  choiceCapture,
  choiceDecisionsOf,
  choiceFileName,
  assertChoiceFileReusable,
  assertJudgeFileReusable,
  identityRecordsOf,
  judgeCapture,
  judgeFileName,
  judgeTableOf,
  type ChoiceFile,
  type JudgeFile
} from "./judge.js";
import {
  measureChoiceLatency,
  measureJudgeLatency,
  modelLatencyFileName
} from "./latency-models.js";
import {
  JUDGE_CACHE_DIR,
  KEV_IDENTITY,
  LFM_IDENTITY,
  PRODUCTION_LFM_CACHE_DIR,
  QWEN_IDENTITY,
  type ModelIdentity,
  loadJudgeRunner,
  loadKevChoiceRunner,
  loadLfmChoiceRunner
} from "./judge-runner.js";
import { JUDGE_NAMES, type JudgeName } from "./judge-stage.js";
import type { TypedModel } from "./suggestion.js";
import type { ChoiceDecision } from "./choice-decision.js";
import { PRODUCTION_RECALL_ID, isRankingVariantId } from "./variants.js";
import {
  REPORT_VARIANTS,
  buildReport,
  readRaterPairs,
  renderMarkdown,
  reportFileNames
} from "./report.js";
import { compareCaptures } from "./compare.js";
import {
  compareCommonCases,
  renderCompareCommonMarkdown
} from "./compare-common.js";
import { measureAllLayers } from "./layers.js";
import { renderT2Markdown, runT2, type T2Report } from "./t2-run.js";
import type { KChoice } from "./t2-decision.js";
import type { AuditManifest } from "./audit-sample.js";
import {
  measureCaptureLatency,
  readLatencyFile,
  type LatencyFile
} from "./latency.js";
import {
  buildWorksheet,
  commitMerge,
  mergeJudgments,
  writeMergeReport,
  type MergeReport
} from "./judgments.js";
import { writeFileAtomically } from "../../src/core/write-coordination.js";
import {
  configuredDocumentsOf,
  corpusSourceTexts,
  type CorpusDocument
} from "./corpus.js";
import {
  buildValidationCorpus,
  validateDataset,
  type CorpusIndex,
  type EvalDataset,
  type PinnedCorpus,
  type ValidationIssue
} from "./dataset.js";
import { DEEP_BUDGET_DOMAIN_MESSAGE, isValidDeepBudget } from "./deep-protocol.js";
import { describeLatencyReport, writeLatencyReport } from "./deep-latency-report.js";
import { runDeepLatency } from "./deep-latency.js";
import { loadDeepInputs, passageRecordsOf, runDeepReport, writeDeepReport } from "./deep-run.js";
import { writeDeepWorksheet } from "./deep-worksheet.js";

const MEMORY_EVAL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(MEMORY_EVAL_DIR, "..", "..");

type CorpusRegistration = {
  datasetPath: string;
  pinnedPath: string;
  threadsPath: string;
  rulesPath: string;
  productionManifestPath?: string;
  /** Workspace settings whose `memory.documentSources` list the configured documents of the corpus. */
  settingsPath?: string;
  /** K_max of the closed scope of the corpus. Absent means the E3 default. */
  kMax?: number;
};

export const CORPORA: ReadonlyMap<string, CorpusRegistration> = new Map<
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
      settingsPath: path.join(REPOSITORY_ROOT, ".marc", "marc.config.json"),
      productionManifestPath: path.join(
        REPOSITORY_ROOT,
        ".marc",
        "memory",
        "manifest.json"
      )
    }
  ],
  [
    "marc-deep",
    {
      datasetPath: path.join(MEMORY_EVAL_DIR, "datasets", "marc-deep.json"),
      pinnedPath: path.join(MEMORY_EVAL_DIR, "datasets", "marc-deep.corpus.json"),
      threadsPath: path.join(REPOSITORY_ROOT, ".marc", "threads"),
      rulesPath: path.join(REPOSITORY_ROOT, ".marc", "RULES.md"),
      settingsPath: path.join(REPOSITORY_ROOT, ".marc", "marc.config.json"),
      productionManifestPath: path.join(REPOSITORY_ROOT, ".marc", "memory", "manifest.json"),
      kMax: 0
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

/** The configured documents of a corpus: the `memory.documentSources` of its settings, or none. */
async function documentsOf(registration: CorpusRegistration): Promise<CorpusDocument[]> {
  if (registration.settingsPath === undefined) return [];
  return configuredDocumentsOf({ repositoryRoot: REPOSITORY_ROOT });
}

/** The validation corpus, the pinned files that evidence quotes are checked against, and the issues of pinning. */
export async function validationCorpus(
  registration: CorpusRegistration
): Promise<ReturnType<typeof buildValidationCorpus> & { sources: Map<string, string> }> {
  const pinned = await readPinnedCorpus(registration.pinnedPath);
  const closed = await readClosedThreads(registration.threadsPath);
  const sources = await corpusSourceTexts({
    threadsRoot: registration.threadsPath,
    threadIds: pinned.threadIds,
    rulesPath: registration.rulesPath,
    documents: await documentsOf(registration)
  });
  return { ...buildValidationCorpus(pinned, closed), sources };
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

/**
 * Complements the groups of a groups file (the cosine rows of a worksheet). With --count-only it writes
 * nothing and reports the pairs and the hours; without it, it scores them with the reranker.
 */
async function complementGroupsCommand(input: {
  corpusName: string;
  captureId: string | undefined;
  groupsPath: string;
  countOnly: boolean;
  modelInfo: WorkspaceInfo;
}): Promise<number> {
  if (input.captureId === undefined) {
    console.error("Usage: memory:eval capture --complement-groups <file> --capture <captureId> [--count-only true]");
    return 2;
  }
  const captureDir = path.join(REPOSITORY_ROOT, ".marc", "cache", "memory-eval", input.corpusName, input.captureId);
  const targets = targetsOfGroupsFile(JSON.parse(await fs.readFile(input.groupsPath, "utf8")) as ComplementGroupsFile);
  if (input.countOnly) {
    const count = await complementCountOf({ captureDir, targets });
    console.log(
      `captureId=${input.captureId} round=${count.round} cases=${count.perCase.length} addedRecords=${count.addedRecords} scoredPairs=${count.scoredPairs} hours=${count.hours.toFixed(2)} limitHours=${COUNT_LIMIT_HOURS} refused=${count.refused} written=none`
    );
    return count.refused ? 1 : 0;
  }
  const providers = createLocalProviders(input.modelInfo);
  const summary = await complementCapture({ captureDir, targets, reranker: providers.reranker });
  console.log(`captureId=${input.captureId} round=${summary.round} addedPairs=${summary.addedPairs} cases=${summary.perCase.length}`);
  return 0;
}

/** The targets of a groups file: the groups of each case, by case id. */
function targetsOfGroupsFile(file: ComplementGroupsFile): ComplementTargets {
  return new Map(Object.entries(file.cases).map(([caseId, groups]) => [caseId, new Set(groups)] as const));
}

/**
 * The T2 of the E3 on a frozen capture: K and the fallback cuts chosen on the training folds, the decision
 * rows on the common reference, the evidence survival by passageId, and the audit pool. Writes the JSON and
 * the Markdown report beside the capture. Refuses without the capture vectors.
 */
async function t2Command(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  const captureId = options.get("capture");
  if (captureId === undefined) {
    console.error("Usage: memory:eval t2 --capture <captureId> [--corpus marc] [--funnel-mode cosine|cosine-fts] [--k-from <cosine t2-report.json>]");
    return 2;
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const capture = await readCaptureFileOf(corpusName, captureId);
  const directory = captureDirectoryOf(corpusName, captureId);
  if (capture.vectors === undefined) {
    console.error("The T2 needs the capture vectors: capture an E3 capture first.");
    return 1;
  }
  const vectors = await readVectors(directory, capture.vectors);
  const evidence = await readEvidenceOf(directory);
  const audit = JSON.parse(await fs.readFile(path.join(directory, "audit-sample.json"), "utf8")) as AuditManifest;
  const mode = options.get("funnel-mode") ?? "cosine";
  if (mode !== "cosine" && mode !== "cosine-fts") {
    console.error("The --funnel-mode of the T2 is cosine or cosine-fts.");
    return 2;
  }
  const kFrom = options.get("k-from");
  const kOverride = kFrom === undefined ? undefined : await readKOverrideOf(kFrom);
  const report = await runT2({ corpus: corpusName, capture, dataset, vectors, evidence, audit, mode, kOverride, curve: mode === "cosine" });
  const suffix = mode === "cosine" ? "" : `-${mode}`;
  await writeFileAtomically(path.join(directory, `t2-report${suffix}.json`), `${JSON.stringify(report, null, 2)}\n`);
  await writeFileAtomically(path.join(directory, `t2-report${suffix}.md`), renderT2Markdown(report));
  console.log(
    `captureId=${captureId} mode=${mode} report=${path.join(directory, `t2-report${suffix}.md`)} survival=${report.survival.survived}/${report.survival.population} decisionRows=${report.decisions.length}`
  );
  return 0;
}

/** The K of each fold of a previous T2 report (the cosine run), so a second mode runs with the same K and its rule flag. */
async function readKOverrideOf(file: string): Promise<Map<number, KChoice>> {
  const report = JSON.parse(await fs.readFile(file, "utf8")) as T2Report;
  return new Map(Object.entries(report.kByFold).map(([fold, choice]) => [Number(fold), choice] as const));
}

/** The evidence matches of each case, read from the case files of the capture. */
async function readEvidenceOf(directory: string): Promise<Map<string, EvidenceMatch[]>> {
  const names = (await fs.readdir(path.join(directory, "cases"))).filter((name) => name.endsWith(".json"));
  const entries = await Promise.all(
    names.map(async (name) => {
      const file = JSON.parse(await fs.readFile(path.join(directory, "cases", name), "utf8")) as {
        id: string;
        evidence?: EvidenceMatch[];
      };
      return [file.id, file.evidence ?? []] as const;
    })
  );
  return new Map(entries);
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
  const { corpus, issues: pinnedIssues, sources } = await validationCorpus(registration);
  const { issues } = validateDataset(dataset, corpus, sources);
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
  const { corpus, issues: pinnedIssues, sources } = await validationCorpus(registration);
  const { issues } = validateDataset(dataset, corpus, sources);
  const allIssues = [...pinnedIssues, ...issues];
  if (allIssues.length > 0) {
    allIssues.forEach(printIssue);
    console.error("The dataset or the pinned corpus is invalid; the capture was not started.");
    return 1;
  }
  const pinned = await readPinnedCorpus(registration.pinnedPath);
  const modelInfo = await getWorkspaceInfo(REPOSITORY_ROOT);
  if (options.get("all-layers") === "true") {
    const layers = await measureAllLayers({
      dataset,
      source: {
        threadsRoot: registration.threadsPath,
        threadIds: pinned.threadIds,
        rulesPath: registration.rulesPath, documents: await documentsOf(registration)
      },
      outputRoot: path.join(REPOSITORY_ROOT, ".marc", "cache", "memory-eval"),
      repositoryRoot: REPOSITORY_ROOT,
      createProviders: () => createLocalProviders(modelInfo),
      log: (line) => process.stderr.write(`${line}\n`)
    });
    for (const run of layers.runs) {
      console.log(
        `captureId=${layers.captureId} layers=[${run.indexedLayers.join(",")}] records=${run.records} rebuildMs=${run.rebuildMs.toFixed(0)} byLayer=${JSON.stringify(run.byLayer)}`
      );
    }
    console.log(`file=${layers.layersPath}`);
    return 0;
  }
  const captureOptions: CaptureOptions = {
    dataset,
    source: {
      threadsRoot: registration.threadsPath,
      threadIds: pinned.threadIds,
      rulesPath: registration.rulesPath,
      documents: await documentsOf(registration)
    },
    outputRoot: path.join(REPOSITORY_ROOT, ".marc", "cache", "memory-eval"),
    repositoryRoot: REPOSITORY_ROOT,
    createProviders: () => createLocalProviders(modelInfo),
    productionManifestPath: registration.productionManifestPath,
    kMax: registration.kMax,
    resume: options.get("resume") === "true",
    log: (line) => process.stderr.write(`${line}\n`)
  };
  const groupsPath = options.get("complement-groups");
  if (groupsPath !== undefined) {
    return complementGroupsCommand({
      corpusName,
      captureId: options.get("capture"),
      groupsPath,
      countOnly: options.get("count-only") === "true",
      modelInfo
    });
  }
  if (options.get("count-only") === "true") return countCommand(captureOptions);
  const judgmentsPath = options.get("complement");
  if (judgmentsPath !== undefined) {
    return complementCommand({ corpusName, captureId: options.get("capture"), judgmentsPath, modelInfo });
  }
  const result = await captureMemoryEval(captureOptions);
  console.log(
    `captureId=${result.captureId} dir=${result.captureDir} cases=${result.cases} executed=${result.executedCases} skipped=${result.skippedCases} durationMs=${result.durationMs.toFixed(0)}`
  );
  return 0;
}

/** Counts the pairs of every case before any scoring; exits with 1 when the count is above the limit. */
async function countCommand(captureOptions: CaptureOptions): Promise<number> {
  const count = await countCapture(captureOptions);
  const pairs = count.perCase.map((item) => item.pairs).sort((left, right) => left - right);
  const median = pairs[Math.floor(pairs.length / 2)] ?? 0;
  console.log(
    `captureId=${count.captureId} cases=${count.perCase.length} pairsMedian=${median} pairsMin=${pairs[0] ?? 0} pairsMax=${pairs[pairs.length - 1] ?? 0} pairs=${count.totalPairs} hours=${count.hours.toFixed(2)} productionRecallPairs=${count.totalProductionRecallPairs} hoursWithProductionRecall=${count.hoursWithProductionRecall.toFixed(2)} indexBuildMs=${count.indexBuildMs.toFixed(0)} limitHours=${count.limitHours} refused=${count.refused}`
  );
  return count.refused ? 1 : 0;
}

/** Appends the pairs of the groups that reach degree two or more in the given judgments. */
async function complementCommand(input: {
  corpusName: string;
  captureId: string | undefined;
  judgmentsPath: string;
  modelInfo: WorkspaceInfo;
}): Promise<number> {
  if (input.captureId === undefined) {
    console.error("Usage: memory:eval capture --complement <judgments.json> --capture <captureId>");
    return 2;
  }
  const judged = JSON.parse(await fs.readFile(input.judgmentsPath, "utf8")) as EvalDataset;
  const providers = createLocalProviders(input.modelInfo);
  try {
    const summary = await complementCapture({
      captureDir: path.join(REPOSITORY_ROOT, ".marc", "cache", "memory-eval", input.corpusName, input.captureId),
      targets: targetsOfJudged(judged),
      reranker: providers.reranker
    });
    console.log(
      `captureId=${input.captureId} round=${summary.round} addedPairs=${summary.addedPairs} cases=${summary.perCase.length}`
    );
    return 0;
  } finally {
    await disposeProviders(providers);
  }
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
      "Usage: memory:eval replay --capture <captureId> [--corpus marc] [--variants M0,D0,ORACLE_ADMISSION] [--funnel-budget B --funnel-k K --funnel-mode cosine|cosine-fts] [--band-cuts cuts.json]"
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
  const inputs = await replayInputsOf({
    corpusName,
    captureDir,
    capture,
    variantIds,
    modelArgument: options.get("model")
  });
  const vectors = capture.vectors === undefined ? undefined : await readVectors(captureDir, capture.vectors);
  const funnelParams = await funnelParamsOf({
    budget: options.get("funnel-budget"),
    k: options.get("funnel-k"),
    mode: options.get("funnel-mode"),
    bandCutsPath: options.get("band-cuts")
  });
  const result = await replayCapture({ capture, dataset, variantIds, ...inputs, vectors, funnelParams });
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
    console.error("Usage: memory:eval report --capture <captureId> [--corpus marc] [--model marc/<captureId>] [--raters a.json,b.json]");
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
  const withoutLatency = options.get("without-latency") === "true";
  let latency: LatencyFile | undefined;
  if (!withoutLatency) {
    latency = await readLatencyFile(captureDirectoryOf(corpusName, captureId), captureId).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      return undefined;
    });
    if (latency === undefined) return 1;
  }
  const reportVariants = [...REPORT_VARIANTS, PRODUCTION_RECALL_ID];
  const reportInputs = await replayInputsOf({
    corpusName,
    captureDir: captureDirectoryOf(corpusName, captureId),
    capture,
    variantIds: reportVariants,
    modelArgument: options.get("model")
  });
  // The report loads the capture vectors and the funnel parameters, as the replay and the worksheet do.
  const reportVectors = capture.vectors === undefined ? undefined : await readVectors(captureDirectoryOf(corpusName, captureId), capture.vectors);
  const reportFunnel = await funnelParamsOf({
    budget: options.get("funnel-budget"),
    k: options.get("funnel-k"),
    mode: options.get("funnel-mode"),
    bandCutsPath: options.get("band-cuts")
  });
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: reportVariants,
    ...reportInputs,
    vectors: reportVectors,
    funnelParams: reportFunnel
  });
  const ratersArgument = options.get("raters");
  const raters = ratersArgument === undefined
    ? undefined
    : await readRaterPairs(...splitPair(ratersArgument));
  const report = await buildReport({ capture, dataset, replay, latency, raters });
  const directory = captureDirectoryOf(corpusName, captureId);
  const names = reportFileNames(withoutLatency);
  await writeFileAtomically(path.join(directory, names.json), JSON.stringify(report, null, 2));
  await writeFileAtomically(path.join(directory, names.markdown), renderMarkdown(report));
  console.log(
    `captureId=${captureId} equivalence=${report.equivalence.status} M0=${report.variants.M0?.status ?? "n/a"} report=${path.join(directory, names.markdown)}`
  );
  return 0;
}

function splitPair(argument: string): [string, string] {
  const [first, second] = argument.split(",").map((item) => item.trim());
  if (first === undefined || second === undefined) throw new Error("Expected two comma-separated files.");
  return [first, second];
}

/**
 * Compares a candidate variant against a baseline variant on the common cases only (the cases that both captures hold
 * with the same query). It writes the JSON and the Markdown next to the candidate capture.
 */
async function compareCommonCommand(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  const baseline = parseSide(options.get("baseline"));
  const candidate = parseSide(options.get("candidate"));
  if (baseline === undefined || candidate === undefined) {
    console.error("Usage: memory:eval compare-common --baseline <captureId>:<variant> --candidate <captureId>:<variant> [--corpus marc]");
    return 2;
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const baselineCapture = await readCaptureFileOf(corpusName, baseline.captureId);
  const candidateCapture = await readCaptureFileOf(corpusName, candidate.captureId);
  const baselineDirectory = captureDirectoryOf(corpusName, baseline.captureId);
  const candidateDirectory = captureDirectoryOf(corpusName, candidate.captureId);
  const baselineInputs = await replayInputsOf({
    corpusName,
    captureDir: baselineDirectory,
    capture: baselineCapture,
    variantIds: [baseline.variant]
  });
  const candidateInputs = await replayInputsOf({
    corpusName,
    captureDir: candidateDirectory,
    capture: candidateCapture,
    variantIds: [candidate.variant]
  });
  // The funnel reads the vectors of an E3 capture (DEPTH0 included); the E2 captures hold none.
  const baselineVectors = baselineCapture.vectors === undefined ? undefined : await readVectors(baselineDirectory, baselineCapture.vectors);
  const candidateVectors = candidateCapture.vectors === undefined ? undefined : await readVectors(candidateDirectory, candidateCapture.vectors);
  const result = await compareCommonCases({
    dataset,
    baseline: { capture: baselineCapture, variant: baseline.variant, inputs: { ...baselineInputs, vectors: baselineVectors } },
    candidate: { capture: candidateCapture, variant: candidate.variant, inputs: { ...candidateInputs, vectors: candidateVectors } }
  });
  const directory = candidateDirectory;
  const stem = `compare-common-${baseline.captureId}-${baseline.variant}`;
  await writeFileAtomically(path.join(directory, `${stem}.json`), `${JSON.stringify(result, null, 2)}\n`);
  await writeFileAtomically(path.join(directory, `${stem}.md`), renderCompareCommonMarkdown(result));
  console.log(
    `verdict=${result.verdict} common=${result.cases.common.length} baseline=${baseline.captureId}:${baseline.variant} candidate=${candidate.captureId}:${candidate.variant} report=${path.join(directory, `${stem}.md`)}`
  );
  for (const row of result.rows) {
    console.log(`${row.scope} ${row.metric} difference=${row.difference ?? "n/a"} lower=${row.lower ?? "n/a"} upper=${row.upper ?? "n/a"} term=${row.term ?? "n/a"}`);
  }
  return result.verdict === "compared" ? 0 : 1;
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
    console.error("Usage: memory:eval compare --baseline <captureId>:<variant> --candidate <captureId>:<variant> [--corpus marc] [--baseline-model marc/<captureId>] [--candidate-model marc/<captureId>]");
    return 2;
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const baselineCapture = await readCaptureFileOf(corpusName, baseline.captureId);
  const candidateCapture = await readCaptureFileOf(corpusName, candidate.captureId);
  const baselineInputs = await replayInputsOf({
    corpusName,
    captureDir: captureDirectoryOf(corpusName, baseline.captureId),
    capture: baselineCapture,
    variantIds: [baseline.variant],
    modelArgument: options.get("baseline-model")
  });
  const candidateInputs = await replayInputsOf({
    corpusName,
    captureDir: captureDirectoryOf(corpusName, candidate.captureId),
    capture: candidateCapture,
    variantIds: [candidate.variant],
    modelArgument: options.get("candidate-model")
  });
  const result = await compareCaptures({
    dataset,
    baseline: { capture: baselineCapture, variant: baseline.variant, inputs: baselineInputs },
    candidate: { capture: candidateCapture, variant: candidate.variant, inputs: candidateInputs }
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
  console.log(`incomplete cases: baseline=${result.baseline.incompleteCaseIds.length} candidate=${result.candidate.incompleteCaseIds.length}`);
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
  const mergeReportPath = options.get("merge-report");
  if (captureId === undefined || mergeReportPath === undefined) {
    console.error("Usage: memory:eval worksheet --capture <captureId> --merge-report <merge-*.json> [--corpus marc] [--variants v1,v2] [--model marc/<captureId>] [--funnel-budget B --funnel-k k1,k2 --funnel-mode cosine,cosine-fts]");
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
  const funnelNames = variants.filter((id) => isFunnelVariantName(id));
  const baseVariants = [
    ...new Set([...variants.filter((id) => !isFunnelVariantName(id)), ...AUDIT_DEPTH_VARIANTS])
  ];
  const grid = funnelNames.length === 0 ? [] : funnelWorksheetGridOf({
    budget: options.get("funnel-budget"),
    ks: options.get("funnel-k"),
    modes: options.get("funnel-mode")
  });
  if (grid === undefined) {
    console.error("The funnel variants need --funnel-budget, --funnel-k and --funnel-mode, each given, with lists for K and the mode.");
    return 2;
  }
  const worksheetVariants = [...new Set(["M0", "D0", ...variants])];
  const worksheetInputs = await replayInputsOf({
    corpusName,
    captureDir: captureDirectoryOf(corpusName, captureId),
    capture,
    variantIds: worksheetVariants,
    modelArgument: options.get("model")
  });
  const directory = captureDirectoryOf(corpusName, captureId);
  const vectors = capture.vectors === undefined ? undefined : await readVectors(directory, capture.vectors);
  const replay = await replayCapture({
    capture,
    dataset,
    variantIds: [...new Set(["M0", "D0", ...baseVariants])],
    ...worksheetInputs,
    vectors
  });
  const gridRuns: WorksheetRun[] = [];
  for (const params of grid) {
    const gridReplay = await replayCapture({
      capture,
      dataset,
      variantIds: funnelNames,
      ...worksheetInputs,
      vectors,
      funnelParams: params
    });
    gridRuns.push({ replay: gridReplay, variants: funnelNames });
  }
  const reaches = exhaustiveReachesOf({ capture, variants: funnelNames, grid, vectors });
  const runs: WorksheetRun[] = [{ replay, variants: baseVariants }, ...gridRuns];
  const mergeReport = mergeReportOf(JSON.parse(await fs.readFile(mergeReportPath, "utf8")));
  const auditCases = auditCasesOf({ capture, dataset, report: mergeReport, replay, runs, reaches });
  const manifest = await readOrCreateAuditManifest({
    file: path.join(directory, "audit-sample.json"),
    seed: AUDIT_SEED,
    corpus: corpusName,
    captureId,
    cases: auditCases
  });
  await writeFileAtomically(
    path.join(directory, "audit-verification.json"),
    `${JSON.stringify({ schema: 1, corpus: corpusName, captureId, mergeReport: mergeReportPath, verifiedCases: auditCases.length, divergences: 0, alreadyPresent: mergeReport.alreadyPresent, conflicts: mergeReport.conflicts.length }, null, 2)}\n`
  );
  const pinned = await readPinnedCorpus(registration.pinnedPath);
  const worksheet = await buildWorksheet({
    capture,
    dataset,
    replay,
    source: {
      threadsRoot: registration.threadsPath,
      threadIds: pinned.threadIds,
      rulesPath: registration.rulesPath, documents: await documentsOf(registration)
    },
    variants: baseVariants,
    grid: gridRuns,
    reaches,
    vectors,
    audited: sampledByCaseOf(manifest)
  });
  await writeFileAtomically(path.join(directory, "worksheet.md"), `${worksheet.markdown}\n`);
  await writeFileAtomically(
    path.join(directory, "worksheet-template.json"),
    `${JSON.stringify(worksheet.template, null, 2)}\n`
  );
  await writeFileAtomically(
    path.join(directory, "worksheet-meta.json"),
    `${JSON.stringify({ schema: 1, corpus: corpusName, captureId, rows: worksheet.meta }, null, 2)}\n`
  );
  const auditText = await fs.readFile(path.join(directory, "audit-sample.json"), "utf8");
  const groupsFile = complementGroupsOf({
    corpus: corpusName,
    captureId,
    caseIds: dataset.cases.map((item) => item.id),
    rows: worksheet.meta,
    manifest,
    auditSampleSha256: createHash("sha256").update(auditText).digest("hex")
  });
  await writeFileAtomically(path.join(directory, "complement-groups.json"), `${JSON.stringify(groupsFile, null, 2)}\n`);
  console.log(
    `captureId=${captureId} pendingPairs=${worksheet.pending} byLayer=0:${worksheet.pendingByLayer[0]},1:${worksheet.pendingByLayer[1]},2:${worksheet.pendingByLayer[2]} unscoredRows=${worksheet.unscored} auditPairs=${worksheet.audit.pairs} auditCells=${worksheet.audit.cells} medianExternals=${medianOf(manifest.cases.map((item) => item.externalCount))} saturationRemoved=${worksheet.saturationRemoved} worksheet=${path.join(directory, "worksheet.md")} template=${path.join(directory, "worksheet-template.json")}`
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
    sources: corpus.sources,
    raterA: await readJson(first),
    raterB: await readJson(second),
    consensus: consensusPath === undefined ? undefined : await readJson(consensusPath),
    passageIds: await passageIdsOfMerge(corpusName, options.get("capture"))
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
  const passages = report.passages;
  if (passages !== undefined) {
    console.log(
      `passages pairs=${passages.pairs} concordant=${passages.concordant} kappa=${passages.kappa ?? "n/a"} divergences=${passages.divergences.length} unresolved=${passages.unresolved.length} written=${passages.written.length} alreadyPresent=${passages.alreadyPresent} conflicts=${passages.conflicts.length}`
    );
  }
  for (const conflict of passages?.conflicts ?? []) {
    console.log(`conflict passage ${conflict.caseId}/${conflict.passageId}: existing=${conflict.existing} proposed=${conflict.proposed}`);
  }
  for (const issue of report.issues) printIssue(issue);
  console.log(`report=${reportPath}`);
}

/** Measures latency of a complete capture into latency.json. Run it on a quiet machine. */
/**
 * latency --capture <id> --judge qwen|kev --model marc/<id>, or latency --capture <id>
 * --choice kev|lfm: the model latency of a complete capture, with the memory of the
 * harness process and of the M0 inference workers (E2, A4). The judge times the threads
 * that the production H1 pre-admits, under the parameters of the given fit.
 */
async function modelLatencyCommand(
  options: CommandOptions,
  corpusName: string,
  registration: CorpusRegistration
): Promise<number> {
  const judge = options.get("judge");
  const choice = options.get("choice");
  const captureId = options.get("capture");
  const usage =
    "Usage: memory:eval latency --capture <captureId> (--judge qwen|kev --model marc/<captureId> | --choice kev|lfm) [--corpus marc]";
  if (captureId === undefined || (judge === undefined) === (choice === undefined)) {
    console.error(usage);
    return 2;
  }
  if (judge !== undefined && !JUDGE_NAMES.some((name) => name === judge)) {
    console.error(usage);
    return 2;
  }
  if (choice !== undefined && choice !== "kev" && choice !== "lfm") {
    console.error(usage);
    return 2;
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const capture = await readCaptureFileOf(corpusName, captureId);
  if (sha256Json(queryFingerprintCases(dataset.cases)) !== capture.fingerprint.queryFingerprint) {
    console.error("The dataset queries differ from the capture. Capture again before measuring.");
    return 1;
  }
  const directory = captureDirectoryOf(corpusName, captureId);
  const latency = await readLatencyFile(directory, captureId).catch((error: unknown) => {
    console.error(`${error instanceof Error ? error.message : String(error)} The M0 part of the estimate is null.`);
    return undefined;
  });
  const production = judge === undefined ? undefined : await readModelOf(options.get("model"));
  if (judge !== undefined && production === undefined) {
    console.error("The judge latency needs --model marc/<captureId>: its H1 parameters choose the judged threads.");
    return 2;
  }
  const workerInfo = await getWorkspaceInfo(REPOSITORY_ROOT);
  const providers = createLocalProviders(workerInfo);
  try {
    // The M0 models are loaded in the workers before the base reading, as in the M0 latency.
    await providers.embedding.prepare();
    await providers.reranker.prepare();
    const log = (line: string) => console.log(line);
    const result =
      judge !== undefined && production !== undefined
        ? await measureJudgeLatency({
            capture,
            records: recordsById(capture.records),
            identities: identityRecordsOf(capture),
            judge: judge as JudgeName,
            production: production.fit.production,
            productionFit: options.get("model") ?? "",
            latency,
            workerInfo,
            loadRunner: () =>
              loadJudgeRunner(judge as JudgeName, path.join(REPOSITORY_ROOT, JUDGE_CACHE_DIR)),
            log
          })
        : await measureChoiceLatency({
            capture,
            latency,
            workerInfo,
            loadRunner: () =>
              choice === "kev"
                ? loadKevChoiceRunner(path.join(REPOSITORY_ROOT, JUDGE_CACHE_DIR))
                : loadLfmChoiceRunner(path.join(REPOSITORY_ROOT, PRODUCTION_LFM_CACHE_DIR)),
            log
          });
    const outputPath = path.join(directory, modelLatencyFileName(result.kind, judge ?? choice ?? ""));
    await writeFileAtomically(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    const mb = (bytes: number) => Math.round(bytes / 1048576);
    const units = result.cases.reduce((total, item) => total + item.units, 0);
    console.log(
      `kind=${result.kind} model=${result.model.id} captureId=${captureId} cases=${result.cases.length} units=${units} ` +
        `harnessBaseMB=${mb(result.memory.harnessBaseBytes)} harnessPeakMB=${mb(result.memory.harnessPeakBytes)} ` +
        `deltaMB=${mb(result.memory.harnessDeltaBytes)} freeStartMB=${mb(result.memory.freeMemStartBytes)} ` +
        `freeEndMB=${mb(result.memory.freeMemEndBytes)} estimatedTotalMedianMs=${result.estimated.totalMedianMs?.toFixed(0) ?? "null"} ` +
        `(${result.estimated.label}) output=${outputPath}`
    );
    return 0;
  } finally {
    await disposeProviders(providers);
  }
}

async function latencyCommand(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  if (options.get("judge") !== undefined || options.get("choice") !== undefined) {
    return modelLatencyCommand(options, corpusName, registration);
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const { corpus, issues: pinnedIssues, sources } = await validationCorpus(registration);
  const { issues } = validateDataset(dataset, corpus, sources);
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
      rulesPath: registration.rulesPath, documents: await documentsOf(registration)
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

/**
 * The fit of a capture, when it has been written. The H1 variants need it; the
 * other variants never read it, so a missing file is not an error here.
 */
async function readFitOf(
  captureDir: string,
  captureId: string
): Promise<FitResult | undefined> {
  const content = await readOptionalText(path.join(captureDir, FIT_FILE));
  if (content === undefined) return undefined;
  const fit = JSON.parse(content) as FitResult;
  if (fit.captureId !== captureId) {
    throw new Error(`The fit in ${captureDir} belongs to another capture.`);
  }
  return fit;
}

/** Fits the calibrated score of one capture (H1). Writes fit.json; never touches .marc/memory. */
async function fitCommand(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  if (corpusName !== "marc") {
    console.error("The fit uses only the marc corpus; ledgerline-en stays an external check.");
    return 2;
  }
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  const captureId = options.get("capture");
  if (captureId === undefined) {
    console.error("Usage: memory:eval fit --capture <captureId> [--corpus marc]");
    return 2;
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const capture = await readCaptureFileOf(corpusName, captureId);
  if (sha256Json(queryFingerprintCases(dataset.cases)) !== capture.fingerprint.queryFingerprint) {
    console.error("The dataset queries differ from the capture. Capture again before fitting.");
    return 1;
  }
  const bundle = await buildFit({
    capture,
    dataset,
    judges: await judgeTablesOf(captureDirectoryOf(corpusName, captureId), capture)
  });
  const directory = captureDirectoryOf(corpusName, captureId);
  const fitPath = path.join(directory, FIT_FILE);
  const predictionsPath = path.join(directory, FIT_PREDICTIONS_FILE);
  await writeFileAtomically(fitPath, `${JSON.stringify(bundle.fit, null, 2)}\n`);
  await writeFileAtomically(
    predictionsPath,
    `${JSON.stringify(bundle.predictions, null, 2)}\n`
  );
  for (const line of fitSummaryLines(bundle.fit)) console.log(line);
  console.log(
    `captureId=${captureId} output=${fitPath} predictions=${predictionsPath} pairs=${bundle.predictions.pairs.length}`
  );
  return 0;
}

/**
 * The calibrations of a corpus in this capture, when `calibrate` has written them: the
 * production set (n1, n2) and, from the files that carry them, the set of each fold.
 */
async function readCalibrationsOf(
  captureDir: string,
  corpusName: string
): Promise<{ calibrations: CalibrationSet; folds: CalibrationSet[] | undefined } | undefined> {
  const content = await readOptionalText(path.join(captureDir, calibrationFileName(corpusName)));
  if (content === undefined) return undefined;
  const file = JSON.parse(content) as CalibrationFile;
  return { calibrations: { N1: file.n1, N2: file.n2 }, folds: file.folds };
}

/** The fit and its external predictions of a model named as `marc/<captureId>`. */
async function readModelOf(argument: string | undefined): Promise<CalibrationModel | undefined> {
  if (argument === undefined) return undefined;
  const [corpus, captureId] = argument.split("/");
  if (corpus === undefined || captureId === undefined) return undefined;
  const directory = captureDirectoryOf(corpus, captureId);
  const fit = JSON.parse(await fs.readFile(path.join(directory, FIT_FILE), "utf8")) as FitResult;
  const predictions = JSON.parse(
    await fs.readFile(path.join(directory, FIT_PREDICTIONS_FILE), "utf8")
  ) as FitPredictionsFile;
  return { fit, predictions };
}

/**
 * Shared argument checks of `calibrate` and `h3`: the corpus, the capture, the
 * model and the dataset, with the query fingerprint of the capture. On marc the
 * model must be the capture itself, because H2 reads its external predictions.
 */
async function calibrationInputsOf(options: CommandOptions, usage: string) {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return undefined;
  }
  const captureId = options.get("capture");
  const model = await readModelOf(options.get("model"));
  if (captureId === undefined || model === undefined) {
    console.error(usage);
    return undefined;
  }
  if (corpusName === "marc" && model.fit.captureId !== captureId) {
    console.error("On marc the model must be the capture itself: H2 and H3 read its external predictions.");
    return undefined;
  }
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return undefined;
  const capture = await readCaptureFileOf(corpusName, captureId);
  if (sha256Json(queryFingerprintCases(dataset.cases)) !== capture.fingerprint.queryFingerprint) {
    console.error("The dataset queries differ from the capture. Capture again first.");
    return undefined;
  }
  return { corpusName, captureId, model, dataset, capture };
}

function percentText(value: number | null): string {
  if (value === null) return "n/a";
  return value.toFixed(3);
}

/** Calibrates p' (N1 and N2) for one capture and evaluates H2 (marc) or H6 (other corpora). */
async function calibrateCommand(options: CommandOptions): Promise<number> {
  const inputs = await calibrationInputsOf(
    options,
    "Usage: memory:eval calibrate --capture <captureId> --model marc/<captureId> [--corpus marc]"
  );
  if (inputs === undefined) return 2;
  const { file } = await calibrateCapture({
    capture: inputs.capture,
    dataset: inputs.dataset,
    corpus: inputs.corpusName,
    model: inputs.model
  });
  const outputPath = path.join(
    captureDirectoryOf(inputs.corpusName, inputs.captureId),
    calibrationFileName(inputs.corpusName)
  );
  await writeFileAtomically(outputPath, `${JSON.stringify(file, null, 2)}\n`);
  console.log(
    `captureId=${file.captureId} synthetic=${file.synthetic.used} used/${file.synthetic.queries} dropped=${file.synthetic.dropped}`
  );
  console.log(
    `N1 valid=${file.n1.valid} a=${file.n1.a ?? "n/a"} b=${file.n1.b ?? "n/a"} rows=${file.n1.rows} positives=${file.n1.positives} atFloor=${file.n1.atFloor}`
  );
  console.log(
    `N2 valid=${file.n2.valid} a=${file.n2.a ?? "n/a"} b=${file.n2.b ?? "n/a"} reason=${file.n2.reason ?? "none"}`
  );
  console.log(`${file.evaluation.kind} pairs=${file.evaluation.pairs} positives=${file.evaluation.positives}`);
  for (const band of ["high", "medium", "low"] as const) {
    const base = file.evaluation.base.bands[band];
    const n1 = file.evaluation.variants.N1.bands[band];
    const n2 = file.evaluation.variants.N2.bands[band];
    console.log(
      `${band} precision p=${percentText(base.precision)} N1=${percentText(n1.precision)} N2=${percentText(n2.precision)}`
    );
  }
  console.log(
    `verdict N1=${file.evaluation.variants.N1.verdict} N2=${file.evaluation.variants.N2.verdict}`
  );
  console.log(`output=${outputPath}`);
  return 0;
}

/** H3: the alternatives A, B and C over the cases with an expected interpretation. */
async function h3Command(options: CommandOptions): Promise<number> {
  const inputs = await calibrationInputsOf(
    options,
    "Usage: memory:eval h3 --capture <captureId> --model marc/<captureId> [--corpus marc]"
  );
  if (inputs === undefined) return 2;
  const folds = caseFolds(inputs.dataset.cases);
  const cheapOf = (caseId: string) => {
    if (inputs.corpusName !== "marc") return inputs.model.fit.production.cheap;
    const fold = folds.get(caseId);
    if (fold === undefined) throw new Error(`No fold for case ${caseId}.`);
    return inputs.model.fit.folds[fold].cheap;
  };
  const directory = captureDirectoryOf(inputs.corpusName, inputs.captureId);
  const file = await suggestionFileOf({
    capture: inputs.capture,
    dataset: inputs.dataset,
    corpus: inputs.corpusName,
    modelCaptureId: inputs.model.fit.captureId,
    cheapOf,
    typedDecisions: await typedDecisionsOf(directory, inputs.capture)
  });
  const outputPath = path.join(
    captureDirectoryOf(inputs.corpusName, inputs.captureId),
    suggestionFileName(inputs.corpusName)
  );
  await writeFileAtomically(outputPath, `${JSON.stringify(file, null, 2)}\n`);
  for (const line of suggestionTableLines(file)) console.log(line);
  console.log(`captureId=${inputs.captureId} output=${outputPath}`);
  return 0;
}

/** The identity each judge file must carry: the pinned model of its judge. */
const JUDGE_IDENTITY: Readonly<Record<JudgeName, ModelIdentity>> = {
  qwen: QWEN_IDENTITY,
  kev: KEV_IDENTITY
};

/**
 * The inputs that the variants read, from the capture directory. Every judge and choice
 * file is checked against its capture and its model, and a missing input stops the
 * command before any replay runs, naming the file to produce.
 */
export async function replayInputsOf(input: {
  corpusName: string;
  captureDir: string;
  capture: CaptureFile;
  variantIds: readonly string[];
  modelArgument?: string;
}): Promise<ReplayInputs> {
  const fit = await fitForReplay(
    input.modelArgument,
    input.captureDir,
    input.capture.captureId,
    input.corpusName
  );
  const stored = await readCalibrationsOf(input.captureDir, input.corpusName);
  const perFold = usesFoldCalibrations(input.corpusName, input.modelArgument);
  if (perFold && stored !== undefined && stored.folds === undefined) {
    throw new Error(
      `${calibrationFileName(input.corpusName)} has no per-fold calibrations. Run memory:eval calibrate again.`
    );
  }
  const judgeTables = await judgeTablesOf(input.captureDir, input.capture);
  const inputs: ReplayInputs = {
    fit,
    calibrations: stored?.calibrations,
    foldCalibrations: perFold ? stored?.folds : undefined,
    judgeTables
  };
  assertInputsPresent(requirementsOf(input.variantIds), inputs, {
    fit: path.join(input.captureDir, FIT_FILE),
    calibrations: path.join(input.captureDir, calibrationFileName(input.corpusName)),
    judge: (name) => path.join(input.captureDir, judgeFileName(name))
  });
  return inputs;
}

/** The judge tables of a capture: one per judge whose file exists, each checked against its capture and model. */
async function judgeTablesOf(
  captureDir: string,
  capture: CaptureFile
): Promise<Partial<Record<JudgeName, ReturnType<typeof judgeTableOf>>>> {
  const entries = await Promise.all(
    JUDGE_NAMES.map(async (name) => {
      const file = await readJsonOptional<JudgeFile>(path.join(captureDir, judgeFileName(name)));
      if (file !== undefined) assertJudgeFileReusable(file, { capture, judge: name, identity: JUDGE_IDENTITY[name] });
      return [name, file === undefined ? undefined : judgeTableOf(file)] as const;
    })
  );
  return Object.fromEntries(entries.filter(([, table]) => table !== undefined)) as Partial<
    Record<JudgeName, ReturnType<typeof judgeTableOf>>
  >;
}

async function readJsonOptional<T>(filePath: string): Promise<T | undefined> {
  const content = await readOptionalText(filePath);
  if (content === undefined) return undefined;
  return JSON.parse(content) as T;
}

/**
 * The fit that replay reads. With --model marc/<captureId> the fit comes from that
 * capture, and its production parameters apply to every case, with no refit: the
 * cross-corpus reading of H6 and H7.
 */
async function fitForReplay(
  modelArgument: string | undefined,
  captureDir: string,
  captureId: string,
  corpusName: string
): Promise<FitResult | undefined> {
  if (modelArgument === undefined) return readFitOf(captureDir, captureId);
  const model = await readModelOf(modelArgument);
  if (model === undefined) throw new Error(`Invalid --model ${modelArgument}; expected marc/<captureId>.`);
  assertCrossCorpus(corpusName, model.fit.corpus);
  const production = model.fit.production;
  const folds = Array.from({ length: FOLD_COUNT }, (_, fold) => ({ ...production, fold }));
  return { ...model.fit, folds };
}

/** The typed-choice decisions of a capture, by model, for the D alternatives of H3. */
async function typedDecisionsOf(
  captureDir: string,
  capture: CaptureFile
): Promise<Partial<Record<TypedModel, Map<string, ChoiceDecision>>>> {
  const kev = await readJsonOptional<ChoiceFile>(path.join(captureDir, choiceFileName("kev")));
  const lfm = await readJsonOptional<ChoiceFile>(path.join(captureDir, choiceFileName("lfm")));
  if (kev !== undefined) assertChoiceFileReusable(kev, { capture, model: "kev", identity: KEV_IDENTITY });
  if (lfm !== undefined) assertChoiceFileReusable(lfm, { capture, model: "lfm", identity: LFM_IDENTITY });
  return {
    ...(kev === undefined ? {} : { kev: choiceDecisionsOf(kev) }),
    ...(lfm === undefined ? {} : { lfm: choiceDecisionsOf(lfm) })
  };
}

/** The judge pass (H7): one judge over the capture, with its own checkpoint file. */
async function judgeCommand(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  const judge = options.get("model");
  const captureId = options.get("capture");
  if (captureId === undefined || !JUDGE_NAMES.some((name) => name === judge)) {
    console.error("Usage: memory:eval judge --capture <captureId> --model qwen|kev [--corpus marc] [--resume]");
    return 2;
  }
  const judgeName = judge as JudgeName;
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const capture = await readCaptureFileOf(corpusName, captureId);
  if (sha256Json(queryFingerprintCases(dataset.cases)) !== capture.fingerprint.queryFingerprint) {
    console.error("The dataset queries differ from the capture. Capture again before judging.");
    return 1;
  }
  const directory = captureDirectoryOf(corpusName, captureId);
  const outputPath = path.join(directory, judgeFileName(judgeName));
  const previous = await readJsonOptional<JudgeFile>(outputPath);
  if (previous !== undefined && options.get("resume") !== "true") {
    console.error(`${outputPath} exists. Use --resume to continue it.`);
    return 1;
  }
  const started = Date.now();
  const runner = await loadJudgeRunner(judgeName, path.join(REPOSITORY_ROOT, JUDGE_CACHE_DIR));
  const file = await judgeCapture({
    capture,
    dataset,
    judge: judgeName,
    runner,
    previous,
    save: (next) => writeFileAtomically(outputPath, `${JSON.stringify(next, null, 2)}\n`),
    log: (line) => console.log(line)
  });
  const threads = Object.values(file.cases).reduce((sum, entry) => sum + entry.threads.length, 0);
  console.log(
    `judge=${judgeName} captureId=${captureId} cases=${Object.keys(file.cases).length} threads=${threads} durationMs=${Date.now() - started} peakRssKb=${process.resourceUsage().maxRSS} output=${outputPath}`
  );
  return 0;
}

/** The typed choice pass (H8): KEV or LFM. Laya left the study and is refused here. */
async function choiceCommand(options: CommandOptions): Promise<number> {
  const corpusName = options.get("corpus") ?? "marc";
  const registration = CORPORA.get(corpusName);
  if (registration === undefined) {
    console.error(`Unknown corpus: ${corpusName}`);
    return 2;
  }
  const model = options.get("model");
  const captureId = options.get("capture");
  if (model === "laya") {
    console.error(
      "Laya left the study: input assembly (option tokenization, 48-token option cap, head budget, split_words) is defined only by open-jev's build_sequence; not verifiable from the card and config.json without the forbidden dependency."
    );
    return 2;
  }
  if (captureId === undefined || (model !== "kev" && model !== "lfm")) {
    console.error("Usage: memory:eval choice --capture <captureId> --model kev|lfm [--corpus marc] [--resume]");
    return 2;
  }
  const typed = model as TypedModel;
  const dataset = await readDataset(corpusName, registration);
  if (dataset === undefined) return 2;
  const capture = await readCaptureFileOf(corpusName, captureId);
  if (sha256Json(queryFingerprintCases(dataset.cases)) !== capture.fingerprint.queryFingerprint) {
    console.error("The dataset queries differ from the capture. Capture again before the choice.");
    return 1;
  }
  const directory = captureDirectoryOf(corpusName, captureId);
  const outputPath = path.join(directory, choiceFileName(typed));
  const previous = await readJsonOptional<ChoiceFile>(outputPath);
  if (previous !== undefined && options.get("resume") !== "true") {
    console.error(`${outputPath} exists. Use --resume to continue it.`);
    return 1;
  }
  const started = Date.now();
  const runner =
    typed === "kev"
      ? await loadKevChoiceRunner(path.join(REPOSITORY_ROOT, JUDGE_CACHE_DIR))
      : await loadLfmChoiceRunner(path.join(REPOSITORY_ROOT, PRODUCTION_LFM_CACHE_DIR));
  const file = await choiceCapture({
    capture,
    model: typed,
    runner,
    previous,
    save: (next) => writeFileAtomically(outputPath, `${JSON.stringify(next, null, 2)}\n`),
    log: (line) => console.log(line)
  });
  const decisions = choiceDecisionsOf(file);
  const counts = { apply: 0, suggest: 0, none: 0 };
  for (const decision of decisions.values()) counts[decision] += 1;
  console.log(
    `choice=${typed} captureId=${captureId} cases=${decisions.size} apply=${counts.apply} suggest=${counts.suggest} none=${counts.none} durationMs=${Date.now() - started} peakRssKb=${process.resourceUsage().maxRSS} output=${outputPath}`
  );
  return 0;
}

const COMMANDS: ReadonlyMap<string, CommandHandler> = new Map<string, CommandHandler>([
  ["validate", validateCommand],
  ["capture", captureCommand],
  ["t2", t2Command],
  ["latency", latencyCommand],
  ["fit", fitCommand],
  ["calibrate", calibrateCommand],
  ["judge", judgeCommand],
  ["choice", choiceCommand],
  ["h3", h3Command],
  ["replay", replayCommand],
  ["report", reportCommand],
  ["compare", compareCommand],
  ["compare-common", compareCommonCommand],
  ["worksheet", worksheetCommand],
  ["merge-judgments", mergeCommand],
  ["deep-run", deepRunCommand],
  ["deep-worksheet", deepWorksheetCommand],
  ["deep-latency", deepLatencyCommand]
]);

/** The captured passage ids that a merge may grade. Undefined without `--capture`, so the layer merge stays as it was. */
async function passageIdsOfMerge(corpusName: string, captureId: string | undefined): Promise<ReadonlySet<string> | undefined> {
  if (captureId === undefined) return undefined;
  return new Set(passageRecordsOf(await readCaptureFileOf(corpusName, captureId)).keys());
}

/**
 * The inputs of a deep command. The corpus is `marc-deep`, the capture is named by `--capture`, and
 * `--deep-budget` gives the DEEP_BUDGET variant when present.
 */
function deepContextOf(
  options: CommandOptions,
  usage: string
): { datasetPath: string; captureDir: string; deepBudget?: number } | undefined {
  const corpusName = options.get("corpus") ?? "marc-deep";
  const registration = CORPORA.get(corpusName);
  const captureId = options.get("capture");
  if (corpusName !== "marc-deep" || registration === undefined || captureId === undefined) {
    console.error(usage);
    return undefined;
  }
  const budget = options.get("deep-budget");
  if (budget !== undefined && !isValidDeepBudget(Number(budget))) {
    console.error(`--deep-budget: ${DEEP_BUDGET_DOMAIN_MESSAGE}.`);
    return undefined;
  }
  return {
    datasetPath: registration.datasetPath,
    captureDir: captureDirectoryOf(corpusName, captureId),
    deepBudget: budget === undefined ? undefined : Number(budget)
  };
}

/** Runs the deep report of a marc-deep capture: every variant, the failure classes, the protocol and the gate. */
async function deepRunCommand(options: CommandOptions): Promise<number> {
  const context = deepContextOf(
    options,
    "Usage: memory:eval deep-run --corpus marc-deep --capture <captureId> [--deep-budget <n>]"
  );
  if (context === undefined) return 2;
  const report = await runDeepReport(await loadDeepInputs(context), context.deepBudget);
  const [jsonPath, markdownPath] = await writeDeepReport(context.captureDir, report);
  console.log(
    `captureId=${report.captureId} deepCases=${report.protocol.deepCases} protocolIncomplete=${report.protocol.protocolIncomplete} gate=${report.gate.passed ?? "not-applied"} report=${markdownPath} json=${jsonPath}`
  );
  return 0;
}

/** Writes the blind worksheet of the passages that still lack a grade, and its template. */
async function deepWorksheetCommand(options: CommandOptions): Promise<number> {
  const context = deepContextOf(
    options,
    "Usage: memory:eval deep-worksheet --corpus marc-deep --capture <captureId> [--deep-budget <n>]"
  );
  if (context === undefined) return 2;
  const pending = await writeDeepWorksheet({
    inputs: await loadDeepInputs(context),
    captureDir: context.captureDir,
    deepBudget: context.deepBudget
  });
  console.log(
    `captureId=${options.get("capture") ?? ""} pendingPassages=${pending} worksheet=${path.join(context.captureDir, "deep-worksheet.md")}`
  );
  return 0;
}

/**
 * The E4 latency of the deep paths over a marc-deep capture: M0 on its reference copy, the scoped path and the
 * unscoped path on the production index, with the gate and, when the scoped path fails, the recuo measurement.
 */
async function deepLatencyCommand(options: CommandOptions): Promise<number> {
  const captureId = options.get("capture");
  if (options.get("corpus") !== "marc-deep" || captureId === undefined) {
    console.error("Usage: memory:eval deep-latency --corpus marc-deep --capture <captureId>");
    return 2;
  }
  const report = await runDeepLatency(captureDirectoryOf("marc-deep", captureId));
  const target = await writeLatencyReport(report);
  for (const line of describeLatencyReport(report)) console.log(line);
  console.log(`report=${target}`);
  return 0;
}

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

// A failed command prints its message. The stack trace is printed only when
// MEMORY_EVAL_STACK=1 is set, for debugging the harness itself.
runAsEntrypoint().catch((error: unknown) => {
  const showStack = process.env.MEMORY_EVAL_STACK === "1";
  console.error(error instanceof Error && !showStack ? error.message : error);
  process.exitCode = 1;
});
