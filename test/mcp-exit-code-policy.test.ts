import assert from "node:assert/strict";
import test from "node:test";
import { WORKSPACE_SKILL } from "../src/core/marc-ops-skill.js";
import { marcHelper } from "../src/mcp/helper.js";

const POSIX_RUNTIME = {
  execPath: "/usr/bin/node",
  execArgv: [],
  script: "/srv/marc/src/cli.ts"
};

/** Exit codes 8 (activation_refused) and 9 (daemon_unavailable) are documented in both generated sources. */
test("the listening topic names exit code 8 as a refused activation that must not be re-armed", () => {
  const helper = marcHelper("listening", {
    workspaceRoot: "/srv/repo",
    runtime: POSIX_RUNTIME
  }) as Record<string, unknown>;
  const notes = (helper.notes as string[]).join(" ");
  assert.match(
    notes,
    /8 activation_refused, the thread's activation policy refused the mention, with a reason per message: do not re-arm, and tell the human/
  );
});

test("the listening topic names exit code 9 as an unreachable daemon that must not be re-armed", () => {
  const helper = marcHelper("listening", {
    workspaceRoot: "/srv/repo",
    runtime: POSIX_RUNTIME
  }) as Record<string, unknown>;
  const notes = (helper.notes as string[]).join(" ");
  assert.match(
    notes,
    /9 daemon_unavailable, the activation daemon of a governed thread could not be reached: tell the human and do not re-arm/
  );
});

test("the marc-ops skill names exit codes 8 and 9 with the same actions", () => {
  assert.match(
    WORKSPACE_SKILL,
    /8 activation_refused, so the thread's activation policy refused the mention, with a reason per message: do not re-arm, and tell the human/
  );
  assert.match(
    WORKSPACE_SKILL,
    /9 daemon_unavailable, so the activation daemon of a governed thread could not be reached: do not re-arm, and tell the human/
  );
});
