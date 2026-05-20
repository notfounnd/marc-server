import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { DaemonConfig, DaemonRuntimeState } from "../core/types.js";

export type DaemonProcessStatus =
  | { status: "stopped"; dataDir: string; statePath: string }
  | {
      status: "stale";
      dataDir: string;
      statePath: string;
      state: DaemonRuntimeState;
    }
  | {
      status: "running";
      dataDir: string;
      statePath: string;
      state: DaemonRuntimeState;
      fingerprintMatches: boolean;
      uptimeMs: number;
    };

export type DaemonApiStatus = {
  status: string;
  pid?: number;
  mode?: "foreground" | "detached";
  uptimeMs?: number;
  url?: string;
  dataDir?: string;
  tokenPath?: string;
  fingerprint?: string;
  autoIdleMs?: number;
  idleForMs?: number;
  activeUiClients?: number;
  leases?: unknown[];
};

export type DaemonStatus =
  | DaemonProcessStatus
  | {
      status: "running";
      source: "api";
      dataDir: string;
      statePath: string;
      daemon: DaemonApiStatus;
      httpStatus: 200;
    }
  | {
      status: "unknown";
      source: "api";
      dataDir: string;
      statePath: string;
      httpStatus: number;
      error: string;
    };

export type StartDaemonResult = {
  action: "started" | "already-running";
  status: Extract<DaemonProcessStatus, { status: "running" }>;
};

export function daemonStatePath(dataDir: string): string {
  return path.join(dataDir, "daemon.json");
}

export function daemonLogPath(dataDir: string): string {
  return path.join(dataDir, "daemon.log");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentDaemonFingerprint(): Promise<string> {
  if (process.env.MARC_DAEMON_FINGERPRINT) {
    return process.env.MARC_DAEMON_FINGERPRINT;
  }

  const entrypoint = process.argv[1] ? path.resolve(process.argv[1]) : "";
  const entrypointMtime =
    entrypoint && (await pathExists(entrypoint))
      ? (await fs.stat(entrypoint)).mtimeMs
      : 0;
  return [process.execPath, entrypoint, Math.round(entrypointMtime)].join("|");
}

export async function readDaemonRuntimeState(
  dataDir: string
): Promise<DaemonRuntimeState | undefined> {
  const statePath = daemonStatePath(dataDir);
  if (!(await pathExists(statePath))) {
    return undefined;
  }

  const parsed = JSON.parse(
    await fs.readFile(statePath, "utf8")
  ) as Partial<DaemonRuntimeState>;
  if (parsed.version !== 1 || typeof parsed.pid !== "number") {
    return undefined;
  }
  return parsed as DaemonRuntimeState;
}

export async function writeDaemonRuntimeState(
  state: DaemonRuntimeState
): Promise<void> {
  await fs.mkdir(state.dataDir, { recursive: true });
  await fs.writeFile(
    daemonStatePath(state.dataDir),
    `${JSON.stringify(state, null, 2)}\n`
  );
}

export async function patchDaemonRuntimeState(
  dataDir: string,
  patch: Partial<
    Pick<DaemonRuntimeState, "lastActivityAt" | "activeUiClients" | "leases">
  >
): Promise<void> {
  const state = await readDaemonRuntimeState(dataDir);
  if (!state) {
    return;
  }
  await writeDaemonRuntimeState({ ...state, ...patch });
}

export async function removeDaemonRuntimeState(dataDir: string): Promise<void> {
  await fs.rm(daemonStatePath(dataDir), { force: true });
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "EPERM";
  }
}

function runningStatus(
  config: DaemonConfig,
  state: DaemonRuntimeState,
  statePath: string
): Extract<DaemonProcessStatus, { status: "running" }> {
  return {
    status: "running",
    dataDir: config.dataDir,
    statePath,
    state,
    fingerprintMatches: state.fingerprint === config.fingerprint,
    uptimeMs: Math.max(0, Date.now() - Date.parse(state.startedAt))
  };
}

