import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerAgentInWorkspace } from "../src/core/agents.js";
import {
  appendMessageInWorkspace,
  createThreadInWorkspace
} from "../src/core/threads.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import { initWorkspace } from "../src/core/workspace.js";

export const PROFILE = "claude-dev";
export const SESSION = "session-under-test";
export const MENTION_BODY = "Please review marc://@claude-dev now.";
export const MENTION_TEXT = "Please review";

export type Fixture = {
  root: string;
  info: WorkspaceInfo;
  threadId: string;
  cursor: string;
};

export type Scenario = {
  name: string;
  setup: (fixture: Fixture) => Promise<void>;
  args: (fixture: Fixture) => string[];
  whileRunning: (fixture: Fixture) => Promise<void>;
  expected: {
    status: string;
    exitCode: number;
    sessionLock: string | undefined;
  };
};

export const nothing = async (): Promise<void> => undefined;

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function fixture(): Promise<Fixture> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marc-wait-cli-"));
  const info = await initWorkspace(root);
  await registerAgentInWorkspace(info, {
    id: PROFILE,
    role: "developer",
    model: "claude-haiku-5-5",
    description: "Profile used by the wait command tests."
  });
  const thread = await createThreadInWorkspace(info, "Wait under test");
  const cursor = await appendMessageInWorkspace(info, thread.id, {
    agentId: "owner",
    role: "user",
    body: "Start the discussion."
  });
  return { root, info, threadId: thread.id, cursor: cursor.id };
}

export function mention(
  fx: Fixture,
  agentId: string,
  role: string,
  body: string
) {
  return appendMessageInWorkspace(fx.info, fx.threadId, {
    agentId,
    role,
    body
  });
}

export function baseArgs(fx: Fixture, since: string, thread: string): string[] {
  return [
    "wait",
    "--workspace",
    fx.root,
    "--thread",
    thread,
    "--mention",
    PROFILE,
    "--since",
    since,
    "--timeout-minutes",
    "1"
  ];
}

/** Runs one scenario end to end and checks the single JSON line, its exit code, and its privacy. */
export async function runScenario(scenario: Scenario): Promise<void> {
  const fx = await fixture();
  try {
    await scenario.setup(fx);
    const run = runCli(scenario.args(fx));
    await scenario.whileRunning(fx);
    const result = await run;

    const payload = singleJsonLine(result.stdout);
    assert.equal(result.code, scenario.expected.exitCode, result.stderr);
    assert.equal(payload.exitCode, scenario.expected.exitCode);
    assert.equal(payload.status, scenario.expected.status);
    assert.equal(payload.sessionLock, scenario.expected.sessionLock);
    assert.equal(typeof payload.next, "string");
    assert.match(String(payload.at), /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(
      result.stdout.includes(MENTION_TEXT),
      false,
      "no message body on stdout"
    );
  } finally {
    await fs.rm(fx.root, { recursive: true, force: true });
  }
}

export function singleJsonLine(stdout: string): Record<string, unknown> {
  const lines = stdout.split(/\r?\n/).filter((line) => line.length > 0);
  assert.equal(lines.length, 1, `expected one stdout line, got: ${stdout}`);
  return JSON.parse(lines[0]) as Record<string, unknown>;
}

export type CliRun = { code: number; stdout: string; stderr: string };

/** Runs the source CLI in a child process. CLAUDE_CODE_SESSION_ID is cleared so no session leaks in. */
export function runCli(args: string[]): Promise<CliRun> {
  return new Promise<CliRun>((resolve) => {
    execFile(
      process.execPath,
      ["--import", "tsx", "src/cli.ts", ...args],
      {
        cwd: process.cwd(),
        timeout: 120000,
        env: { ...process.env, CLAUDE_CODE_SESSION_ID: "" }
      },
      (error, stdout, stderr) => {
        resolve({ code: Number(error?.code ?? 0), stdout, stderr });
      }
    );
  });
}
