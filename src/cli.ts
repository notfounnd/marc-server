#!/usr/bin/env node
import { loadDaemonConfig } from "./daemon/config.js";
import { runDaemon } from "./daemon/server.js";
import { runMcpServer } from "./mcp/server.js";

type ParsedArgs = {
  command?: string;
  values: Record<string, string | boolean>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const values: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      values[key] = true;
    } else {
      values[key] = next;
      index += 1;
    }
  }

  return { command, values };
}

function stringValue(values: Record<string, string | boolean>, key: string): string | undefined {
  const value = values[key];
  return typeof value === "string" ? value : undefined;
}

function numberValue(values: Record<string, string | boolean>, key: string): number | undefined {
  const value = stringValue(values, key);
  return value ? Number(value) : undefined;
}

function usage(): never {
  console.error(`Usage:
  marc daemon [--host 127.0.0.1] [--port 4187] [--data-dir .marc-daemon] [--token <token>]
  marc mcp [--workspace <path>] [--daemon-url http://127.0.0.1:4187] [--token <token>]`);
  process.exit(1);
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.command === "daemon") {
    const config = await loadDaemonConfig({
      host: stringValue(parsed.values, "host"),
      port: numberValue(parsed.values, "port"),
      dataDir: stringValue(parsed.values, "data-dir"),
      token: stringValue(parsed.values, "token"),
    });
    await runDaemon(config);
    return;
  }

  if (parsed.command === "mcp") {
    await runMcpServer({
      workspace: stringValue(parsed.values, "workspace"),
      daemonUrl: stringValue(parsed.values, "daemon-url"),
      token: stringValue(parsed.values, "token"),
    });
    return;
  }

  usage();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
