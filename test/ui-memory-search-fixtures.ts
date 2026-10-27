import type { MemoryRecallResult } from "../src/ui/types.js";

/** An in-memory localStorage stand-in for the memory search snapshot tests. */
export class FakeStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

export const recallResult: MemoryRecallResult = {
  interpretation: {
    correctionApplied: false,
    effectiveQuery: "token rotation",
    mode: "auto",
    originalQuery: "token rotation"
  },
  indexStatus: {
    indexedSummaryCount: 1,
    autoRebuild: true,
    embeddingBatchSize: 4,
    lastError: null,
    message: "Memory index is current.",
    modelPrepared: true,
    retrieverPrepared: true,
    rerankerPrepared: true,
    interpreterPrepared: true,
    rebuildReady: true,
    searchReady: true,
    preparing: false,
    ready: true,
    rebuilding: false,
    stale: false,
    status: "ready",
    summaryCount: 1
  },
  abstained: false,
  nextActions: [],
  query: "token rotation",
  results: [
    {
      closedAt: "2026-05-24T23:15:59.807Z",
      matchedText: "Token rotation was already discussed in the daemon model.",
      reason: "Matched summary in token rotation.",
      reference:
        "marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
      band: "low",
      score: 0.82,
      summaryPath:
        "threads/oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3/SUMMARY.md",
      threadId:
        "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3",
      title: "Oportunidade - Modelo de seguranca e gestao de token do daemon"
    }
  ]
};

/** A rules hit: a group without a thread, so no thread id and no summary path. */
const {
  threadId: _threadId,
  summaryPath: _summaryPath,
  ...ruleBase
} = recallResult.results[0];
export const ruleHit = {
  ...ruleBase,
  band: "high" as const,
  reference: "marc://$rules",
  title: "Custom Rules",
  matchedText: "Use the Playwright CLI for browser validation."
};
