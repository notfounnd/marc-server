import { readFileSync } from "node:fs";
import path from "node:path";
import { marcDir } from "./paths.js";

/** The workspace settings file under .marc. It holds the memory, activation and listening sections. */
export const SETTINGS_FILE = "marc.config.json";

/**
 * The listening default for a session that starts on a thread, read straight from the file so the MCP helper
 * needs no daemon and no memory module. A missing, unreadable or non-boolean value reads as off.
 */
export function readListeningDefaultSync(workspaceRoot: string): "off" | "on" {
  try {
    const content = readFileSync(
      path.join(marcDir(workspaceRoot), SETTINGS_FILE),
      "utf8"
    );
    return listeningOn(JSON.parse(content)) ? "on" : "off";
  } catch {
    return "off";
  }
}

function listeningOn(parsed: unknown): boolean {
  if (!isRecord(parsed)) return false;
  const listening = parsed.listening;
  if (!isRecord(listening)) return false;
  return listening.defaultOn === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
