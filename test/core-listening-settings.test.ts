import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  readWorkspaceSettingsInWorkspace,
  updateWorkspaceSettingsInWorkspace,
  workspaceSettingsPath
} from "../src/core/memory/index.js";
import { readListeningDefaultSync } from "../src/core/workspace-settings-file.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import { tempWorkspace } from "./memory-test-helpers.js";

const MEMORY = {
  autoRebuild: false,
  embeddingBatchSize: 8,
  documentSources: []
};
const ACTIVATION = { cyclesPerStage: 5, turnTimeoutMinutes: 90 };

function render(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

async function writeSettings(info: WorkspaceInfo, content: string) {
  await fs.writeFile(workspaceSettingsPath(info), content, "utf8");
}

async function readSettings(info: WorkspaceInfo): Promise<string> {
  return fs.readFile(workspaceSettingsPath(info), "utf8");
}

test("the listening default is off before any save", async () => {
  const info = await tempWorkspace();
  assert.deepEqual((await readWorkspaceSettingsInWorkspace(info)).listening, {
    defaultOn: false
  });
  assert.equal(readListeningDefaultSync(info.rootPath), "off");
});

test("a settings file that sets the listening default to true reads as on", async () => {
  const info = await tempWorkspace();
  await writeSettings(info, render({ listening: { defaultOn: true } }));
  assert.equal(
    (await readWorkspaceSettingsInWorkspace(info)).listening.defaultOn,
    true
  );
  assert.equal(readListeningDefaultSync(info.rootPath), "on");
});

const INVALID_LISTENING_FILES: Array<{ name: string; content: string }> = [
  {
    name: "a string value",
    content: render({ listening: { defaultOn: "yes" } })
  },
  {
    name: "a number value",
    content: render({ listening: { defaultOn: 1 } })
  },
  {
    name: "a scalar section",
    content: render({ listening: true })
  },
  {
    name: "a list section",
    content: render({ listening: [{ defaultOn: true }] })
  },
  {
    name: "unreadable JSON",
    content: "{ not json"
  }
];

for (const row of INVALID_LISTENING_FILES) {
  test(`an invalid listening value reads as the default: ${row.name}`, async () => {
    const info = await tempWorkspace();
    await writeSettings(info, row.content);
    assert.equal(readListeningDefaultSync(info.rootPath), "off");
  });
}

test("an invalid listening value reads as false through the settings read", async () => {
  const info = await tempWorkspace();
  await writeSettings(info, render({ listening: { defaultOn: "yes" } }));
  assert.equal(
    (await readWorkspaceSettingsInWorkspace(info)).listening.defaultOn,
    false
  );
});

test("saving the listening default persists it per workspace and turns it off again", async () => {
  const first = await tempWorkspace();
  const second = await tempWorkspace();

  await updateWorkspaceSettingsInWorkspace(first, {
    listening: { defaultOn: true }
  });
  assert.equal(
    (await readWorkspaceSettingsInWorkspace(first)).listening.defaultOn,
    true
  );
  assert.equal(readListeningDefaultSync(first.rootPath), "on");
  assert.equal(
    (await readWorkspaceSettingsInWorkspace(second)).listening.defaultOn,
    false
  );

  await updateWorkspaceSettingsInWorkspace(first, {
    listening: { defaultOn: false }
  });
  assert.equal(readListeningDefaultSync(first.rootPath), "off");
});

test("saving the listening default keeps the memory and activation sections byte for byte", async () => {
  const info = await tempWorkspace();
  const before = render({ memory: MEMORY, activation: ACTIVATION });
  await writeSettings(info, before);

  await updateWorkspaceSettingsInWorkspace(info, {
    listening: { defaultOn: true }
  });

  assert.equal(
    await readSettings(info),
    render({
      memory: MEMORY,
      activation: ACTIVATION,
      listening: { defaultOn: true }
    })
  );
});

test("saving memory keeps the listening section byte for byte", async () => {
  const info = await tempWorkspace();
  const listening = { defaultOn: true, kept: "value" };
  await writeSettings(
    info,
    render({ memory: MEMORY, activation: ACTIVATION, listening })
  );

  await updateWorkspaceSettingsInWorkspace(info, {
    memory: { autoRebuild: true }
  });

  assert.equal(
    await readSettings(info),
    render({
      memory: { ...MEMORY, autoRebuild: true },
      activation: ACTIVATION,
      listening
    })
  );
});

test("saving activation keeps the listening default on", async () => {
  const info = await tempWorkspace();
  await updateWorkspaceSettingsInWorkspace(info, {
    listening: { defaultOn: true }
  });

  await updateWorkspaceSettingsInWorkspace(info, {
    activation: { cyclesPerStage: 4 }
  });

  assert.equal(readListeningDefaultSync(info.rootPath), "on");
  assert.equal(
    (await readWorkspaceSettingsInWorkspace(info)).activation.cyclesPerStage,
    4
  );
});
