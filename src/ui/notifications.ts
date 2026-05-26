import { toast } from "sonner";
import type { StatusKind } from "./types.js";

const notifiers = {
  error: toast.error,
  ok: toast.success,
  warn: toast.warning
};

export function showNotification(
  message: string,
  kind: Exclude<StatusKind, "idle"> = "ok"
): void {
  notifiers[kind](message, { duration: 2400 });
}
