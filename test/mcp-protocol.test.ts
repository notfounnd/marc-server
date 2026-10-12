import assert from "node:assert/strict";
import { Client, type JSONRPCMessage } from "@modelcontextprotocol/client";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  McpTestProcess,
  repositoryFileExists,
  startMcpTestClient,
  toolJson
} from "./mcp-process.js";

const protocolMetadata = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {}
};
const protocolVersionGuidance =
  "mARC supports MCP 2026-07-28 only. Check your agent harness documentation for protocol support and any required configuration or upgrade.";
const repositoryRoot = process.cwd();

assert.ok(await repositoryFileExists("dist/cli.js"));

test("modern tools/list does not require a prior discovery request", async (t) => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "marc-mcp-list-"));
  const server = new McpTestProcess("source", workspace);
  t.after(async () => {
    try {
      const exit = await server.closeProcess();
      assert.equal(exit.code, 0, server.stderr);
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  await server.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: { _meta: protocolMetadata }
  });
  const listing = await server.readMessage();
  assert.ok("result" in listing);
  const result = listing.result as { tools: unknown[] };
  assert.equal(result.tools.length, 25);
});

test("discovery reports missing and malformed metadata and pins the supported revision", async (t) => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "marc-mcp-meta-"));
  const server = new McpTestProcess("source", workspace);
  t.after(async () => {
    try {
      const exit = await server.closeProcess();
      assert.equal(exit.code, 0, server.stderr);
    } finally {
      await server.waitForExit();
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  const sendDiscovery = async (id: number, params: Record<string, unknown>) => {
    await server.send({
      jsonrpc: "2.0",
      id,
      method: "server/discover",
      params
    });
    return server.readMessage();
  };
  const absent = await sendDiscovery(1, {});
  assert.ok("error" in absent);
  assert.ok("id" in absent);
  assert.equal(absent.id, 1);
  assert.equal(absent.jsonrpc, "2.0");
  assert.equal(absent.error.code, -32022);
  assertProtocolVersionGuidance(absent);
  const absentData = absent.error.data as { supported?: string[] };
  assert.deepEqual(absentData.supported, ["2026-07-28"]);

  const missingCapabilities = await sendDiscovery(2, {
    _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" }
  });
  assert.ok("error" in missingCapabilities);
  assert.equal(missingCapabilities.error.code, -32602);
  assertNoProtocolVersionGuidance(missingCapabilities);
  const missingData = missingCapabilities.error.data as {
    envelope?: { key?: string };
  };
  assert.equal(
    missingData.envelope?.key,
    "io.modelcontextprotocol/clientCapabilities"
  );

  const malformedCapabilities = await sendDiscovery(3, {
    _meta: {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": "invalid"
    }
  });
  assert.ok("error" in malformedCapabilities);
  assert.equal(malformedCapabilities.error.code, -32602);
  assertNoProtocolVersionGuidance(malformedCapabilities);

  const unsupported = await sendDiscovery(4, {
    _meta: {
      "io.modelcontextprotocol/protocolVersion": "2025-11-25",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  });
  assert.ok("error" in unsupported);
  assert.equal(unsupported.error.code, -32022);
  assertProtocolVersionGuidance(unsupported);
  const unsupportedData = unsupported.error.data as {
    supported?: string[];
    requested?: string;
  };
  assert.deepEqual(unsupportedData.supported, ["2026-07-28"]);
  assert.equal(unsupportedData.requested, "2025-11-25");
});

test("unknown tools use JSON-RPC errors while invalid and domain calls use isError", async (t) => {
  const workspace = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-mcp-errors-")
  );
  const server = new McpTestProcess("source", workspace);
  t.after(async () => {
    try {
      const exit = await server.closeProcess();
      assert.equal(exit.code, 0, server.stderr);
    } finally {
      await server.waitForExit();
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });
  const call = async (
    id: number,
    name: string,
    args: Record<string, unknown>
  ) => {
    await server.send({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args, _meta: protocolMetadata }
    });
    return server.readMessage();
  };

  const unknown = await call(1, "unknown_tool", {});
  assert.ok("error" in unknown);
  assert.equal(unknown.error.code, -32602);
  assertNoProtocolVersionGuidance(unknown);

  const invalidInput = await call(2, "agent_register", {});
  assert.ok("result" in invalidInput);
  assert.equal(invalidInput.result.isError, true);

  const domainFailure = await call(3, "agent_read_profile", {
    agentId: "missing-profile",
    bootstrapConfirmed: true
  });
  assert.ok("result" in domainFailure);
  assert.equal(domainFailure.result.isError, true);
  const domainContent = domainFailure.result.content as Array<{ text: string }>;
  assert.match(domainContent[0].text, /internal_error/);
});

function assertProtocolVersionGuidance(message: JSONRPCMessage): void {
  assert.ok("error" in message);
  assert.ok(message.error.message.endsWith(` ${protocolVersionGuidance}`));
  assert.equal(
    message.error.message.split(protocolVersionGuidance).length - 1,
    1
  );
}

function assertNoProtocolVersionGuidance(message: JSONRPCMessage): void {
  assert.ok("error" in message);
  assert.equal(message.error.message.includes(protocolVersionGuidance), false);
}

test("unexpected stdout failure closes stdio and releases the server process", async (t) => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "marc-mcp-close-"));
  const server = new McpTestProcess("source", workspace);
  t.after(async () => {
    try {
      const exit = await server.closeProcess();
      assert.equal(exit.code, 0, server.stderr);
    } finally {
      await server.waitForExit();
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  server.child.stdout.destroy();
  await server
    .send({
      jsonrpc: "2.0",
      id: 1,
      method: "server/discover",
      params: { _meta: protocolMetadata }
    })
    .catch(() => undefined);
  const exit = await server.waitForExit();
  assert.equal(exit.code, 0, server.stderr);
});

test("the process-wide fixed-window tool limiter rejects the 61st fast call", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  const results = await Promise.all(
    Array.from({ length: 61 }, () =>
      session.client.callTool({
        name: "marc_helper",
        arguments: { topic: "overview" }
      })
    )
  );
  const limited = results.filter((result) => result.isError === true);
  assert.equal(limited.length, 1);
  const body = toolJson<{
    error: { code: string; details: { retryAfterMs: number } };
  }>(limited[0]);
  assert.equal(body.error.code, "rate_limited");
  assert.ok(body.error.details.retryAfterMs > 0);
  assert.ok(body.error.details.retryAfterMs <= 1_000);
});

