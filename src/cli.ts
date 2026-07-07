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
  readMemoryStatus,
  rebuildMemory,
  recallMemory
} from "./core/workspace.js";
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
  marc memory status|prepare|rebuild|recall [--workspace <path>] [--query <text>] [--limit <n>] [--min-score <n>]
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
  rebuild: (_parsed, workspaceRoot) => rebuildMemory(workspaceRoot),
  recall: (parsed, workspaceRoot) =>
    recallMemory(workspaceRoot, {
      query: stringValue(parsed.values, "query") ?? "",
      limit: numberValue(parsed.values, "limit"),
      minScore: numberValue(parsed.values, "min-score")
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

  const workspaceRoot =
    stringValue(parsed.values, "workspace") ?? process.cwd();
  printResult(await handler(parsed, workspaceRoot));
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
