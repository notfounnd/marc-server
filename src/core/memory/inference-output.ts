export function toScores(value: unknown): number[] {
  if (!Array.isArray(value))
    throw new Error("Reranking worker returned invalid logits.");
  return value.map(logitFromValue).map(sigmoid);
}

function logitFromValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (!Array.isArray(value))
    throw new Error("Reranking worker returned invalid logits.");
  const first = value[0];
  if (typeof first === "number") return first;
  throw new Error("Reranking worker returned invalid logits.");
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}
