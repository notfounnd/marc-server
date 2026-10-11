import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { JSONRPCMessage } from "@modelcontextprotocol/client";
import { McpTestProcess, repositoryFileExists } from "./mcp-process.js";

const supportedMetadata = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {}
};
const unsupportedMetadata = {
  "io.modelcontextprotocol/protocolVersion": "2025-11-25",
  "io.modelcontextprotocol/clientCapabilities": {}
};
const protocolVersionGuidance =
  "mARC supports MCP 2026-07-28 only. Check your agent harness documentation for protocol support and any required configuration or upgrade.";

for (const entry of ["source", "dist"] as const) {
  for (const legacyFirst of [false, true]) {
    test(
      `${entry} rejects unsupported revisions on every request after discovery${legacyFirst ? " after legacy rejection" : ""}`,
      {
        skip: entry === "dist" && !(await repositoryFileExists("dist/cli.js"))
      },
      async (t) => {
        const workspace = await fs.mkdtemp(
          path.join(os.tmpdir(), "marc-mcp-version-pin-")
        );
        const server = new McpTestProcess(entry, workspace);
        t.after(async () => {
          try {
            const exit = await server.closeProcess();
            assert.equal(exit.code, 0, server.stderr);
          } finally {
            await server.waitForExit();
            await fs.rm(workspace, { recursive: true, force: true });
          }
        });

        let requestId = 1;
        if (legacyFirst) {
          await server.send({
            jsonrpc: "2.0",
            id: requestId,
            method: "initialize",
            params: {
              protocolVersion: "2025-06-18",
              capabilities: {},
              clientInfo: { name: "legacy-test", version: "1.0.0" }
            }
          });
          const legacy = await server.readMessage();
          assertProtocolVersionMismatch(legacy, requestId, {
            supported: ["2026-07-28"],
            requested: "2025-06-18"
          });
          requestId += 1;
        }

        await server.send({
          jsonrpc: "2.0",
          id: requestId,
          method: "server/discover",
          params: { _meta: supportedMetadata }
        });
        const discovery = await server.readMessage();
        assert.ok("id" in discovery);
        assert.equal(discovery.id, requestId);
        assert.ok("result" in discovery);
        requestId += 1;

        await server.send({
          jsonrpc: "2.0",
          id: requestId,
          method: "server/discover",
          params: {}
        });
        const missingVersion = await server.readMessage();
        assertProtocolVersionMismatch(missingVersion, requestId, {
          supported: ["2026-07-28"]
        });
        requestId += 1;

        await server.send({
          jsonrpc: "2.0",
          id: requestId,
          method: "server/discover",
          params: { _meta: unsupportedMetadata }
        });
        const unsupportedDiscovery = await server.readMessage();
        assertProtocolVersionMismatch(unsupportedDiscovery, requestId, {
          supported: ["2026-07-28"],
          requested: "2025-11-25"
        });
        requestId += 1;

        await server.send({
          jsonrpc: "2.0",
          id: requestId,
          method: "tools/list",
          params: { _meta: supportedMetadata }
        });
        const supportedListing = await server.readMessage();
        assert.ok("id" in supportedListing);
        assert.equal(supportedListing.id, requestId);
        assert.ok("result" in supportedListing);
        assert.ok(Array.isArray(supportedListing.result.tools));
        assert.equal(supportedListing.result.tools.length, 24);
        requestId += 1;

        await server.send({
          jsonrpc: "2.0",
          id: requestId,
          method: "tools/list",
          params: {}
        });
        const missingMetadata = await server.readMessage();
        assert.ok("id" in missingMetadata);
        assert.equal(missingMetadata.id, requestId);
        assert.ok("error" in missingMetadata);
        assert.equal(missingMetadata.error.code, -32602);
        assertNoProtocolVersionGuidance(missingMetadata);
        requestId += 1;

        await server.send({
          jsonrpc: "2.0",
          id: requestId,
          method: "tools/list",
          params: {
            _meta: {
              "io.modelcontextprotocol/protocolVersion": "2025-11-25",
              "io.modelcontextprotocol/clientCapabilities": "invalid"
            }
          }
        });
        const malformedMetadata = await server.readMessage();
        assert.ok("id" in malformedMetadata);
        assert.equal(malformedMetadata.id, requestId);
        assert.ok("error" in malformedMetadata);
        assert.equal(malformedMetadata.error.code, -32602);
        requestId += 1;

        await server.send({
          jsonrpc: "2.0",
          id: requestId,
          method: "tools/list",
          params: { _meta: unsupportedMetadata }
        });
        const listing = await server.readMessage();
        assertProtocolVersionMismatch(listing, requestId, {
          supported: ["2026-07-28"],
          requested: "2025-11-25"
        });
        requestId += 1;

        await server.send({
          jsonrpc: "2.0",
          id: requestId,
          method: "tools/call",
          params: {
            name: "thread_create",
            arguments: {
              title: "Unsupported request must not create this thread.",
              bootstrapConfirmed: true
            },
            _meta: unsupportedMetadata
          }
        });
        const call = await server.readMessage();
        assertProtocolVersionMismatch(call, requestId, {
          supported: ["2026-07-28"],
          requested: "2025-11-25"
        });
        requestId += 1;

        await server.send({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "thread_create",
            arguments: {
              title: "Unsupported notification must not create this thread.",
              bootstrapConfirmed: true
            },
            _meta: unsupportedMetadata
          }
        });

        await server.send({
          jsonrpc: "2.0",
          id: requestId,
          method: "tools/call",
          params: {
            name: "thread_list",
            arguments: { status: "all", bootstrapConfirmed: true },
            _meta: { ...supportedMetadata }
          }
        });
        const verified = await server.readMessage();
        assert.ok("id" in verified);
        assert.equal(verified.id, requestId);
        assert.ok("result" in verified);
        assert.ok(Array.isArray(verified.result.content));
        const text = verified.result.content.find(isTextContent);
        assert.ok(text);
        assert.deepEqual(JSON.parse(text.text).result, []);
      }
    );
  }
}

function assertProtocolVersionMismatch(
  response: JSONRPCMessage,
  expectedId: number,
  expectedData: unknown
): void {
  assert.ok("id" in response);
  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, expectedId);
  assert.ok("error" in response);
  assert.equal(response.error.code, -32022);
  assert.ok(response.error.message.endsWith(` ${protocolVersionGuidance}`));
  assert.equal(
    response.error.message.split(protocolVersionGuidance).length - 1,
    1
  );
  assert.deepEqual(response.error.data, expectedData);
}

function assertNoProtocolVersionGuidance(response: JSONRPCMessage): void {
  assert.ok("error" in response);
  assert.equal(response.error.message.includes(protocolVersionGuidance), false);
}

function isTextContent(
  value: unknown
): value is { type: string; text: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "text" &&
    "text" in value &&
    typeof value.text === "string"
  );
}
