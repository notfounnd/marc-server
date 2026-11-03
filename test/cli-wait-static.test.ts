import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

/** Static value imports only. `import type` is erased at runtime, and `import()` loads on demand. */
const STATIC_IMPORT =
  /^(?:import|export)\s+(?!type\b)[^;]*?\sfrom\s+"(\.{1,2}\/[^"]+)"/gm;

const MEMORY_OR_LLM =
  /^src\/core\/(memory\/|workspace-memory\.ts$)|llm|embed|provider|inference/i;
const CLI_FORBIDDEN = /^src\/daemon\/|^src\/mcp\/(server|workspace-tools)\.ts$/;

const WAIT_PATH_ENTRIES = [
  "src/core/thread-mentions.ts",
  "src/core/thread-wait.ts",
  "src/core/thread-wait-runtime.ts",
  "src/cli-wait-command.ts",
  "src/mcp/listening-command.ts",
  "src/mcp/helper.ts"
];

/** Lazy modules that cli.ts must load through import(), not through a static import. */
const LAZY_IMPORTS = [
  'import("./core/workspace-memory.js")',
  'import("./cli-memory-command.js")',
  'import("./daemon/config.js")',
  'import("./daemon/lifecycle.js")',
  'import("./daemon/server.js")',
  'import("./mcp/server.js")'
];

function relative(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function staticImports(file: string): string[] {
  const source = fs.readFileSync(file, "utf8");
  return [...source.matchAll(STATIC_IMPORT)]
    .map((match) =>
      path.resolve(path.dirname(file), match[1].replace(/\.js$/, ".ts"))
    )
    .filter((target) => fs.existsSync(target));
}

/** Every module reached through static value imports, starting at the entry, direct or transitive. */
function staticClosure(entry: string): string[] {
  const seen = new Set<string>();
  let frontier = [path.resolve(ROOT, entry)];
  while (frontier.length > 0) {
    frontier.forEach((file) => seen.add(file));
    frontier = [...new Set(frontier.flatMap(staticImports))].filter(
      (file) => !seen.has(file)
    );
  }
  return [...seen].map(relative).sort();
}

function forbiddenIn(files: string[], pattern: RegExp): string[] {
  return files.filter((file) => pattern.test(file));
}

WAIT_PATH_ENTRIES.forEach((entry) =>
  test(`static imports: ${entry} reaches no memory, model, or LLM module`, () => {
    assert.deepEqual(forbiddenIn(staticClosure(entry), MEMORY_OR_LLM), []);
  })
);

test("static imports: src/cli.ts reaches no memory, daemon, or MCP server module", () => {
  const closure = staticClosure("src/cli.ts");

  assert.deepEqual(forbiddenIn(closure, MEMORY_OR_LLM), []);
  assert.deepEqual(forbiddenIn(closure, CLI_FORBIDDEN), []);
});

test("static imports: the top of src/cli.ts has a single value import, the wait command", () => {
  const source = fs.readFileSync(path.resolve(ROOT, "src/cli.ts"), "utf8");
  const specifiers = [...source.matchAll(STATIC_IMPORT)].map(
    (match) => match[1]
  );

  assert.deepEqual(specifiers, ["./cli-wait-command.js"]);
});

LAZY_IMPORTS.forEach((snippet) =>
  test(`static imports: src/cli.ts loads ${snippet} on demand`, () => {
    const source = fs.readFileSync(path.resolve(ROOT, "src/cli.ts"), "utf8");

    assert.equal(source.includes(snippet), true);
  })
);
