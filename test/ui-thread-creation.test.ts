import assert from "node:assert/strict";
import test from "node:test";
import {
  createThreadWorkflow,
  reconcileCreatedThreads
} from "../src/ui/thread-creation.js";
import type { Thread, ThreadPayload } from "../src/ui/types.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function threadInfo(): Thread {
  return {
    id: "launch-notes-1234abcd",
    title: "Launch Notes",
    path: ".marc/threads/launch-notes-1234abcd",
    createdAt: "2026-10-09T00:00:00.000Z",
    status: "open"
  };
}

function threadPayload(): ThreadPayload {
  return { markdown: "# Launch Notes", messages: [], messageCount: 0 };
}

test("submitting twice posts once and selects the created thread", async () => {
  const createWorkflow = createThreadWorkflow;
  const response = deferred<Thread>();
  const thread = threadInfo();
  const payload = threadPayload();
  const events: string[] = [];
  let postCount = 0;
  let loadedPayload: ThreadPayload | undefined;
  const workflow = createWorkflow({
    apiGet: async <T>(path: string) => {
      events.push("get");
      assert.equal(
        path,
        "/api/workspaces/workspace-1/threads/launch-notes-1234abcd"
      );
      return payload as T;
    },
    apiPost: async <T>(path: string, body: unknown) => {
      postCount += 1;
      events.push("post");
      assert.equal(path, "/api/workspaces/workspace-1/threads");
      assert.deepEqual(body, { title: "Launch Notes" });
      return response.promise as Promise<T>;
    },
    clearThreadPayload: () => events.push("clear"),
    currentWorkspaceId: () => "workspace-1",
    onThreadCreated: () => events.push("created"),
    selectThread: () => events.push("selected"),
    setThreadPayload: (value) => {
      loadedPayload = value;
      events.push("payload");
    },
    workspaceId: "workspace-1"
  });

  const first = workflow.submit("  Launch Notes  ");
  const second = workflow.submit("Launch Notes");
  assert.equal(postCount, 1);
  response.resolve(thread);
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(firstResult.status, "created");
  assert.equal(secondResult.status, "created");
  assert.equal(postCount, 1);
  assert.equal(loadedPayload, payload);
  assert.deepEqual(events, [
    "post",
    "created",
    "clear",
    "selected",
    "get",
    "payload"
  ]);
});

test("a late creation response does not select a thread in another workspace", async () => {
  const createWorkflow = createThreadWorkflow;
  const response = deferred<Thread>();
  const thread = threadInfo();
  const effects: string[] = [];
  let currentWorkspaceId = "workspace-1";
  let postCount = 0;
  const workflow = createWorkflow({
    apiGet: async <T>() => {
      effects.push("get");
      return threadPayload() as T;
    },
    apiPost: async <T>() => {
      postCount += 1;
      return response.promise as Promise<T>;
    },
    clearThreadPayload: () => effects.push("clear"),
    currentWorkspaceId: () => currentWorkspaceId,
    onThreadCreated: () => effects.push("created"),
    selectThread: () => effects.push("selected"),
    setThreadPayload: () => effects.push("payload"),
    workspaceId: "workspace-1"
  });

  const pending = workflow.submit("Late response");
  currentWorkspaceId = "workspace-2";
  response.resolve(thread);
  const result = await pending;

  assert.equal(result.status, "stale");
  assert.equal(postCount, 1);
  assert.deepEqual(effects, []);
});

test("retrying a failed thread read does not repeat creation", async () => {
  const createWorkflow = createThreadWorkflow;
  const thread = threadInfo();
  const payload = threadPayload();
  const effects: string[] = [];
  let postCount = 0;
  let getCount = 0;
  let loadedPayload: ThreadPayload | undefined;
  const workflow = createWorkflow({
    apiGet: async <T>() => {
      getCount += 1;
      effects.push(`get-${getCount}`);
      if (getCount === 1) throw new Error("Temporary read failure");
      return payload as T;
    },
    apiPost: async <T>() => {
      postCount += 1;
      return thread as T;
    },
    clearThreadPayload: () => effects.push("clear"),
    currentWorkspaceId: () => "workspace-1",
    onThreadCreated: () => effects.push("created"),
    selectThread: () => effects.push("selected"),
    setThreadPayload: (value) => {
      loadedPayload = value;
      effects.push("payload");
    },
    workspaceId: "workspace-1"
  });

  const created = await workflow.submit("Launch Notes");
  assert.equal(created.status, "read-error");
  assert.equal(created.thread, thread);
  assert.equal(created.error, "Temporary read failure");

  const retried = await workflow.retryRead();
  assert.equal(retried.status, "created");
  assert.equal(postCount, 1);
  assert.equal(getCount, 2);
  assert.equal(loadedPayload, payload);
  assert.deepEqual(effects, [
    "created",
    "clear",
    "selected",
    "get-1",
    "clear",
    "selected",
    "get-2",
    "payload"
  ]);
});

test("keeps created threads through stale lists until the index recognizes them", () => {
  const thread = threadInfo();
  const listedThread = { ...thread, id: "already-listed" };
  const pendingCreatedThreads = new Map<string, Map<string, Thread>>([
    ["workspace-1", new Map([[thread.id, thread]])]
  ]);

  assert.deepEqual(
    reconcileCreatedThreads(
      "workspace-1",
      [listedThread],
      pendingCreatedThreads
    ),
    [thread, listedThread]
  );
  assert.deepEqual(
    reconcileCreatedThreads("workspace-1", [thread], pendingCreatedThreads),
    [thread]
  );
  assert.equal(pendingCreatedThreads.has("workspace-1"), false);
  assert.deepEqual(
    reconcileCreatedThreads(
      "workspace-1",
      [listedThread],
      pendingCreatedThreads
    ),
    [listedThread]
  );
});

test("acknowledges a created thread found in the closed list without restoring it", () => {
  const thread = threadInfo();
  const pendingCreatedThreads = new Map<string, Map<string, Thread>>([
    ["workspace-1", new Map([[thread.id, thread]])]
  ]);

  assert.deepEqual(
    reconcileCreatedThreads("workspace-1", [], pendingCreatedThreads, [
      thread.id
    ]),
    []
  );
  assert.equal(pendingCreatedThreads.has("workspace-1"), false);
  assert.deepEqual(
    reconcileCreatedThreads("workspace-1", [], pendingCreatedThreads),
    []
  );
});
