import assert from "node:assert/strict";
import test from "node:test";
import type { ChatMessage } from "../src/core/types.js";
import {
  waitForMention,
  type WaitDeps,
  type WaitOptions,
  type WaitSnapshot
} from "../src/core/thread-wait.js";

const PROFILE = "claude-dev";
const CURSOR_ID = "msg_cursor";
const POLL_MS = 2000;
const TIMEOUT_MS = 60_000;
const MENTION_BODY = `Review marc://@${PROFILE} now.`;

function message(
  id: string,
  agentId: string,
  role: string,
  body: string
): ChatMessage {
  return {
    id,
    threadId: "thread-under-test",
    timestamp: "2026-11-03T12:00:00.000Z",
    agentId,
    role,
    body,
    artifacts: []
  };
}

/** A thread whose writes are explicit, so each test controls exactly when a message appears. */
class FakeThread {
  messages: ChatMessage[] = [message(CURSOR_ID, "owner", "user", "Start.")];
  closed = false;
  reads = 0;
  readGate: Promise<void> | undefined;
  watchers: Array<{ onChange: () => void; closed: boolean }> = [];

  append(id: string, body: string): void {
    this.messages.push(
      message(id, "claude-software-architect", "architect", body)
    );
  }

  async readSnapshot(): Promise<WaitSnapshot> {
    this.reads += 1;
    await this.readGate;
    return { messages: [...this.messages], closed: this.closed };
  }

  watch(onChange: () => void): { close(): void } {
    const watcher = { onChange, closed: false };
    this.watchers.push(watcher);
    return {
      close: () => {
        watcher.closed = true;
      }
    };
  }

  emit(): void {
    this.watchers.forEach((watcher) => watcher.onChange());
  }
}

type ManualTimer = {
  delayMs: number;
  callback: () => void;
  cancelled: boolean;
};

/** Timers fire only when a test asks, so the poll and the deadline are deterministic. */
class ManualTimers {
  timers: ManualTimer[] = [];

  setTimer(callback: () => void, delayMs: number): { cancel(): void } {
    const timer: ManualTimer = { delayMs, callback, cancelled: false };
    this.timers.push(timer);
    return {
      cancel: () => {
        timer.cancelled = true;
      }
    };
  }

  active(): ManualTimer[] {
    return this.timers.filter((timer) => !timer.cancelled);
  }

  fire(delayMs: number): void {
    this.active()
      .filter((timer) => timer.delayMs === delayMs)
      .forEach((timer) => {
        timer.cancelled = true;
        timer.callback();
      });
  }
}

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

function harness(thread: FakeThread): {
  deps: WaitDeps;
  timers: ManualTimers;
  controller: AbortController;
  options: WaitOptions;
} {
  const timers = new ManualTimers();
  const controller = new AbortController();
  return {
    deps: {
      readSnapshot: () => thread.readSnapshot(),
      watch: (onChange) => thread.watch(onChange),
      timers
    },
    timers,
    controller,
    options: {
      afterMessageId: CURSOR_ID,
      mention: PROFILE,
      maxChain: 3,
      timeoutMs: TIMEOUT_MS,
      pollMs: POLL_MS,
      signal: controller.signal
    }
  };
}

test("a message written between starting the watcher and the first read is not lost", async () => {
  const thread = new FakeThread();
  const { deps, options, timers } = harness(thread);
  const writeDuringWatch: WaitDeps = {
    ...deps,
    watch: (onChange) => {
      thread.append("msg_2", MENTION_BODY);
      return deps.watch(onChange);
    }
  };

  const outcome = await waitForMention(options, writeDuringWatch);

  assert.deepStrictEqual(outcome, {
    status: "mention",
    messageIds: ["msg_2"],
    authors: [{ agentId: "claude-software-architect", role: "architect" }],
    chain: { count: 1, max: 3 }
  });
  assert.equal(timers.active().length, 0);
});

test("a silent watcher is covered by the periodic poll", async () => {
  const thread = new FakeThread();
  const { deps, options, timers } = harness(thread);
  const pending = waitForMention(options, deps);
  await flush();

  thread.append("msg_2", MENTION_BODY);
  timers.fire(POLL_MS);
  const outcome = await pending;

  assert.equal(outcome.status, "mention");
  assert.equal(thread.watchers[0].closed, true);
  assert.equal(timers.active().length, 0);
});

test("a watcher event reconciles without waiting for the poll", async () => {
  const thread = new FakeThread();
  const { deps, options } = harness(thread);
  const pending = waitForMention(options, deps);
  await flush();

  thread.append("msg_2", MENTION_BODY);
  thread.emit();
  const outcome = await pending;

  assert.equal(outcome.status, "mention");
});

test("the deadline ends the wait as timeout and closes the watcher and timers", async () => {
  const thread = new FakeThread();
  const { deps, options, timers } = harness(thread);
  const pending = waitForMention(options, deps);
  await flush();

  timers.fire(TIMEOUT_MS);
  const outcome = await pending;

  assert.deepStrictEqual(outcome, { status: "timeout" });
  assert.equal(thread.watchers[0].closed, true);
  assert.equal(timers.active().length, 0);
});

test("an abort ends the wait as interrupted and releases the watcher and timers", async () => {
  const thread = new FakeThread();
  const { deps, options, timers, controller } = harness(thread);
  const pending = waitForMention(options, deps);
  await flush();

  controller.abort();
  const outcome = await pending;

  assert.deepStrictEqual(outcome, { status: "interrupted" });
  assert.equal(thread.watchers[0].closed, true);
  assert.equal(timers.active().length, 0);
});

test("an already aborted signal returns interrupted without opening a watcher", async () => {
  const thread = new FakeThread();
  const { deps, options, controller } = harness(thread);
  controller.abort();

  const outcome = await waitForMention(options, deps);

  assert.deepStrictEqual(outcome, { status: "interrupted" });
  assert.equal(thread.watchers.length, 0);
});

test("a thread that closes during the wait ends it as thread_closed", async () => {
  const thread = new FakeThread();
  const { deps, options, timers } = harness(thread);
  const pending = waitForMention(options, deps);
  await flush();

  thread.closed = true;
  timers.fire(POLL_MS);
  const outcome = await pending;

  assert.deepStrictEqual(outcome, { status: "thread_closed" });
});

test("a read failure ends the wait as error with the reason", async () => {
  const thread = new FakeThread();
  const { deps, options } = harness(thread);
  const failingDeps: WaitDeps = {
    ...deps,
    readSnapshot: () => Promise.reject(new Error("CHAT.md unreadable"))
  };

  const outcome = await waitForMention(options, failingDeps);

  assert.deepStrictEqual(outcome, {
    status: "error",
    error: "CHAT.md unreadable"
  });
});

test("reconciliations never overlap: ticks during a slow read run once after it", async () => {
  const thread = new FakeThread();
  let release: () => void = () => undefined;
  thread.readGate = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  const { deps, options, timers } = harness(thread);
  const pending = waitForMention(options, deps);
  await flush();

  timers.fire(POLL_MS);
  thread.emit();
  await flush();
  assert.equal(thread.reads, 1, "no second read while the first is pending");

  thread.readGate = undefined;
  release();
  await flush();
  assert.equal(
    thread.reads,
    2,
    "the queued tick runs once after the first read"
  );

  thread.append("msg_2", MENTION_BODY);
  timers.fire(POLL_MS);
  const outcome = await pending;

  assert.equal(outcome.status, "mention");
});
