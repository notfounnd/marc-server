import type {
  MemoryInferenceEnvelope,
  MemoryInferenceResponse
} from "./inference-protocol.js";

export function parseMemoryInferenceEnvelope(
  value: unknown
): MemoryInferenceEnvelope | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== "number") return undefined;
  if (!memoryInferenceRoles.has(value.role)) return undefined;
  if (!isRecord(value.request)) return undefined;
  if (typeof value.request.action !== "string") return undefined;
  return value as unknown as MemoryInferenceEnvelope;
}

const memoryInferenceRoles = new Set<unknown>([
  "embedding",
  "interpretation",
  "reranking"
]);

export function sendMemoryInferenceResponse(
  response: MemoryInferenceResponse
): void {
  if (!process.send) return;
  process.send(response);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
