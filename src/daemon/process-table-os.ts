import { execFile } from "node:child_process";
import {
  parseProcessRows,
  type ProcessTableRead
} from "../core/process-table.js";

/** The longest the listing may take before it counts as unavailable. */
export const PROCESS_TABLE_TIMEOUT_MS = 10_000;

/** The source of the process table. Tests inject a fake one; production reads the operating system. */
export type ProcessTablePort = {
  list(): Promise<ProcessTableRead>;
};

type Reader = { command: string; args: readonly string[] };

/**
 * The read-only listing of each platform family. Only the pid and the parent pid are asked for, and no
 * command line is ever requested or printed. Nothing runs through a shell.
 */
const READERS: Record<"win32" | "posix", Reader> = {
  win32: {
    command: "powershell.exe",
    args: [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId | ForEach-Object { [string]$_.ProcessId + ' ' + [string]$_.ParentProcessId }"
    ]
  },
  posix: { command: "ps", args: ["-A", "-o", "pid=", "-o", "ppid="] }
};

/** The table of this machine: the port the daemon uses unless a test injects another. */
export const OS_PROCESS_TABLE: ProcessTablePort = {
  list: () => runReader(readerFor(process.platform))
};

/** The port a daemon reads from: the injected one, or the operating system's. */
export function processesOf(
  port: ProcessTablePort | undefined
): ProcessTablePort {
  if (port !== undefined) return port;
  return OS_PROCESS_TABLE;
}

function readerFor(platform: NodeJS.Platform): Reader {
  if (platform === "win32") return READERS.win32;
  return READERS.posix;
}

function runReader(reader: Reader): Promise<ProcessTableRead> {
  return new Promise((resolve) => {
    execFile(
      reader.command,
      [...reader.args],
      {
        shell: false,
        windowsHide: true,
        timeout: PROCESS_TABLE_TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024
      },
      (error, stdout) => {
        if (error) {
          resolve({ status: "unavailable", reason: "command_failed" });
          return;
        }
        resolve(parseProcessRows(stdout));
      }
    );
  });
}
