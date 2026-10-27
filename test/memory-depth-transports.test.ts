import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { tempWorkspace } from "./memory-test-helpers.js";
import { startMcpTestClient, toolJson } from "./mcp-process.js";

const LAYER_EXPLANATION = "Depth 3 is not available";

test("the MCP memory_recall tool rejects depth 3 with the layer explanation and accepts 0 to 2", async (t) => {
  const session = await startMcpTestClient();
  t.after(() => session.close());
  await session.client.callTool({ name: "workspace_bootstrap", arguments: {} });

  const rejected = await session.client.callTool({
    name: "memory_recall",
    arguments: { query: "test query", depth: 3, bootstrapConfirmed: true }
  });
  assert.equal(rejected.isError, true);
  assert.match(JSON.stringify(rejected), /counts corpus layers/);
  assert.match(JSON.stringify(rejected), new RegExp(LAYER_EXPLANATION));

  for (const depth of [0, 1, 2]) {
    const accepted = await session.client.callTool({
      name: "memory_recall",
      arguments: { query: "test query", depth, bootstrapConfirmed: true }
    });
    assert.notEqual(accepted.isError, true, `depth ${depth} must be accepted`);
    assert.equal(
      toolJson<{ result: { indexStatus: { status: string } } }>(accepted).result
        .indexStatus.status,
      "model_missing"
    );
  }
});

test("the marc CLI rejects memory recall with depth 3 and accepts depth 2", async () => {
  const info = await tempWorkspace();
  const run = (depth: string) =>
    new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      execFile(
        process.execPath,
        [
          "--import",
          "tsx",
          "src/cli.ts",
          "memory",
          "recall",
          "--query",
          "test query",
          "--depth",
          depth,
          "--workspace",
          info.rootPath
        ],
        { cwd: process.cwd(), timeout: 120000 },
        (error, stdout, stderr) => {
          resolve({
            code: Number(error?.code ?? 0),
            stdout,
            stderr
          });
        }
      );
    });

  const rejected = await run("3");
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.stderr, new RegExp(LAYER_EXPLANATION));

  const accepted = await run("2");
  assert.equal(accepted.code, 0, accepted.stderr);
  assert.match(accepted.stdout, /model_missing/);
});
