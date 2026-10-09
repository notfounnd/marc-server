import { toast } from "../components/ui/toast-manager.js";
import type { StatusKind } from "./types.js";

const notificationTypes = {
  error: "error",
  ok: "success",
  warn: "warning"
} satisfies Record<
  Exclude<StatusKind, "idle">,
  "error" | "success" | "warning"
>;

export function showNotification(
  message: string,
  kind: Exclude<StatusKind, "idle"> = "ok"
): void {
  toast.add({ title: message, type: notificationTypes[kind], timeout: 2400 });
}
