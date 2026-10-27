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

  await updateWorkspaceSettingsInWorkspace(first, {
    memory: { autoRebuild: false, embeddingBatchSize: 8 }
  });

  const settingsPath = workspaceSettingsPath(first);
  const settingsContent = JSON.parse(
    await fs.readFile(settingsPath, "utf8")
  ) as {
    memory?: {
      autoRebuild?: boolean;
      embeddingBatchSize?: number;
    };
  };

  assert.equal(path.basename(settingsPath), "marc.config.json");
  assert.equal(path.basename(path.dirname(settingsPath)), ".marc");
  assert.equal(settingsContent.memory?.autoRebuild, false);
  assert.equal(settingsContent.memory?.embeddingBatchSize, 8);
  assert.equal("searchRetryDepth" in (settingsContent.memory ?? {}), false);
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

test("an old settings file with searchRetryDepth is read without the key and loses it on the next write", async () => {
  const workspace = await tempWorkspace();
  const settingsPath = workspaceSettingsPath(workspace);
  await fs.writeFile(
    settingsPath,
    `${JSON.stringify(
      {
        memory: {
          autoRebuild: false,
          documentSources: [],
          embeddingBatchSize: 8,
          searchRetryDepth: 2
        }
      },
      null,
      2
    )}\n`
  );

  const read = await readWorkspaceSettingsInWorkspace(workspace);
  assert.equal(read.memory.autoRebuild, false);
  assert.equal(read.memory.embeddingBatchSize, 8);
  assert.equal("searchRetryDepth" in read.memory, false);

  await updateWorkspaceSettingsInWorkspace(workspace, {
    memory: { autoRebuild: true }
  });

  const stored = JSON.parse(await fs.readFile(settingsPath, "utf8")) as {
    memory: Record<string, unknown>;
  };
  assert.equal(stored.memory.autoRebuild, true);
  assert.equal(stored.memory.embeddingBatchSize, 8);
  assert.equal("searchRetryDepth" in stored.memory, false);
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

const DOCUMENT_SOURCE_SCENARIOS: Array<{
  name: string;
  entry: unknown;
  expected: unknown[];
}> = [
  {
    name: "a non-object entry is dropped",
    entry: "docs/guide.md",
    expected: []
  },
  {
    name: "an empty path is dropped",
    entry: { path: "", authority: "reference" },
    expected: []
  },
  {
    name: "a non-string path is dropped",
    entry: { path: 3, authority: "reference" },
    expected: []
  },
  {
    name: "an unknown authority is dropped",
    entry: { path: "docs/a.md", authority: "other" },
    expected: []
  },
  {
    name: "a POSIX absolute path is dropped",
    entry: { path: "/etc/policy.md", authority: "normative" },
    expected: []
  },
  {
    name: "a drive-letter path is dropped",
    entry: { path: "C:/policy.md", authority: "normative" },
    expected: []
  },
  {
    name: "a UNC path is dropped",
    entry: { path: "\\\\server\\share\\policy.md", authority: "normative" },
    expected: []
  },
  {
    name: "a parent escape is dropped",
    entry: { path: "../outside.md", authority: "reference" },
    expected: []
  },
  {
    name: "the .marc directory is dropped",
    entry: { path: ".marc/RULES.md", authority: "normative" },
    expected: []
  },
  {
    name: "a node_modules segment is dropped",
    entry: { path: "pkg/node_modules/x.md", authority: "reference" },
    expected: []
  },
  {
    name: "a normative relative entry is kept",
    entry: { path: "docs/policy.md", authority: "normative" },
    expected: [{ path: "docs/policy.md", authority: "normative" }]
  },
  {
    name: "a reference relative entry is kept",
    entry: { path: "docs/guide.md", authority: "reference" },
    expected: [{ path: "docs/guide.md", authority: "reference" }]
  }
];

for (const scenario of DOCUMENT_SOURCE_SCENARIOS) {
  test(`document source normalization: ${scenario.name}`, async () => {
    const info = await tempWorkspace();
    await fs.writeFile(
      workspaceSettingsPath(info),
      JSON.stringify({ memory: { documentSources: [scenario.entry] } })
    );

    const settings = await readWorkspaceSettingsInWorkspace(info);

    assert.deepEqual(settings.memory.documentSources, scenario.expected);
  });
}

test("document sources default to an empty list and a non-array value becomes empty", async () => {
  const missing = await tempWorkspace();
  const invalid = await tempWorkspace();
  await fs.writeFile(
    workspaceSettingsPath(invalid),
    JSON.stringify({ memory: { documentSources: "docs/policy.md" } })
  );

  assert.deepEqual(
    (await readWorkspaceSettingsInWorkspace(missing)).memory.documentSources,
    []
  );
  assert.deepEqual(
    (await readWorkspaceSettingsInWorkspace(invalid)).memory.documentSources,
    []
  );
});

test("updating other memory settings preserves the current document sources", async () => {
  const info = await tempWorkspace();
  const documentSources = [{ path: "docs/policy.md", authority: "normative" }];
  await fs.writeFile(
    workspaceSettingsPath(info),
    JSON.stringify({ memory: { documentSources } })
  );

  const updated = await updateWorkspaceSettingsInWorkspace(info, {
    memory: { autoRebuild: false, embeddingBatchSize: 6 }
  });
  const stored = JSON.parse(
    await fs.readFile(workspaceSettingsPath(info), "utf8")
  ) as { memory: { documentSources: unknown } };

  assert.equal(updated.memory.autoRebuild, false);
  assert.deepEqual(updated.memory.documentSources, documentSources);
  assert.deepEqual(stored.memory.documentSources, documentSources);
});

async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}