export async function getDaemonProcessStatus(
  config: DaemonConfig
): Promise<DaemonProcessStatus> {
  const statePath = daemonStatePath(config.dataDir);
  const state = await readDaemonRuntimeState(config.dataDir);
  if (!state) {
    return { status: "stopped", dataDir: config.dataDir, statePath };
  }

  if (!isProcessRunning(state.pid)) {
    await removeDaemonRuntimeState(config.dataDir);
    return { status: "stale", dataDir: config.dataDir, statePath, state };
  }

  return runningStatus(config, state, statePath);
}

export async function getDaemonStatus(
  config: DaemonConfig
): Promise<DaemonStatus> {
  const processStatus = await getDaemonProcessStatus(config);
  if (processStatus.status !== "stopped") {
    return processStatus;
  }

  const daemonUrl = `http://${config.host}:${config.port}`;
  try {
    const response = await fetch(new URL("/api/status", daemonUrl), {
      headers: { authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(1000)
    });

    if (!response.ok) {
      return {
        status: "unknown",
        source: "api",
        dataDir: config.dataDir,
        statePath: processStatus.statePath,
        httpStatus: response.status,
        error: `Daemon API responded with ${response.status}: ${await response.text()}`
      };
    }

    const body = (await response.json()) as {
      modules?: { daemon?: DaemonApiStatus };
    };
    return {
      status: "running",
      source: "api",
      dataDir: config.dataDir,
      statePath: processStatus.statePath,
      daemon: body.modules?.daemon ?? { status: "ready", url: daemonUrl },
      httpStatus: 200
    };
  } catch {
    return processStatus;
  }
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return !isProcessRunning(pid);
}

export async function stopDaemon(
  config: DaemonConfig
): Promise<DaemonProcessStatus> {
  const status = await getDaemonProcessStatus(config);
  if (status.status !== "running") {
    return status;
  }

  process.kill(status.state.pid, "SIGTERM");
  if (!(await waitForExit(status.state.pid, 5000))) {
    process.kill(status.state.pid, "SIGKILL");
    await waitForExit(status.state.pid, 2000);
  }
  await removeDaemonRuntimeState(config.dataDir);
  return getDaemonProcessStatus(config);
}

export async function createRuntimeState(
  config: DaemonConfig
): Promise<DaemonRuntimeState> {
  const now = new Date().toISOString();
  return {
    version: 1,
    pid: process.pid,
    startedAt: now,
    host: config.host,
    port: config.port,
    url: `http://${config.host}:${config.port}`,
    dataDir: config.dataDir,
    tokenPath: config.tokenPath,
    logPath: daemonLogPath(config.dataDir),
    fingerprint: config.fingerprint,
    mode: config.mode,
    lastActivityAt: now,
    activeUiClients: 0,
    autoIdleMs: config.autoIdleMs,
    leases: []
  };
}

export async function startDetachedDaemon(
  config: DaemonConfig
): Promise<StartDaemonResult> {
  const current = await getDaemonProcessStatus(config);
  if (current.status === "running" && !current.fingerprintMatches) {
    throw new Error(
      `Daemon is already running with a different fingerprint. Use 'marc daemon restart --data-dir ${config.dataDir}'.`
    );
  }
  if (current.status === "running") {
    return { action: "already-running", status: current };
  }

  await fs.mkdir(config.dataDir, { recursive: true });
  const logHandle = await fs.open(daemonLogPath(config.dataDir), "a");
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    throw new Error("Cannot start detached daemon without a CLI entrypoint.");
  }

  const args = [
    entrypoint,
    "daemon",
    "--detached-child",
    "--host",
    config.host,
    "--port",
    String(config.port),
    "--data-dir",
    config.dataDir,
    "--auto-idle-ms",
    String(config.autoIdleMs)
  ];

  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: ["ignore", logHandle.fd, logHandle.fd],
    windowsHide: true
  });
  child.unref();

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const status = await getDaemonProcessStatus(config);
    if (status.status === "running") {
      await logHandle.close();
      return { action: "started", status };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await logHandle.close();
  throw new Error(
    `Daemon did not report ready state in ${daemonStatePath(config.dataDir)}.`
  );
}

export async function restartDetachedDaemon(
  config: DaemonConfig
): Promise<StartDaemonResult> {
  await stopDaemon(config);
  return startDetachedDaemon(config);
}
