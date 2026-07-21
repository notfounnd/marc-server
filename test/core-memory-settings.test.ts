import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  readWorkspaceSettingsInWorkspace,
  updateWorkspaceSettingsInWorkspace,
  workspaceSettingsPath
} from "../src/core/memory/index.js";
import { readWorkspaceStatus } from "../src/core/workspace.js";
import { tempWorkspace } from "./memory-test-helpers.js";

test("workspace memory settings persist automatic rebuild and embedding batch size per workspace", async () => {
  const first = await tempWorkspace();
  const second = await tempWorkspace();

  assert.equal(
    (await readWorkspaceSettingsInWorkspace(first)).memory.autoRebuild,
    true
  );
  assert.equal(
    (await readWorkspaceSettingsInWorkspace(first)).memory.embeddingBatchSize,
    4
  );
  assert.equal(
    (await readWorkspaceSettingsInWorkspace(first)).memory.searchRetryDepth,
    0
  );

  await updateWorkspaceSettingsInWorkspace(first, {
    memory: { autoRebuild: false, embeddingBatchSize: 8, searchRetryDepth: 2 }
  });

  const settingsPath = workspaceSettingsPath(first);
  const settingsContent = JSON.parse(
    await fs.readFile(settingsPath, "utf8")
  ) as {
    memory?: {
      autoRebuild?: boolean;
      embeddingBatchSize?: number;
      searchRetryDepth?: number;
    };
  };

  assert.equal(path.basename(settingsPath), "marc.config.json");
  assert.equal(path.basename(path.dirname(settingsPath)), ".marc");
  assert.equal(settingsContent.memory?.autoRebuild, false);
  assert.equal(settingsContent.memory?.embeddingBatchSize, 8);
  assert.equal(settingsContent.memory?.searchRetryDepth, 2);
  assert.equal(
    await fileExists(path.join(first.marcPath, "SETTINGS.md")),
    false
  );
  assert.equal(
    (await readWorkspaceSettingsInWorkspace(first)).memory.autoRebuild,
    false
  );
  assert.equal(
    (await readWorkspaceSettingsInWorkspace(first)).memory.embeddingBatchSize,
    8
  );
  assert.equal(
    (await readWorkspaceSettingsInWorkspace(second)).memory.autoRebuild,
    true
  );
});

test("workspace memory settings reject unsupported embedding batch sizes", async () => {
  const info = await tempWorkspace();

  await assert.rejects(
    updateWorkspaceSettingsInWorkspace(info, {
      memory: { embeddingBatchSize: 3 }
    }),
    /even integer from 2 to 16/
  );
});

test("workspace memory settings ignore legacy Markdown settings", async () => {
  const info = await tempWorkspace();
  await fs.writeFile(
    path.join(info.marcPath, "SETTINGS.md"),
    ["<!-- marc-settings", "memory.autoRebuild: false", "-->", ""].join("\n")
  );

  assert.equal(
    (await readWorkspaceSettingsInWorkspace(info)).memory.autoRebuild,
    true
  );
});

test("workspace status includes persisted memory auto rebuild setting", async () => {
  const info = await tempWorkspace();
  await updateWorkspaceSettingsInWorkspace(info, {
    memory: { autoRebuild: false }
  });

  const status = await readWorkspaceStatus(info.rootPath);

  assert.equal(status.modules.memory.autoRebuild, false);
  assert.equal(status.modules.memory.preparing, false);
  assert.equal(status.modules.memory.rebuilding, false);
  assert.equal(status.modules.memory.lastError, null);
});

async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}
