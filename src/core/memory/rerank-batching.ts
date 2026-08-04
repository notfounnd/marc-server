export function rerankBatchSizes(initialSize: number): number[] {
  return [initialSize, 4, 2, 1].filter(
    (size, index, values) => size > 0 && values.indexOf(size) === index
  );
}

export function isMemoryAllocationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /alloc|memory|out of memory|oom/i.test(message);
}
