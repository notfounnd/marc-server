import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  InMemoryMemoryVectorStore,
  readMemoryStatusInWorkspace,
  rebuildMemoryInWorkspace,
  recallMemoryInWorkspace,
  scanThreadSummarySources
} from "../src/core/memory/index.js";
import type {
  EmbeddingProvider,
  EmbeddingProviderMetadata
} from "../src/core/memory/types.js";
import type { WorkspaceInfo } from "../src/core/types.js";

const providerMetadata: EmbeddingProviderMetadata = {
  id: "fake-local",
  name: "Fake Local Embeddings",
  model: "fake-memory-model",
  version: "1.0.0",
  dimensions: 3,
  distance: "cosine",
  quantized: false,
  runtime: "local"
};

class FakeEmbeddingProvider implements EmbeddingProvider {
  prepareCalls = 0;
  documentCalls = 0;
  queryCalls = 0;

  constructor(
    private readonly metadata: EmbeddingProviderMetadata = providerMetadata,
    private readonly prepared = true
  ) {}

  describe(): EmbeddingProviderMetadata {
    return this.metadata;
  }

  isPrepared(): Promise<boolean> {
    return Promise.resolve(this.prepared);
  }

  async prepare(): Promise<void> {
    this.prepareCalls += 1;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    this.documentCalls += 1;
    return texts.map(vectorForText);
  }

  async embedQuery(text: string): Promise<number[]> {
    this.queryCalls += 1;
    return vectorForText(text);
  }

  async dispose(): Promise<void> {}
}

function vectorForText(text: string): number[] {
  const normalized = text.toLowerCase();
  const tokenScore = tokenCount(normalized, [
    "token",
    "daemon",
    "seguranca",
    "security",
    "rotacao",
    "rotation",
    "interface"
  ]);
  const uiScore = tokenCount(normalized, ["composer", "autocomplete", "ui"]);
  const workflowScore = tokenCount(normalized, [
    "bootstrap",
    "thread",
    "summary",
    "workflow"
  ]);
  return [tokenScore, uiScore, workflowScore];
}

function tokenCount(text: string, tokens: string[]): number {
  return tokens.reduce((total, token) => {
    if (!text.includes(token)) return total;
    return total + 1;
  }, 0);
}

async function tempWorkspace(): Promise<WorkspaceInfo> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "marc-memory-"));
  const marcPath = path.join(rootPath, ".marc");
  await fs.mkdir(path.join(marcPath, "threads"), { recursive: true });
  return {
    id: "memory-workspace",
    name: "memory-workspace",
    rootPath,
    marcPath
  };
}

async function writeSummary(
  info: WorkspaceInfo,
  threadId: string,
  content: string
): Promise<void> {
  const threadPath = path.join(info.marcPath, "threads", threadId);
  await fs.mkdir(threadPath, { recursive: true });
  await fs.writeFile(path.join(threadPath, "SUMMARY.md"), content);
}

test("scans only thread summaries and extracts structured metadata", async () => {
  const info = await tempWorkspace();
  const threadId =
    "oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3";
  await writeSummary(
    info,
    threadId,
    [
      "# Resumo - Modelo de seguranca e gestao de token do daemon",
      "",
      `Thread: marc://$${threadId}`,
      "Closed: `2026-05-24T23:15:59.807Z`",
      "",
      "## Resultado executivo",
      "",
      "- Manter token unico local.",
      "",
      "## Decisao",
      "",
      "- Nao implementar rotacao automatica do token."
    ].join("\n")
  );
  await fs.mkdir(path.join(info.marcPath, "threads", "thread-sem-summary"), {
    recursive: true
  });

  const summaries = await scanThreadSummarySources(info);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.threadId, threadId);
  assert.equal(
    summaries[0]?.title,
    "Modelo de seguranca e gestao de token do daemon"
  );
  assert.equal(summaries[0]?.closedAt, "2026-05-24T23:15:59.807Z");
  assert.equal(summaries[0]?.reference, `marc://$${threadId}`);
  assert.ok(summaries[0]?.sha256);
  assert.ok(
    summaries[0]?.chunks.some((chunk) => chunk.sectionTitle === "Decisao")
  );
});

test("rebuild creates a current manifest and status detects stale summaries", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummary(
    info,
    "thread-token",
    [
      "# Resumo - Modelo de seguranca e gestao de token",
      "",
      "Thread: `thread-token`",
      "Closed: `2026-05-24T23:15:59.807Z`",
      "",
      "## Decisao",
      "",
      "- Nao implementar rotacao automatica do token."
    ].join("\n")
  );

  await rebuildMemoryInWorkspace(info, { provider, store });
  const current = await readMemoryStatusInWorkspace(info, { provider, store });
  await writeSummary(
    info,
    "thread-token",
    [
      "# Resumo - Modelo de seguranca e gestao de token",
      "",
      "Thread: `thread-token`",
      "Closed: `2026-05-24T23:15:59.807Z`",
      "",
      "## Decisao",
      "",
      "- Nao implementar rotacao automatica do token.",
      "- Mudanca nova que deixa o indice stale."
    ].join("\n")
  );
  const stale = await readMemoryStatusInWorkspace(info, { provider, store });

  assert.equal(current.status, "ready");
  assert.equal(current.stale, false);
  assert.equal(current.summaryCount, 1);
  assert.equal(stale.status, "stale");
  assert.equal(stale.stale, true);
  assert.equal(provider.documentCalls, 1);
  assert.equal(provider.queryCalls, 0);
});

test("recall returns the summary thread that matches the development intent", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummary(
    info,
    "thread-token",
    [
      "# Resumo - Modelo de seguranca e gestao de token",
      "",
      "Thread: `thread-token`",
      "Closed: `2026-05-24T23:15:59.807Z`",
      "",
      "## Resultado executivo",
      "",
      "- Token unico local e suficiente para o daemon em 127.0.0.1.",
      "",
      "## Decisao",
      "",
      "- Nao implementar rotacao automatica do token."
    ].join("\n")
  );
  await writeSummary(
    info,
    "thread-composer",
    [
      "# Resumo - Autocomplete de referencias no composer",
      "",
      "Thread: `thread-composer`",
      "Closed: `2026-05-11T00:43:20.102Z`",
      "",
      "## Decisao",
      "",
      "- Implementar autocomplete de referencias na UI."
    ].join("\n")
  );
  await rebuildMemoryInWorkspace(info, { provider, store });

  const recall = await recallMemoryInWorkspace(info, {
    provider,
    store,
    query: "criar rotacao para o token da interface",
    limit: 2
  });

  assert.equal(recall.results[0]?.threadId, "thread-token");
  assert.match(recall.results[0]?.matchedText ?? "", /token/i);
  assert.match(recall.results[0]?.reference ?? "", /^marc:\/\/\$thread-token/);
  assert.ok(
    recall.nextActions.some((action) => action.includes("thread_read"))
  );
  assert.equal(provider.queryCalls, 1);
});

test("recall does not load embeddings when the local provider is not prepared", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider(providerMetadata, false);
  const store = new InMemoryMemoryVectorStore();

  const recall = await recallMemoryInWorkspace(info, {
    provider,
    store,
    query: "verificar historico de token"
  });

  assert.equal(recall.indexStatus.status, "model_missing");
  assert.deepEqual(recall.results, []);
  assert.equal(provider.queryCalls, 0);
  assert.ok(
    recall.nextActions.some((action) => action.includes("memory_prepare"))
  );
});
