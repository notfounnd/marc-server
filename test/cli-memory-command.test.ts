import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runMemoryCommand } from "../src/cli-memory-command.js";

test("a successful command prints its result and then disposes its workers", async () => {
  const calls: string[] = [];
  const printed: unknown[] = [];

  await runMemoryCommand({
    run: async () => {
      calls.push("run");
      return { status: "ok" };
    },
    print: (result) => {
      calls.push("print");
      printed.push(result);
    },
    dispose: async () => {
      calls.push("dispose");
    }
  });

  assert.deepEqual(calls, ["run", "print", "dispose"]);
  assert.deepEqual(printed, [{ status: "ok" }]);
});

test("a failing command skips printing, still disposes its workers, and rethrows the original error", async () => {
  const calls: string[] = [];
  const failure = new Error("recall failed");

  await assert.rejects(
    runMemoryCommand({
      run: async () => {
        calls.push("run");
        throw failure;
      },
      print: () => {
        calls.push("print");
      },
      dispose: async () => {
        calls.push("dispose");
      }
    }),
    (error: unknown) => error === failure
  );

  assert.deepEqual(calls, ["run", "dispose"]);
});

test("the CLI runs memory commands through runMemoryCommand with disposeMemoryProviders", () => {
  const source = fs.readFileSync("src/cli.ts", "utf8");

  assert.match(
    source,
    /import \{ runMemoryCommand \} from "\.\/cli-memory-command\.js";/
  );
  assert.match(source, /^ {2}disposeMemoryProviders,$/m);
  assert.match(
    source,
    /await runMemoryCommand\(\{\s*run: \(\) => handler\(parsed, workspaceRoot\),\s*print: printResult,\s*dispose: disposeMemoryProviders\s*\}\);/
  );
});
