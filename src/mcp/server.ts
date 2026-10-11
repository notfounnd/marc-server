import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/server";
import {
  StdioServerTransport,
  serveStdio
} from "@modelcontextprotocol/server/stdio";
import { disposeMemoryProviders } from "../core/workspace-memory.js";
import { registerAgentTools } from "./agent-tools.js";
import { startDaemonLeaseHeartbeat } from "./daemon.js";
import { registerMemoryTools } from "./memory-tools.js";
import { registerThreadTools } from "./thread-tools.js";
import { McpToolCoordinator } from "./tool-registration.js";
import type { McpOptions } from "./types.js";
import { registerWorkspaceTools } from "./workspace-tools.js";

const SUPPORTED_PROTOCOL_VERSIONS = ["2026-07-28"];
const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";
const CLIENT_CAPABILITIES_META_KEY =
  "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";
const PROCESS_PACKAGE_VERSION = loadPackageVersion();
const PROTOCOL_VERSION_GUIDANCE = `mARC supports MCP ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")} only. Check your agent harness documentation for protocol support and any required configuration or upgrade.`;
type StdioMessage = Parameters<
  NonNullable<StdioServerTransport["onmessage"]>
>[0];

class ProtocolVersionGuidanceTransport extends StdioServerTransport {
  override send(
    message: Parameters<StdioServerTransport["send"]>[0]
  ): Promise<void> {
    if (!("error" in message)) return super.send(message);
    if (message.error.code !== -32022) return super.send(message);
    if (message.error.message.includes(PROTOCOL_VERSION_GUIDANCE)) {
      return super.send(message);
    }
    return super.send({
      ...message,
      error: {
        ...message.error,
        message: `${message.error.message} ${PROTOCOL_VERSION_GUIDANCE}`
      }
    });
  }
}

export function buildMcpServer(
  options: McpOptions = {},
  coordinator = new McpToolCoordinator()
): McpServer {
  const workspaceRoot = options.workspace ?? process.cwd();
  const server = new McpServer(
    { name: "marc", version: PROCESS_PACKAGE_VERSION },
    {
      supportedProtocolVersions: SUPPORTED_PROTOCOL_VERSIONS,
      cacheHints: {
        "server/discover": { ttlMs: 0, cacheScope: "private" },
        "tools/list": { ttlMs: 0, cacheScope: "private" }
      }
    }
  );

  registerWorkspaceTools(server, coordinator, options);
  registerThreadTools(server, coordinator, workspaceRoot);
  registerAgentTools(server, coordinator, workspaceRoot);
  registerMemoryTools(server, workspaceRoot, coordinator);
  return server;
}

export async function runMcpServer(options: McpOptions = {}): Promise<void> {
  const coordinator = new McpToolCoordinator();
  const cleanupHeartbeat = await startDaemonLeaseHeartbeat(options);
  const transport = new ProtocolVersionGuidanceTransport();
  let shutdown: Promise<void> | undefined;
  let resolveClosed: () => void = () => undefined;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  const finish = (): Promise<void> => {
    if (shutdown) return shutdown;
    coordinator.stopAccepting();
    shutdown = (async () => {
      try {
        await handle.close();
      } catch {
        // Stdio may already have closed itself after EOF.
      }
      await coordinator.waitForIdle();
      await cleanupHeartbeat();
      await disposeMemoryProviders();
      process.stdin.off("end", stop);
      process.stdin.off("close", stop);
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolveClosed();
    })();
    return shutdown;
  };
  const stop = (): void => {
    void finish();
  };

  process.stdin.once("end", stop);
  process.stdin.once("close", stop);
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const handle = serveStdio(() => buildMcpServer(options, coordinator), {
    legacy: "reject",
    transport,
    onerror: () => process.stderr.write("mARC MCP stdio transport error\n")
  });
  const sdkOnMessage = transport.onmessage;
  transport.onmessage = (message) => {
    const unsupported = getUnsupportedProtocolVersion(message);
    if (!unsupported) {
      sdkOnMessage?.(message);
      return;
    }
    if (!("id" in unsupported)) return;
    rejectUnsupportedProtocolVersion(
      transport,
      unsupported.id,
      unsupported.requested,
      stop
    );
  };
  const sdkOnClose = transport.onclose;
  transport.onclose = () => {
    sdkOnClose?.();
    stop();
  };
  await closed;
  await finish();
}

function getUnsupportedProtocolVersion(
  message: StdioMessage
):
  | { id: string | number; requested: string }
  | { requested: string }
  | undefined {
  if (!("method" in message)) return undefined;
  const params = message.params;
  if (!isRecord(params)) return undefined;
  const metadata = params._meta;
  if (!isRecord(metadata)) return undefined;
  const requested = metadata[PROTOCOL_VERSION_META_KEY];
  if (typeof requested !== "string") return undefined;
  if (!isRecord(metadata[CLIENT_CAPABILITIES_META_KEY])) return undefined;
  const clientInfo = metadata[CLIENT_INFO_META_KEY];
  if (clientInfo !== undefined && !isValidClientInfo(clientInfo))
    return undefined;
  if (SUPPORTED_PROTOCOL_VERSIONS.includes(requested)) return undefined;
  if (!("id" in message)) return { requested };
  return { id: message.id, requested };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidClientInfo(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.name === "string" && typeof value.version === "string";
}

function rejectUnsupportedProtocolVersion(
  transport: StdioServerTransport,
  id: string | number,
  requested: string,
  stop: () => void
): void {
  void (async () => {
    try {
      await transport.send({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32022,
          message: `Unsupported protocol version: ${requested}`,
          data: {
            supported: SUPPORTED_PROTOCOL_VERSIONS,
            requested
          }
        }
      });
    } catch {
      process.stderr.write("mARC MCP stdio transport error\n");
      stop();
    }
  })();
}

function loadPackageVersion(): string {
  const packageUrl = new URL("../../package.json", import.meta.url);
  const parsed: unknown = JSON.parse(readFileSync(packageUrl, "utf8"));
  if (hasVersion(parsed)) return parsed.version;
  throw new Error("Unable to read the mARC package version.");
}

function hasVersion(value: unknown): value is { version: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    typeof value.version === "string"
  );
}
