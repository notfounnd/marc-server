import fs from "node:fs/promises";
import { safeJoin } from "../paths.js";
import type {
  WorkspaceInfo,
  WorkspaceSettings,
  WorkspaceSettingsInput
} from "../types.js";
import {
  withWorkspaceWriteLock,
  writeFileAtomically
} from "../write-coordination.js";

const SETTINGS_FILE = "SETTINGS.md";
const AUTO_REBUILD_PATTERN = /^memory\.autoRebuild:\s*(true|false)\s*$/m;

const DEFAULT_SETTINGS: WorkspaceSettings = {
  memory: {
    autoRebuild: true
  }
};

export function workspaceSettingsPath(info: WorkspaceInfo): string {
  return safeJoin(info.marcPath, SETTINGS_FILE);
}

export async function readWorkspaceSettingsInWorkspace(
  info: WorkspaceInfo
): Promise<WorkspaceSettings> {
  const content = await fs
    .readFile(workspaceSettingsPath(info), "utf8")
    .catch(() => "");
  return {
    memory: {
      autoRebuild: readAutoRebuild(content)
    }
  };
}

export async function updateWorkspaceSettingsInWorkspace(
  info: WorkspaceInfo,
  input: WorkspaceSettingsInput
): Promise<WorkspaceSettings> {
  const current = await readWorkspaceSettingsInWorkspace(info);
  const next = mergeWorkspaceSettings(current, input);
  await withWorkspaceWriteLock(info.marcPath, "workspace-settings", () =>
    writeFileAtomically(workspaceSettingsPath(info), renderSettings(next))
  );
  return next;
}

function mergeWorkspaceSettings(
  current: WorkspaceSettings,
  input: WorkspaceSettingsInput
): WorkspaceSettings {
  return {
    memory: {
      autoRebuild:
        typeof input.memory?.autoRebuild === "boolean"
          ? input.memory.autoRebuild
          : current.memory.autoRebuild
    }
  };
}

function readAutoRebuild(content: string): boolean {
  const match = AUTO_REBUILD_PATTERN.exec(content);
  if (!match) return DEFAULT_SETTINGS.memory.autoRebuild;
  return match[1] === "true";
}

function renderSettings(settings: WorkspaceSettings): string {
  const state = settings.memory.autoRebuild ? "enabled" : "disabled";
  return [
    "# mARC Workspace Settings",
    "",
    "<!-- marc-settings",
    `memory.autoRebuild: ${settings.memory.autoRebuild}`,
    "-->",
    "",
    "## Memory",
    "",
    `- Automatic memory rebuild: ${state}`,
    ""
  ].join("\n");
}
