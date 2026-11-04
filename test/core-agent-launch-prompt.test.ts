import assert from "node:assert/strict";
import test from "node:test";
import {
  initialPrompt,
  nativeNewCommand,
  nativeResumeCommand,
  promptFor,
  singleQuoted
} from "../src/core/agent-launch.js";

const THREAD = "ativacao-por-mencao-f2-vinculo-presenca-posse-e-menu-134b5983";
const PROFILE = "claude-dev";

test("the initial prompt names the profile and the thread reference, and keeps the marc open text", () => {
  assert.equal(
    initialPrompt(THREAD, PROFILE),
    `You are the mARC profile ${PROFILE}. Call workspace_bootstrap, then read the thread marc://$${THREAD} as ${PROFILE} with thread_read, and act under the workspace rules.`
  );
});

test("the initial prompt contains no single quote, so it fits inside the copied command", () => {
  assert.equal(initialPrompt(THREAD, PROFILE).includes("'"), false);
});

test("only a new session receives the prompt; a resume never does", () => {
  assert.equal(promptFor("resume", THREAD, PROFILE), undefined);
  assert.equal(
    promptFor("new", THREAD, PROFILE),
    initialPrompt(THREAD, PROFILE)
  );
});

test("the native new-session command is claude with the prompt in single quotes", () => {
  const command = nativeNewCommand(THREAD, PROFILE);

  assert.equal(command, `claude '${initialPrompt(THREAD, PROFILE)}'`);
  assert.ok(command.startsWith("claude '"));
  assert.ok(command.endsWith("'"));
  assert.equal(command.slice("claude '".length, -1).includes("'"), false);
});

test("the native resume command names the session and nothing else", () => {
  assert.equal(
    nativeResumeCommand("7b29f3be-2d0c-456f-996a-ff29e6ee7922"),
    "claude --resume 7b29f3be-2d0c-456f-996a-ff29e6ee7922"
  );
});

test("a single quote in a value is closed, escaped and reopened, so the shell reads one word", () => {
  assert.equal(singleQuoted("it's"), "'it'\\''s'");
  assert.equal(singleQuoted("plain"), "'plain'");
});
