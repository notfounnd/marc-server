export const MEMORY_MODEL_BENCHMARK_REPORT_MARKER =
  "MARC_MEMORY_QUALITY_REPORT=";

export type MemoryQualityAggregate = {
  meanNdcgAt10: number;
  meanReciprocalRank: number;
  meanRecallAt10: number;
};

export function encodeMemoryModelBenchmarkReport(report: unknown): string {
  return `${MEMORY_MODEL_BENCHMARK_REPORT_MARKER}${JSON.stringify(report)}`;
}

export function parseMemoryModelBenchmarkReport(
  output: string
): Record<string, unknown> {
  const line = output
    .split(/\r?\n/u)
    .reverse()
    .find((candidate) =>
      candidate.startsWith(MEMORY_MODEL_BENCHMARK_REPORT_MARKER)
    );
  if (!line)
    throw new Error("Benchmark process did not emit a quality report.");
  const serialized = line.slice(MEMORY_MODEL_BENCHMARK_REPORT_MARKER.length);
  const report: unknown = JSON.parse(serialized);
  if (!isRecord(report))
    throw new Error("Benchmark process emitted an invalid quality report.");
  return report;
}

export function benchmarkQualityDeltas(
  aggregates: Record<string, MemoryQualityAggregate>
): Record<string, MemoryQualityAggregate> {
  const baseline = aggregates.baseline;
  if (!baseline) throw new Error("Benchmark comparison requires a baseline.");
  return Object.fromEntries(
    Object.entries(aggregates)
      .filter(([profile]) => profile !== "baseline")
      .map(([profile, aggregate]) => [
        profile,
        {
          meanNdcgAt10: round(
            aggregate.meanNdcgAt10 - baseline.meanNdcgAt10
          ),
          meanReciprocalRank: round(
            aggregate.meanReciprocalRank - baseline.meanReciprocalRank
          ),
          meanRecallAt10: round(
            aggregate.meanRecallAt10 - baseline.meanRecallAt10
          )
        }
      ])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
