import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { McpTestProcess, repositoryFileExists } from "./mcp-process.js";

const protocolMetadata = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {}
};
for (const entry of ["source", "dist"] as const) {
  test(
    `${entry} stdio serves modern discovery, tool catalog, and EOF cleanup`,
    {
      skip: entry === "dist" && !(await repositoryFileExists("dist/cli.js"))
    },
    async (t) => {
      const workspace = await fs.mkdtemp(
        path.join(os.tmpdir(), "marc-mcp-wire-")
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

      await server.send({
        jsonrpc: "2.0",
        id: 1,
        method: "server/discover",
        params: { _meta: protocolMetadata }
      });
      const discovery = await server.readMessage();
      assert.equal("error" in discovery, false);
      assert.ok("result" in discovery);
      const discoveryResult = discovery.result as {
        supportedVersions: string[];
        capabilities: { tools?: unknown };
        resultType: string;
        ttlMs: number;
        cacheScope: string;
        _meta: Record<string, { name: string; version: string }>;
      };
      assert.deepEqual(discoveryResult.supportedVersions, ["2026-07-28"]);
      assert.ok(discoveryResult.capabilities.tools);
      assert.equal(discoveryResult.resultType, "complete");
      assert.equal(discoveryResult.ttlMs, 0);
      assert.equal(discoveryResult.cacheScope, "private");
      const packageInfo = JSON.parse(
        await fs.readFile(path.join(process.cwd(), "package.json"), "utf8")
      ) as { version: string };
      const serverInfo =
        discoveryResult._meta["io.modelcontextprotocol/serverInfo"];
      assert.equal(serverInfo.name, "marc");
      assert.equal(serverInfo.version, packageInfo.version);

      await server.send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: { _meta: protocolMetadata }
      });
      const listing = await server.readMessage();
      assert.ok("result" in listing);
      const listingResult = listing.result as {
        tools: Array<{
          name: string;
          inputSchema: { properties?: Record<string, unknown> };
        }>;
        resultType: string;
        ttlMs: number;
        cacheScope: string;
      };
      assert.equal(listingResult.tools.length, 24);
      assert.equal(listingResult.resultType, "complete");
      assert.equal(listingResult.ttlMs, 0);
      assert.equal(listingResult.cacheScope, "private");
      const ungatedTools = new Set([
        "marc_helper",
        "workspace_bootstrap",
        "workspace_update_recommendations"
      ]);
      assert.ok(
        listingResult.tools.every(
          (tool) =>
            Object.hasOwn(
              tool.inputSchema.properties ?? {},
              "bootstrapConfirmed"
            ) === !ungatedTools.has(tool.name)
        )
      );

      const exit = await server.closeProcess();
      assert.equal(exit.code, 0, server.stderr);
    }
  );
}

type HeartbeatCloseStrategy = {
  name: string;
  close: (server: McpTestProcess) => Promise<void>;
};

const heartbeatCloseStrategies: HeartbeatCloseStrategy[] = [
  {
    name: "EOF",
    close: async (server) => {
      const exit = await server.closeProcess();
      assert.equal(exit.code, 0, server.stderr);
    }
  },
  {
    name: "stdout error",
    close: async (server) => {
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
    }
  }
];

for (const strategy of heartbeatCloseStrategies) {
  test(`${strategy.name} waits for heartbeat lease deletion`, async (t) => {
    const token = "mcp-test-daemon-token";
    const requests: Array<{
      method?: string;
      path?: string;
      authorization?: string;
    }> = [];
    let resolveRenew: () => void = () => undefined;
    const renewed = new Promise<void>((resolve) => {
      resolveRenew = resolve;
    });
    const daemon = http.createServer((request, response) => {
      requests.push({
        method: request.method,
        path: request.url,
        authorization: request.headers.authorization
      });
      request.resume();
      response.writeHead(204);
      response.end();
      if (request.method !== "PUT") return;
      resolveRenew();
    });
    const workspace = await fs.mkdtemp(
      path.join(os.tmpdir(), `marc-mcp-heartbeat-${strategy.name}-`)
    );
    const serverRef: { current?: McpTestProcess } = {};
    t.after(async () => {
      try {
        const process = serverRef.current;
        if (!process) return;
        const exit = await process.closeProcess();
        assert.equal(exit.code, 0, process.stderr);
        await process.waitForExit();
      } finally {
        await new Promise<void>((resolve) => daemon.close(() => resolve()));
        await fs.rm(workspace, { recursive: true, force: true });
      }
    });

    daemon.listen(0, "127.0.0.1");
    await once(daemon, "listening");
    const address = daemon.address();
    if (!address || typeof address === "string") {
      throw new Error("Fake daemon did not bind to a TCP port.");
    }
    const runningServer = new McpTestProcess("source", workspace, {
      MARC_DAEMON_URL: `http://127.0.0.1:${address.port}`,
      MARC_TOKEN: token
    });
    serverRef.current = runningServer;
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        renewed,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new Error("Fake daemon did not receive the initial lease.")
              ),
            5_000
          );
        })
      ]);
    } finally {
      clearTimeout(timeout);
    }

    await strategy.close(runningServer);
    assert.ok(requests.some((request) => request.method === "DELETE"));
    assert.ok(
      requests.every((request) => request.authorization === `Bearer ${token}`)
    );
    assert.ok(
      requests.every((request) => request.path?.startsWith("/api/leases/mcp-"))
    );
  });
}
