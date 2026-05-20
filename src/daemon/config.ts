import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { DaemonConfig } from "../core/types.js";
import { getCurrentDaemonFingerprint } from "./lifecycle.js";

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadDaemonConfig(
  options: Partial<DaemonConfig> = {}
): Promise<DaemonConfig> {
  const dataDir = path.resolve(
    options.dataDir ?? process.env.MARC_DAEMON_DIR ?? ".marc-daemon"
  );
  await fs.mkdir(dataDir, { recursive: true });

  const tokenPath = path.join(dataDir, "token");
  let token = options.token ?? process.env.MARC_TOKEN;
  if (!token && (await exists(tokenPath))) {
    token = (await fs.readFile(tokenPath, "utf8")).trim();
  }
  if (!token) {
    token = randomBytes(24).toString("hex");
    await fs.writeFile(tokenPath, token);
  }

  return {
    dataDir,
    host: options.host ?? process.env.MARC_HOST ?? "127.0.0.1",
    port: options.port ?? Number(process.env.MARC_PORT ?? 4187),
    token,
    tokenPath,
    mode: options.mode ?? "foreground",
    autoIdleMs:
      options.autoIdleMs ??
      Number(process.env.MARC_DAEMON_AUTO_IDLE_MS ?? 30 * 60 * 1000),
    fingerprint: options.fingerprint ?? (await getCurrentDaemonFingerprint())
  };
}
