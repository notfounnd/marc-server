import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import {
  Client,
  type JSONRPCMessage,
  type Transport
} from "@modelcontextprotocol/client";

type ExitResult = { code: number | null; signal: NodeJS.Signals | null };

export class McpTestProcess implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  readonly child: ChildProcessWithoutNullStreams;
  private readonly lines: readline.Interface;
  private readonly exit: Promise<ExitResult>;
  private readonly queued: JSONRPCMessage[] = [];
  private readonly readers: Array<(message: JSONRPCMessage) => void> = [];
  private closePromise?: Promise<ExitResult>;
  private errorText = "";

  constructor(
    entry: "source" | "dist",
    workspace: string,
    environment: NodeJS.ProcessEnv = {}
  ) {
    const env = { ...process.env };
    delete env.MARC_DAEMON_URL;
    delete env.MARC_TOKEN;
    Object.assign(env, environment);
    const commandArgs =
      entry === "source"
        ? ["--import", "tsx", "src/cli.ts", "mcp"]
        : ["dist/cli.js", "mcp"];
    this.child = spawn(
      process.execPath,
      [...commandArgs, "--workspace", workspace],
      {
        cwd: process.cwd(),
        env,
        stdio: ["pipe", "pipe", "pipe"]
      }
    );
    this.exit = once(this.child, "exit").then(([code, signal]) => {
      this.onclose?.();
      return {
        code: code as number | null,
        signal: signal as NodeJS.Signals | null
      };
    });
    this.lines = readline.createInterface({ input: this.child.stdout });
    this.lines.on("line", (line) => this.receiveLine(line));
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      this.errorText = (this.errorText + chunk).slice(-4_000);
    });
    this.child.on("error", (error) => this.onerror?.(error));
  }

  async start(): Promise<void> {}

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.child.stdin.destroyed || this.child.stdin.writableEnded) {
      throw new Error("MCP test process stdin is closed.");
    }
    await new Promise<void>((resolve, reject) => {
      this.child.stdin.write(`${JSON.stringify(message)}\n`, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  async readMessage(timeoutMs = 5_000): Promise<JSONRPCMessage> {
    const queued = this.queued.shift();
    if (queued) return queued;
    let timer: NodeJS.Timeout | undefined;
    const response = new Promise<JSONRPCMessage>((resolve) => {
      this.readers.push(resolve);
    });
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`No MCP response. stderr: ${this.errorText}`)),
        timeoutMs
      );
    });
    return Promise.race([response, timeout]).finally(() => clearTimeout(timer));
  }

  async close(): Promise<void> {
    await this.closeProcess();
  }

  async closeProcess(timeoutMs = 5_000): Promise<ExitResult> {
    if (this.closePromise) return this.closePromise;
    this.closePromise = this.gracefulCloseAfterEof(timeoutMs);
    return this.closePromise;
  }

  async waitForExit(timeoutMs = 5_000): Promise<ExitResult> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(new Error(`MCP child did not exit within ${timeoutMs} ms.`)),
        timeoutMs
      );
    });
    try {
      return await Promise.race([this.exit, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  get stderr(): string {
    return this.errorText;
  }

  private async gracefulCloseAfterEof(timeoutMs: number): Promise<ExitResult> {
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.child.stdin.end();
    }
    let result: ExitResult;
    try {
      result = await this.waitForExit(timeoutMs);
    } catch (error) {
      this.child.kill();
      result = await this.exit;
      this.lines.close();
      throw new Error(`${String(error)} Child exited after forced cleanup.`, {
        cause: error
      });
    }
    this.lines.close();
    return result;
  }

  private receiveLine(line: string): void {
    if (!line.trim()) return;
    let message: JSONRPCMessage;
    try {
      message = JSON.parse(line) as JSONRPCMessage;
    } catch (error) {
      this.onerror?.(
        new Error("MCP child wrote invalid JSON to stdout.", { cause: error })
      );
      return;
    }
    if (this.onmessage) {
      this.onmessage(message);
      return;
    }
    const resolve = this.readers.shift();
    if (!resolve) {
      this.queued.push(message);
      return;
    }
    resolve(message);
  }
}

export async function startMcpTestClient(entry: "source" | "dist" = "source") {
  const workspace = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-mcp-client-")
  );
  const server = new McpTestProcess(entry, workspace);
  const client = new Client(
    { name: "mcp-migration-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } }
  );
  try {
    await client.connect(server);
  } catch (error) {
    let cleanupError: unknown;
    try {
      await server.closeProcess();
    } catch (closeError) {
      cleanupError = closeError;
    } finally {
      await server.waitForExit();
      await fs.rm(workspace, { recursive: true, force: true });
    }
    throw new Error("Could not connect MCP test client.", {
      cause: cleanupError ?? error
    });
  }
  let closePromise: Promise<void> | undefined;
  return {
    client,
    server,
    workspace,
    close(): Promise<void> {
      if (closePromise) return closePromise;
      closePromise = closeMcpTestClient(client, server, workspace);
      return closePromise;
    }
  };
}

export function toolJson<T>(result: {
  content: Array<{ type: string; text?: string }>;
}): T {
  return JSON.parse(toolText(result)) as T;
}

export function toolText(result: {
  content: Array<{ type: string; text?: string }>;
}): string {
  const block = result.content.find((item) => item.type === "text");
  if (!block || typeof block.text !== "string") {
    throw new Error("MCP tool result did not contain text content.");
  }
  return block.text;
}

export async function repositoryFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(path.join(process.cwd(), filePath));
    return true;
  } catch {
    return false;
  }
}

async function closeMcpTestClient(
  client: Client,
  server: McpTestProcess,
  workspace: string
): Promise<void> {
  let cleanupError: unknown;
  try {
    await client.close();
  } catch (error) {
    cleanupError = error;
  }
  try {
    const result = await server.closeProcess();
    if (result.code !== 0) {
      cleanupError ??= new Error(
        `MCP child exited with code ${String(result.code)}: ${server.stderr}`
      );
    }
  } catch (error) {
    cleanupError ??= error;
  } finally {
    await server.waitForExit();
    await fs.rm(workspace, { recursive: true, force: true });
  }
  if (cleanupError) throw cleanupError;
}
