import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MEMORY_MODEL_BENCHMARK_PROFILES,
  MEMORY_MODEL_BENCHMARK_PROFILE_ENV,
  type MemoryModelBenchmarkProfileId
} from "../src/core/memory/model-config.js";
import {
  benchmarkQualityDeltas,
  parseMemoryModelBenchmarkReport,
  type MemoryQualityAggregate
} from "./memory-model-benchmark-runner.js";

type ProfileExecution = {
  durationMs: number;
  exitCode: number | null;
  report: Record<string, unknown>;
  stderrTail: string[];
};

type ProfileFailure = {
  error: string;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--detach")) {
    launchDetached(args);
    return;
  }
  const workspaceRoot = path.resolve(stringArgument(args, "--workspace") ?? process.cwd());
  const outputPath = path.resolve(
    stringArgument(args, "--output") ??
      path.join(
        workspaceRoot,
        ".marc",
        "cache",
        "memory-model-benchmark",
        "latest.json"
      )
  );
  const executions = args.includes("--resume")
    ? await readBenchmarkExecutions(outputPath)
    : {};

  for (const profile of benchmarkProfiles()) {
    const existing = executions[profile];
    if (existing && !isProfileFailure(existing)) continue;
    console.error(`Running memory model profile: ${profile}`);
    try {
      executions[profile] = await runProfile(profile, workspaceRoot);
    } catch (error) {
      executions[profile] = { error: errorMessage(error) };
    }
    await writeBenchmarkReport(outputPath, workspaceRoot, executions, false);
  }

  const aggregates = qualityAggregates(executions);
  const comparison = comparisonFor(aggregates);
  await writeBenchmarkReport(outputPath, workspaceRoot, executions, true);
  console.log(
    JSON.stringify(
      {
        comparison,
        outputPath,
        profiles: executionSummary(executions)
      },
      null,
      2
    )
  );
  if (Object.values(executions).some(isProfileFailure)) process.exitCode = 1;
}

function launchDetached(args: string[]): void {
  const scriptPath = fileURLToPath(import.meta.url);
  const childArgs = args.filter((argument) => argument !== "--detach");
  const child = spawn(
    process.execPath,
    ["--import", "tsx", scriptPath, ...childArgs],
    {
      cwd: process.cwd(),
      detached: true,
      env: process.env,
      stdio: "ignore"
    }
  );
  child.unref();
  console.log(JSON.stringify({ detached: true, processId: child.pid }));
}

async function writeBenchmarkReport(
  outputPath: string,
  workspaceRoot: string,
  executions: Partial<
    Record<MemoryModelBenchmarkProfileId, ProfileExecution | ProfileFailure>
  >,
  completed: boolean
): Promise<void> {
  const aggregates = qualityAggregates(executions);
  const report = {
    comparison: comparisonFor(aggregates),
    completed,
    completedAt: completed ? new Date().toISOString() : undefined,
    executions,
    invariant:
      "Corpus, chunks, queries, ranking, eligibility, and result limits remain fixed across profiles.",
    updatedAt: new Date().toISOString(),
    workspaceRoot
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function benchmarkProfiles(): MemoryModelBenchmarkProfileId[] {
  return Object.keys(
    MEMORY_MODEL_BENCHMARK_PROFILES
  ) as MemoryModelBenchmarkProfileId[];
}

async function runProfile(
  profile: MemoryModelBenchmarkProfileId,
  workspaceRoot: string
): Promise<ProfileExecution> {
  const qualityScript = fileURLToPath(
    new URL("./memory-quality-v4.ts", import.meta.url)
  );
  const startedAt = performance.now();
  const child = spawn(
    process.execPath,
    ["--import", "tsx", qualityScript, "--workspace", workspaceRoot],
    {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        [MEMORY_MODEL_BENCHMARK_PROFILE_ENV]: profile
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  const stderrTail = stderr.split(/\r?\n/u).filter(Boolean).slice(-20);
  let report: Record<string, unknown>;
  try {
    report = parseMemoryModelBenchmarkReport(stdout);
  } catch (error) {
    throw new Error(
      [
        errorMessage(error),
        `Profile process exit code: ${String(exitCode)}.`,
        ...stderrTail
      ].join("\n")
    );
  }
  return {
    durationMs: Math.round(performance.now() - startedAt),
    exitCode,
    report,
    stderrTail
  };
}

async function readBenchmarkExecutions(
  outputPath: string
): Promise<
  Partial<
    Record<MemoryModelBenchmarkProfileId, ProfileExecution | ProfileFailure>
  >
> {
  const serialized = await fs.readFile(outputPath, "utf8").catch(() => "");
  if (!serialized) return {};
  const report: unknown = JSON.parse(serialized);
  if (!isRecord(report)) return {};
  if (!isRecord(report.executions)) return {};
  return report.executions as Partial<
    Record<MemoryModelBenchmarkProfileId, ProfileExecution | ProfileFailure>
  >;
}

function qualityAggregates(
  executions: Partial<
    Record<MemoryModelBenchmarkProfileId, ProfileExecution | ProfileFailure>
  >
): Record<string, MemoryQualityAggregate> {
  return Object.fromEntries(
    Object.entries(executions).flatMap(([profile, execution]) => {
      if (!execution || isProfileFailure(execution)) return [];
      const aggregate = execution.report.aggregate;
      if (!isMemoryQualityAggregate(aggregate)) return [];
      return [[profile, aggregate]];
    })
  );
}

function comparisonFor(
  aggregates: Record<string, MemoryQualityAggregate>
): Record<string, MemoryQualityAggregate> | undefined {
  if (!aggregates.baseline) return undefined;
  return benchmarkQualityDeltas(aggregates);
}

function executionSummary(
  executions: Partial<
    Record<MemoryModelBenchmarkProfileId, ProfileExecution | ProfileFailure>
  >
) {
  return Object.fromEntries(
    Object.entries(executions).map(([profile, execution]) => {
      if (isProfileFailure(execution)) return [profile, execution];
      return [
        profile,
        {
          durationMs: execution.durationMs,
          exitCode: execution.exitCode,
          failures: Array.isArray(execution.report.failures)
            ? execution.report.failures.length
            : undefined
        }
      ];
    })
  );
}

function isProfileFailure(
  execution: ProfileExecution | ProfileFailure
): execution is ProfileFailure {
  return "error" in execution;
}

function isMemoryQualityAggregate(
  value: unknown
): value is MemoryQualityAggregate {
  if (!isRecord(value)) return false;
  if (typeof value.meanNdcgAt10 !== "number") return false;
  if (typeof value.meanReciprocalRank !== "number") return false;
  return typeof value.meanRecallAt10 === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringArgument(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value) throw new Error(`${name} requires a value.`);
  return value;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

void main();
