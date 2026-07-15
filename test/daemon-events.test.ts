import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";
import test from "node:test";
import { UiEventBus } from "../src/daemon/events.js";
import { tempWorkspace } from "./memory-test-helpers.js";

class FakeResponse extends EventEmitter {
  readonly writes: string[] = [];

  writeHead(): this {
    return this;
  }

  write(chunk: string): boolean {
    this.writes.push(chunk);
    return true;
  }
}

async function waitFor(assertion: () => boolean): Promise<void> {
  const deadline = Date.now() + 500;
  while (Date.now() < deadline) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("Timed out waiting for event bus state.");
}

function workspaceChangedCount(response: FakeResponse): number {
  return response.writes.filter((write) => write.includes("workspace-changed"))
    .length;
}

test("does not poll memory rebuild state without UI clients", async () => {
  const info = await tempWorkspace();
  let checks = 0;
  const events = new UiEventBus(undefined, {
    memoryRebuildIntervalMs: 5,
    readMemoryRebuildActive: async () => {
      checks += 1;
      return true;
    }
  });
  const missingMarcPath = path.join(info.marcPath, "missing-workspace");

  try {
    await events.watchWorkspace({ ...info, marcPath: missingMarcPath });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(checks, 0);
  } finally {
    events.close();
  }
});

test("sends workspace changes only for memory rebuild state transitions", async () => {
  const info = await tempWorkspace();
  let rebuilding = false;
  const events = new UiEventBus(undefined, {
    memoryRebuildIntervalMs: 5,
    readMemoryRebuildActive: async () => rebuilding
  });
  const response = new FakeResponse();
  const missingMarcPath = path.join(info.marcPath, "missing-workspace");

  try {
    await events.watchWorkspace({ ...info, marcPath: missingMarcPath });
    events.connect(response as never);
    await new Promise((resolve) => setTimeout(resolve, 20));
    response.writes.length = 0;

    rebuilding = true;
    await waitFor(() => workspaceChangedCount(response) === 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(workspaceChangedCount(response), 1);

    rebuilding = false;
    await waitFor(() => workspaceChangedCount(response) === 2);
  } finally {
    events.close();
  }
});
