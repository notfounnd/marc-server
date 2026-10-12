import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type SummaryUpdateProcessOutcome = {
  status: "fulfilled" | "rejected";
  outcome: string | null;
  summaryRevision: string | null;
  errorName: string | null;
  errorCode: string | null;
  body: string;
};

export type SummaryUpdateProcessResult = {
  pid: number;
  results: SummaryUpdateProcessOutcome[];
};

export async function tempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "marc-thread-summary-"));
}

export function getSummaryPath(workspace: string, threadId: string): string {
  return path.join(workspace, ".marc", "threads", threadId, "SUMMARY.md");
}

export function summaryRevision(markdown: string): string {
  return createHash("sha256").update(markdown).digest("hex");
}

export async function runSummaryUpdateProcess(
  workspace: string,
  threadId: string,
  expectedSummaryRevision: string,
  body: string
): Promise<SummaryUpdateProcessResult> {
  const workspaceModule = new URL("../src/core/workspace.ts", import.meta.url)
    .href;
  const script = [
    `import { writeThreadSummary } from ${JSON.stringify(workspaceModule)};`,
    "const input = JSON.parse(process.env.MARC_SUMMARY_TEST_INPUT ?? '{}');",
    "const settled = await Promise.allSettled([writeThreadSummary(input.workspace, { threadId: input.threadId, mode: 'update', expectedSummaryRevision: input.expectedSummaryRevision, body: input.body })]);",
    "process.stdout.write(JSON.stringify({ pid: process.pid, results: settled.map((result) => ({ status: result.status, outcome: result.value?.outcome ?? null, summaryRevision: result.value?.summaryRevision ?? null, errorName: result.reason?.name ?? null, errorCode: result.reason?.code ?? null, body: input.body })) }));"
  ].join("\n");
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MARC_SUMMARY_TEST_INPUT: JSON.stringify({
          workspace,
          threadId,
          expectedSummaryRevision,
          body
        })
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  return collectProcessResult(child) as Promise<SummaryUpdateProcessResult>;
}

export async function runSummaryReadProcess(
  workspace: string,
  threadId: string
): Promise<Record<string, unknown>> {
  const workspaceModule = new URL("../src/core/workspace.ts", import.meta.url)
    .href;
  const script = [
    `import { listThreads, readThreadInfo } from ${JSON.stringify(workspaceModule)};`,
    "const input = JSON.parse(process.env.MARC_SUMMARY_TEST_INPUT ?? '{}');",
    "const info = await readThreadInfo(input.workspace, input.threadId);",
    "const closed = await listThreads(input.workspace, { status: 'closed' });",
    "process.stdout.write(JSON.stringify({ pid: process.pid, status: info.status, summaryRevision: info.summaryRevision, closedIds: closed.map((thread) => thread.id) }));"
  ].join("\n");
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MARC_SUMMARY_TEST_INPUT: JSON.stringify({ workspace, threadId })
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  return collectProcessResult(child);
}

async function collectProcessResult(
  child: ReturnType<typeof spawn>
): Promise<Record<string, unknown>> {
  let stdout = "";
  let stderr = "";
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => (stdout += chunk));
  child.stderr?.on("data", (chunk: string) => (stderr += chunk));
  const [exitCode] = (await once(child, "close")) as [number | null];
  assert.equal(exitCode, 0, stderr);
  return JSON.parse(stdout) as Record<string, unknown>;
}
