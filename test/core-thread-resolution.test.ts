import assert from "node:assert/strict";
import test from "node:test";
import { resolveThreadId } from "../src/core/thread-resolution.js";
import { tempWorkspace, writeThreadChat } from "./memory-test-helpers.js";

const RESOLUTION_CASES: ReadonlyArray<readonly [string, string, object]> = [
  [
    "an exact id resolves to itself",
    "alpha-cafe0021",
    { ok: true, threadId: "alpha-cafe0021" }
  ],
  [
    "an 8-hex suffix resolves to the one thread that ends with it",
    "cafe0021",
    { ok: true, threadId: "alpha-cafe0021" }
  ],
  [
    "a suffix shared by two threads is ambiguous, with the sorted candidates",
    "cafe0024",
    {
      ok: false,
      error: {
        code: "ambiguous_thread_id",
        message: "Thread ID suffix matches multiple threads.",
        details: { candidates: ["delta-cafe0024", "epsilon-cafe0024"] }
      }
    }
  ],
  [
    "an unknown id is not found",
    "missing-thread",
    {
      ok: false,
      error: { code: "thread_not_found", message: "Thread not found." }
    }
  ],
  [
    "a traversal segment is an invalid id",
    "../outside",
    {
      ok: false,
      error: {
        code: "invalid_thread_id",
        message:
          "Thread ID must not contain path separators or traversal segments."
      }
    }
  ]
];

RESOLUTION_CASES.forEach(([label, requested, expected]) => {
  test(`core thread resolution: ${label}`, async () => {
    const info = await tempWorkspace();
    await writeThreadChat(info, "alpha-cafe0021", "Alpha");
    await writeThreadChat(info, "delta-cafe0024", "Delta");
    await writeThreadChat(info, "epsilon-cafe0024", "Epsilon");

    assert.deepEqual(await resolveThreadId(info.rootPath, requested), expected);
  });
});
