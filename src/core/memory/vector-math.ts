export function cosineSimilarity(
  left: number[],
  right: Iterable<number>
): number {
  const rightValues = [...right];
  const dot = left.reduce(
    (total, value, index) => total + value * rightValues[index]!,
    0
  );
  const leftNorm = Math.sqrt(
    left.reduce((total, value) => total + value * value, 0)
  );
  const rightNorm = Math.sqrt(
    rightValues.reduce((total, value) => total + value * value, 0)
  );
  if (!leftNorm) return 0;
  if (!rightNorm) return 0;
  return dot / (leftNorm * rightNorm);
}
