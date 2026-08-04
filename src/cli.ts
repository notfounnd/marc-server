#!/usr/bin/env node
import { loadDaemonConfig } from "./daemon/config.js";
import {
  getDaemonStatus,
  restartDetachedDaemon,
  startDetachedDaemon,
  stopDaemon
} from "./daemon/lifecycle.js";
import { runDaemon } from "./daemon/server.js";
import { runMcpServer } from "./mcp/server.js";
import {
  prepareMemory,
  purgeMemory,
  readMemoryStatus,
  rebuildMemory,
  recallMemory
} from "./core/workspace-memory.js";
import type {
  MemoryQueryMode,
  MemoryRebuildMode
} from "./core/memory/types.js";
import type { DaemonConfig } from "./core/types.js";

type ParsedArgs = {
  command?: string;
  args: string[];
  values: Record<string, string | boolean>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const args: string[] = [];
  const values: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) {
      args.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      values[key] = true;
      continue;
    }
    values[key] = next;
    index += 1;
  }

  return { command, args, values };
}

function stringValue(
  values: Record<string, string | boolean>,
  key: string
): string | undefined {
  const value = values[key];
  return typeof value === "string" ? value : undefined;
}

function numberValue(
  values: Record<string, string | boolean>,
  key: string
): number | undefined {
  const value = stringValue(values, key);
  return value ? Number(value) : undefined;
}

function usage(): never {
  console.error(`Usage:
  marc daemon [--host 127.0.0.1] [--port 4187] [--data-dir .marc-daemon] [--token <token>]
  marc daemon start|stop|restart|status [--host 127.0.0.1] [--port 4187] [--data-dir .marc-daemon]
  marc memory status|prepare|rebuild|recall|purge [--workspace <path>] [--mode incremental|full] [--query <text>] [--query-mode auto|literal] [--limit <n>] [--depth 0|1|2|3]
  marc mcp [--workspace <path>] [--daemon-url http://127.0.0.1:4187] [--token <token>]`);
  process.exit(1);
}

function printResult(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

type DaemonCommandHandler = (config: DaemonConfig) => Promise<unknown>;

const daemonCommandHandlers: Record<string, DaemonCommandHandler> = {
  start: (config) => startDetachedDaemon({ ...config, mode: "detached" }),
  stop: (config) => stopDaemon({ ...config, mode: "detached" }),
  restart: (config) => restartDetachedDaemon({ ...config, mode: "detached" }),
  status: (config) => getDaemonStatus({ ...config, mode: "detached" })
};

async function handleDaemonCommand(parsed: ParsedArgs): Promise<void> {
  const action = parsed.args[0];
  const config = await loadDaemonConfig({
    host: stringValue(parsed.values, "host"),
    port: numberValue(parsed.values, "port"),
    dataDir: stringValue(parsed.values, "data-dir"),
    token: stringValue(parsed.values, "token"),
    mode: parsed.values["detached-child"] === true ? "detached" : "foreground",
    autoIdleMs: numberValue(parsed.values, "auto-idle-ms")
  });

  const handler = action ? daemonCommandHandlers[action] : undefined;
  if (handler) {
    printResult(await handler(config));
    return;
  }

  if (action && action !== "daemon") {
    usage();
  }

  await runDaemon(config);
}

const memoryCommandHandlers: Record<
  string,
  (parsed: ParsedArgs, workspaceRoot: string) => Promise<unknown>
> = {
  status: (_parsed, workspaceRoot) => readMemoryStatus(workspaceRoot),
  prepare: (_parsed, workspaceRoot) => prepareMemory(workspaceRoot),
  purge: (_parsed, workspaceRoot) => purgeMemory(workspaceRoot),
  rebuild: (parsed, workspaceRoot) =>
    rebuildMemory(workspaceRoot, memoryRebuildMode(parsed)),
  recall: (parsed, workspaceRoot) =>
    recallMemory(workspaceRoot, {
      query: stringValue(parsed.values, "query") ?? "",
      queryMode: memoryQueryMode(parsed),
      limit: numberValue(parsed.values, "limit"),
      depth: numberValue(parsed.values, "depth")
    })
};

async function handleMemoryCommand(parsed: ParsedArgs): Promise<void> {
  const action = parsed.args[0];
  const handler = action ? memoryCommandHandlers[action] : undefined;
  if (!handler) {
    usage();
  }
  if (action === "recall" && !stringValue(parsed.values, "query")) {
    usage();
  }
  if (action === "recall" && stringValue(parsed.values, "min-score"))
    throw new Error("--min-score was removed. Use --depth from 0 to 3.");

  const workspaceRoot =
    stringValue(parsed.values, "workspace") ?? process.cwd();
  printResult(await handler(parsed, workspaceRoot));
}

function memoryRebuildMode(parsed: ParsedArgs): MemoryRebuildMode {
  const mode = stringValue(parsed.values, "mode");
  if (mode === undefined || mode === "incremental") return "incremental";
  if (mode === "full") return mode;
  throw new Error("Memory rebuild mode must be incremental or full.");
}

function memoryQueryMode(parsed: ParsedArgs): MemoryQueryMode | undefined {
  const mode = stringValue(parsed.values, "query-mode");
  if (mode === undefined || mode === "auto") return mode;
  if (mode === "literal") return mode;
  throw new Error("Memory query mode must be auto or literal.");
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.command === "daemon") {
    await handleDaemonCommand(parsed);
    return;
  }

  if (parsed.command === "mcp") {
    await runMcpServer({
      workspace: stringValue(parsed.values, "workspace"),
      daemonUrl: stringValue(parsed.values, "daemon-url"),
      token: stringValue(parsed.values, "token")
    });
    return;
  }

  if (parsed.command === "memory") {
    await handleMemoryCommand(parsed);
    return;
  }

  usage();
}

main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error)
  );
  process.exit(1);
});
