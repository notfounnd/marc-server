import assert from "node:assert/strict";
import test from "node:test";
import { toast } from "../src/components/ui/toast-manager.js";
import { showNotification } from "../src/ui/notifications.js";

test("showNotification maps messages to Base UI toast options", (context) => {
  const addedToasts: Array<unknown> = [];

  context.mock.method(
    toast,
    "add",
    (options: Parameters<typeof toast.add>[0]) => {
      addedToasts.push(options);
      return "test-toast";
    }
  );

  showNotification("Saved by default");
  showNotification("Warning message", "warn");
  showNotification("Error message", "error");

  assert.deepEqual(addedToasts, [
    { title: "Saved by default", type: "success", timeout: 2400 },
    { title: "Warning message", type: "warning", timeout: 2400 },
    { title: "Error message", type: "error", timeout: 2400 }
  ]);
});