for (const entry of ["source", "dist"] as const) {
  test(`${entry} public Client negotiates 2026-07-28 and receives safe tool errors`, async (t) => {
    const workspace = await fs.mkdtemp(
      path.join(os.tmpdir(), `marc-mcp-client-${entry}-`)
    );
    const server = new McpTestProcess(entry, workspace);
    const client = new Client(
      { name: "mcp-migration-test", version: "1.0.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } }
    );
    t.after(async () => {
      try {
        await client.close();
        const exit = await server.closeProcess();
        assert.equal(exit.code, 0, server.stderr);
      } finally {
        await server.waitForExit();
        await fs.rm(workspace, { recursive: true, force: true });
      }
    });

    await client.connect(server);
    assert.equal(client.getProtocolEra(), "modern");
    const serverInfo = client.getServerVersion();
    const packageInfo = JSON.parse(
      await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8")
    ) as { version: string };
    assert.ok(serverInfo);
    assert.equal(serverInfo.name, "marc");
    assert.equal(serverInfo.version, packageInfo.version);
    const catalog = await client.listTools();
    assert.equal(catalog.tools.length, 25);
    const result = await client.callTool({
      name: "thread_list",
      arguments: {}
    });
    assert.equal(result.isError, true);
    const body = result.content[0];
    assert.equal(body.type, "text");
    assert.equal(JSON.parse(body.text).error.code, "bootstrap_required");
  });
}

test("legacy opening is rejected and the same stdio connection can open modern", async (t) => {
  const workspace = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-mcp-legacy-")
  );
  const server = new McpTestProcess("source", workspace);
  t.after(async () => {
    try {
      const exit = await server.closeProcess();
      assert.equal(exit.code, 0, server.stderr);
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  await server.send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "legacy-test", version: "1.0.0" }
    }
  });
  const legacy = await server.readMessage();
  assert.ok("error" in legacy);

  await server.send({
    jsonrpc: "2.0",
    id: 2,
    method: "server/discover",
    params: { _meta: protocolMetadata }
  });
  const modern = await server.readMessage();
  assert.ok("result" in modern);
  const result = modern.result as { supportedVersions: string[] };
  assert.deepEqual(result.supportedVersions, ["2026-07-28"]);
});
