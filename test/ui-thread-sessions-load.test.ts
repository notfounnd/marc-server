import assert from "node:assert/strict";
import test from "node:test";
import type { ApiGet } from "../src/ui/types.js";
import {
  loadThreadSessions,
  threadSessionsPath,
  visibleSessions
} from "../src/ui/use-thread-sessions.js";
import { readyState, viewOf } from "./ui-thread-sessions-fixtures.js";

function resolvingApi(result: unknown): ApiGet {
  return async <T>(_path: string) => result as T;
}

function rejectingApi(error: unknown): ApiGet {
  return <T>(_path: string): Promise<T> => Promise.reject(error);
}

test("the sessions path encodes the workspace and thread identifiers", () => {
  assert.equal(
    threadSessionsPath("ws/1", "t 2"),
    "/api/workspaces/ws%2F1/threads/t%202/sessions"
  );
});

test("a successful fetch becomes a ready state carrying the view", async () => {
  const view = viewOf({});
  const state = await loadThreadSessions(resolvingApi(view), "ws:t", "/path");

  assert.deepEqual(state, { key: "ws:t", status: "ready", view });
});

test("a failed fetch keeps its reason, so the menu can say why sessions are unavailable", async () => {
  const state = await loadThreadSessions(
    rejectingApi(new Error("Not found")),
    "ws:t",
    "/path"
  );

  assert.deepEqual(state, {
    key: "ws:t",
    status: "error",
    reason: "Not found"
  });
});

test("a rejection that is not an Error is reported as text", async () => {
  const state = await loadThreadSessions(
    rejectingApi("plain failure"),
    "ws:t",
    "/path"
  );

  assert.deepEqual(state, {
    key: "ws:t",
    status: "error",
    reason: "plain failure"
  });
});

test("visible sessions keep the stored state for its own key and read loading for another", () => {
  const stored = readyState(viewOf({}));

  assert.deepEqual(visibleSessions(stored, "ws:t"), stored);
  assert.deepEqual(visibleSessions(stored, "ws:other"), {
    key: "ws:other",
    status: "loading"
  });
});
