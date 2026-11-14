import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { NEXT_STEP } from "../src/cli-wait-status.js";
import { WORKSPACE_SKILL } from "../src/core/marc-ops-skill.js";
import { marcHelper } from "../src/mcp/helper.js";
import { currentWaitRuntime } from "../src/mcp/listening-command.js";
import { tempWorkspace } from "./memory-test-helpers.js";

const CONFIG_FILE = "marc.config.json";

function listeningHelperOf(workspaceRoot: string): Record<string, unknown> {
  return marcHelper("listening", {
    workspaceRoot,
    runtime: currentWaitRuntime()
  }) as Record<string, unknown>;
}

test("marc_helper listening reports off when the workspace has no settings file", async () => {
  const info = await tempWorkspace();
  assert.equal(listeningHelperOf(info.rootPath).listeningDefault, "off");
});

test("marc_helper listening reports on when the workspace listening default is on", async () => {
  const info = await tempWorkspace();
  await fs.writeFile(
    path.join(info.marcPath, CONFIG_FILE),
    JSON.stringify({ listening: { defaultOn: true } }),
    "utf8"
  );
  assert.equal(listeningHelperOf(info.rootPath).listeningDefault, "on");
});

test("marc_helper listening reports off when the settings file cannot be read", async () => {
  const info = await tempWorkspace();
  await fs.writeFile(
    path.join(info.marcPath, CONFIG_FILE),
    "{ not json",
    "utf8"
  );
  assert.equal(listeningHelperOf(info.rootPath).listeningDefault, "off");
});

test("marc_helper listening keeps its ready command next to the default", async () => {
  const info = await tempWorkspace();
  const helper = listeningHelperOf(info.rootPath);
  assert.equal("command" in helper, true);
  assert.equal("listeningDefault" in helper, true);
});

test("marc_helper topics other than listening carry no listeningDefault", () => {
  const overview = marcHelper("overview") as Record<string, unknown>;
  assert.equal("listeningDefault" in overview, false);
});

test("the managed skill limits arming to the principal agent", () => {
  assert.match(
    WORKSPACE_SKILL,
    /Only the principal agent, which works with the human directly in an interactive session, follows this section and arms listeners\./
  );
  assert.match(
    WORKSPACE_SKILL,
    /A delegated developer, or a turn that runs once, never arms a listener, whatever the workspace default is\./
  );
  assert.match(
    WORKSPACE_SKILL,
    /the principal reads `listeningDefault` from `marc_helper`/
  );
});

test("the helper limits arming to the principal agent in its purpose, steps and notes", () => {
  const helper = listeningHelperOf(path.join("/srv", "repo"));
  const purpose = String(helper.purpose);
  const whenToUse = (helper.whenToUse as string[]).join(" ");
  const notes = (helper.notes as string[]).join(" ");

  assert.match(purpose, /Only the principal agent arms it/);
  assert.match(
    whenToUse,
    /Only the principal agent, which works with the human directly in an interactive session, reads listeningDefault/
  );
  assert.match(
    whenToUse,
    /A delegated developer or a turn that runs once never arms a wait, whatever the default is\./
  );
  assert.match(
    notes,
    /Only the principal agent reads it to decide whether to arm; a delegated developer or a turn that runs once never arms a wait/
  );
});

test("the managed skill states the listening default and its two paths", () => {
  assert.match(WORKSPACE_SKILL, /reads `listeningDefault` from `marc_helper`/);
  assert.match(WORKSPACE_SKILL, /When it is `off`, ask the human whether/);
  assert.match(
    WORKSPACE_SKILL,
    /When it is `on`, arm the wait, say so in one line/
  );
  assert.match(WORKSPACE_SKILL, /with `on` re-arm with the same cursor/);
  assert.match(WORKSPACE_SKILL, /the wait is still alive, so nothing repeats/);
  assert.match(WORKSPACE_SKILL, /Never stop a waiter by process name\./);
  assert.match(WORKSPACE_SKILL, /A mention is a signal, not an order/);
});

test("the timeout next step re-arms only when the listening default is on", () => {
  const text = NEXT_STEP.timeout({ status: "timeout" }, "thread-x");
  assert.match(
    text,
    /If the workspace listening default is on, re-arm with the same cursor and tell the human; otherwise ask the human before re-arming\./
  );
});
