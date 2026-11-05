import fs from "node:fs/promises";
import { validatePolicy, type ActivationPolicy } from "./activation-policy.js";
import { isLegacyPolicy } from "./activation-policy-v1.js";
import type { ValidationError } from "./activation-rules.js";
import { safeJoin } from "./paths.js";
import type { WorkspaceInfo } from "./types.js";
import {
  threadWriteResource,
  withWorkspaceWriteLock,
  writeFileAtomically
} from "./write-coordination.js";

/** Structured configuration in the thread folder, allowed as JSON by ADR 0001. */
export const POLICY_FILE_NAME = "policy.json";

/**
 * What the thread's policy file says. "outdated" is an F3a version 1 file: it is read and
 * never written here. Only an authorized save normalizes it.
 */
export type PolicyView =
  | { status: "none" }
  | { status: "outdated"; enabled: boolean }
  | { status: "ready"; policy: ActivationPolicy };

export type ThreadPolicyRead =
  | PolicyView
  | { status: "invalid"; errors: ValidationError[] };

export async function readThreadPolicy(
  info: WorkspaceInfo,
  threadId: string
): Promise<ThreadPolicyRead> {
  const content = await readOptional(policyPath(info, threadId));
  if (content === undefined) return { status: "none" };
  return fromContent(content);
}

/** "closed" when the thread's SUMMARY.md exists, and then nothing is written. */
export type PolicyWrite = "written" | "closed";

/**
 * Writes under the thread's write lock, after checking that the thread is still open. The summary
 * write takes the same lock, so either this write lands first and the folder watcher removes it, or
 * it sees the SUMMARY.md and writes nothing. Only the daemon's UI route calls this.
 */
export function writeThreadPolicy(
  info: WorkspaceInfo,
  threadId: string,
  policy: ActivationPolicy
): Promise<PolicyWrite> {
  return withWorkspaceWriteLock(
    info.marcPath,
    threadWriteResource(threadId),
    async (): Promise<PolicyWrite> => {
      if (await fileExists(summaryPath(info, threadId))) return "closed";
      await writeFileAtomically(
        policyPath(info, threadId),
        serializePolicy(policy)
      );
      return "written";
    }
  );
}

export function serializePolicy(policy: ActivationPolicy): string {
  return `${JSON.stringify(policy, null, 2)}\n`;
}

/**
 * Removes the policy file of a closed thread, under the thread's write lock. The lock is taken
 * only when the file is there, so a startup pass over many closed threads stays cheap. A missing
 * file is not an error.
 */
export async function removeThreadPolicy(
  info: WorkspaceInfo,
  threadId: string
): Promise<void> {
  const filePath = policyPath(info, threadId);
  if (!(await fileExists(filePath))) return;
  await withWorkspaceWriteLock(
    info.marcPath,
    threadWriteResource(threadId),
    () => fs.rm(filePath, { force: true })
  );
}

function fromContent(content: string): ThreadPolicyRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      status: "invalid",
      errors: [{ field: POLICY_FILE_NAME, code: "unreadable_json" }]
    };
  }
  return readableOf(parsed);
}

function readableOf(parsed: unknown): ThreadPolicyRead {
  if (isLegacyPolicy(parsed)) {
    return { status: "outdated", enabled: parsed.enabled };
  }
  const result = validatePolicy(parsed);
  return result.ok
    ? { status: "ready", policy: result.policy }
    : { status: "invalid", errors: result.errors };
}

function policyPath(info: WorkspaceInfo, threadId: string): string {
  return safeJoin(info.marcPath, "threads", threadId, POLICY_FILE_NAME);
}

function summaryPath(info: WorkspaceInfo, threadId: string): string {
  return safeJoin(info.marcPath, "threads", threadId, "SUMMARY.md");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
