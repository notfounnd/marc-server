import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { readThreadPolicy } from "./activation-policy-store.js";
import { workspaceId } from "./ids.js";
import { marcDir, resolveWorkspace } from "./paths.js";
import { parseMessages } from "./markdown.js";
import { inspectThreadFiles } from "./thread-summary-paths.js";
import type { WaitDeps, WaitTimers, WaitWatcher } from "./thread-wait.js";
import type { WorkspaceInfo } from "./types.js";

/**
 * Same construction as getWorkspaceInfo in workspace.ts. That module reaches core/memory
 * through workspace-status.ts, so the wait path builds the record itself.
 */
export function workspaceInfoFor(workspaceRoot: string): WorkspaceInfo {
  const rootPath = resolveWorkspace(workspaceRoot);
  const name = path.basename(rootPath);
  return {
    id: workspaceId(rootPath, name),
    name,
    rootPath,
    marcPath: marcDir(rootPath)
  };
}

/**
 * Production dependencies. The thread paths come from inspectThreadFiles, the same helper
 * the summary core uses, so "closed" means the SUMMARY.md that the core reads.
 */
export async function createWaitRuntimeDeps(
  info: WorkspaceInfo,
  threadId: string
): Promise<WaitDeps> {
  const files = await inspectThreadFiles(info, threadId);
  return {
    readSnapshot: async () => ({
      messages: parseMessages(await fsp.readFile(files.chatPath, "utf8")),
      closed: await pathExists(files.summaryPath),
      policyActive: await policyActiveIn(info, threadId)
    }),
    watch: (onChange) => watchDirectory(files.threadPath, onChange),
    timers: nodeTimers
  };
}

/**
 * A thread is governed by its policy when policy.json is enabled. A file that exists but
 * cannot be read or validated also counts as governed: the wait fails closed rather than
 * releasing manual work it cannot account for. A missing file or a disabled policy keeps
 * the manual flow.
 */
async function policyActiveIn(
  info: WorkspaceInfo,
  threadId: string
): Promise<boolean> {
  const stored = await readThreadPolicy(info, threadId);
  if (stored.status === "none") return false;
  if (stored.status === "invalid") return true;
  if (stored.status === "outdated") return stored.enabled;
  return stored.policy.enabled;
}

const nodeTimers: WaitTimers = {
  setTimer(callback, delayMs) {
    const handle = setTimeout(callback, delayMs);
    return { cancel: () => clearTimeout(handle) };
  }
};

async function pathExists(filePath: string): Promise<boolean> {
  return fsp.stat(filePath).then(
    () => true,
    () => false
  );
}

/** Best effort: a watcher failure only removes the early wake-up, never the periodic poll. */
function watchDirectory(directory: string, onChange: () => void): WaitWatcher {
  try {
    const watcher = fs.watch(directory, () => onChange());
    watcher.on("error", () => undefined);
    return { close: () => watcher.close() };
  } catch {
    return { close: () => undefined };
  }
}
