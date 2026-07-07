import assert from "node:assert/strict";
import test from "node:test";
import { memoryIndicatorForStatus } from "../src/ui/memory-status.js";

test("maps memory states to workspace-card indicator variants", () => {
  assert.deepEqual(memoryIndicatorForStatus(undefined), undefined);
  assert.deepEqual(memoryIndicatorForStatus({ status: "ready" }), {
    icon: "DatabaseCheck",
    tone: "ready",
    label: "Memory ready"
  });
  assert.deepEqual(memoryIndicatorForStatus({ status: "stale" }), {
    icon: "DatabaseBackup",
    tone: "action",
    label: "Memory stale"
  });
  assert.deepEqual(memoryIndicatorForStatus({ status: "missing" }), {
    icon: "DatabaseBackup",
    tone: "action",
    label: "Memory missing"
  });
  assert.deepEqual(memoryIndicatorForStatus({ status: "model_missing" }), {
    icon: "DatabaseBackup",
    tone: "action",
    label: "Memory model missing"
  });
  assert.deepEqual(memoryIndicatorForStatus({ status: "incompatible" }), {
    icon: "DatabaseX",
    tone: "error",
    label: "Memory incompatible"
  });
  assert.deepEqual(memoryIndicatorForStatus({ status: "rebuilding" }), {
    icon: "DatabaseZap",
    tone: "busy",
    label: "Memory rebuilding"
  });
});
