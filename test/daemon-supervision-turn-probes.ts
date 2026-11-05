import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { TOKEN } from "./daemon-session-http-fixtures.js";
import type { TurnThread } from "./daemon-supervision-turn-fixtures.js";

/** The deadline notice of a run, read with the daemon token as the MCP process reads it. */
export async function noticeOf(
  thread: TurnThread,
  runId: string
): Promise<{ status: number; text: string }> {
  const response = await fetch(
    new URL(
      `/api/supervision/runs/${encodeURIComponent(runId)}/notice`,
      thread.daemon.baseUrl
    ),
    { headers: { authorization: `Bearer ${TOKEN}` } }
  );
  return { status: response.status, text: await response.text() };
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Waits until the process is gone. A process that never leaves is the test's failure. */
export async function waitUntilGone(pid: number): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (isAlive(pid) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(isAlive(pid), false, `process ${pid} is still alive`);
}

/** Reads the grandchild pid the ignore scenario writes after its launch, polling until the file has it. */
export async function grandchildPidOf(thread: TurnThread): Promise<number> {
  const file = path.join(thread.daemon.dataDir, "grandchild.pid");
  const deadline = Date.now() + 10_000;
  let text = await fs.readFile(file, "utf8").catch(() => "");
  while (text === "" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    text = await fs.readFile(file, "utf8").catch(() => "");
  }
  assert.notEqual(text, "", "the grandchild did not report its pid");
  return Number(text);
}
